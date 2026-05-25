const express = require('express');
const router = express.Router();
const Restaurant = require('../models/Restaurant');
const Order = require('../models/Order');
const { auth, adminAuth, restaurantAuth } = require('../middleware/auth');
const { auditLog } = require('../utils/audit');
const AuditLog = require('../models/AuditLog');

// Get all restaurants
router.get('/', async (req, res) => {
    try {
        const { cuisine, search, limit, city, province } = req.query;
        let query = { isActive: true };

        if (cuisine) {
            query.cuisine = cuisine;
        }

        if (city) {
            query.serviceCity = { $regex: city, $options: 'i' };
        }

        if (province) {
            query.serviceProvince = { $regex: province, $options: 'i' };
        }

        if (search) {
            query.name = { $regex: search, $options: 'i' };
        }

        const queryLimit = Number.isFinite(Number(limit)) ? Math.max(0, parseInt(limit, 10)) : 0;
        const mongoQuery = Restaurant.find(query).sort({ rating: -1 });
        if (queryLimit) mongoQuery.limit(queryLimit);

        const restaurants = await mongoQuery;
        res.json(restaurants);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Get restaurant by ID
router.get('/:id', async (req, res) => {
    try {
        const restaurant = await Restaurant.findById(req.params.id);
        if (!restaurant) {
            return res.status(404).json({ message: 'Restaurant not found' });
        }
        res.json(restaurant);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Restaurant/admin: basic stats for a restaurant
router.get('/stats/:restaurantId', restaurantAuth, async (req, res) => {
    try {
        const restaurantId = req.params.restaurantId;
        const restaurant = await Restaurant.findById(restaurantId);
        if (!restaurant) return res.status(404).json({ message: 'Restaurant not found' });

        if (req.user.role !== 'admin' && restaurant.ownerId.toString() !== req.userId) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        const now = new Date();
        const startOfToday = new Date(now);
        startOfToday.setHours(0, 0, 0, 0);
        const startOfWeek = new Date(startOfToday);
        startOfWeek.setDate(startOfWeek.getDate() - 6);

        const [statusCounts, todayRevenueAgg, weekRevenueAgg, topItems] = await Promise.all([
            Order.aggregate([
                { $match: { restaurantId: restaurant._id } },
                { $group: { _id: '$status', count: { $sum: 1 } } }
            ]),
            Order.aggregate([
                { $match: { restaurantId: restaurant._id, createdAt: { $gte: startOfToday } } },
                { $group: { _id: null, revenue: { $sum: '$totalAmount' }, orders: { $sum: 1 } } }
            ]),
            Order.aggregate([
                { $match: { restaurantId: restaurant._id, createdAt: { $gte: startOfWeek } } },
                { $group: { _id: null, revenue: { $sum: '$totalAmount' }, orders: { $sum: 1 } } }
            ]),
            Order.aggregate([
                { $match: { restaurantId: restaurant._id, createdAt: { $gte: startOfWeek } } },
                { $unwind: '$items' },
                { $group: { _id: '$items.name', qty: { $sum: '$items.quantity' }, sales: { $sum: { $multiply: ['$items.quantity', '$items.price'] } } } },
                { $sort: { qty: -1 } },
                { $limit: 8 }
            ])
        ]);

        const counts = statusCounts.reduce((acc, s) => {
            acc[s._id] = s.count;
            return acc;
        }, {});

        const todayRevenue = todayRevenueAgg[0]?.revenue || 0;
        const todayOrders = todayRevenueAgg[0]?.orders || 0;
        const weekRevenue = weekRevenueAgg[0]?.revenue || 0;
        const weekOrders = weekRevenueAgg[0]?.orders || 0;

        // 7-day chart data
        const chart = [];
        for (let i = 6; i >= 0; i--) {
            const d0 = new Date(startOfToday);
            d0.setDate(d0.getDate() - i);
            const d1 = new Date(d0);
            d1.setDate(d1.getDate() + 1);

            // eslint-disable-next-line no-await-in-loop
            const dayAgg = await Order.aggregate([
                { $match: { restaurantId: restaurant._id, createdAt: { $gte: d0, $lt: d1 } } },
                { $group: { _id: null, revenue: { $sum: '$totalAmount' }, orders: { $sum: 1 } } }
            ]);
            chart.push({
                day: d0.toLocaleDateString('en-US', { weekday: 'short' }),
                revenue: dayAgg[0]?.revenue || 0,
                orders: dayAgg[0]?.orders || 0
            });
        }

        res.json({
            counts,
            today: { revenue: todayRevenue, orders: todayOrders },
            week: { revenue: weekRevenue, orders: weekOrders },
            topItems,
            chart
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Restaurant/admin: recent audit logs (manager only)
router.get('/audit/:restaurantId', restaurantAuth, async (req, res) => {
    try {
        if (req.user.role === 'restaurant_staff') {
            return res.status(403).json({ message: 'Access denied. Manager only.' });
        }
        const restaurantId = req.params.restaurantId;
        const restaurant = await Restaurant.findById(restaurantId);
        if (!restaurant) return res.status(404).json({ message: 'Restaurant not found' });
        if (req.user.role !== 'admin' && restaurant.ownerId.toString() !== req.userId) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        const logs = await AuditLog.find({ restaurantId })
            .populate('actorUserId', 'name email role')
            .sort({ createdAt: -1 })
            .limit(100)
            .lean();

        res.json(logs);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Create restaurant (admin or restaurant owner)
router.post('/', auth, async (req, res) => {
    try {
        const restaurant = new Restaurant({
            ...req.body,
            ownerId: req.userId
        });
        await restaurant.save();
        res.status(201).json(restaurant);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Restaurant/admin: get my restaurant (by ownerId)
router.get('/me/mine', restaurantAuth, async (req, res) => {
    try {
        if (req.user.role === 'restaurant_staff') {
            if (!req.user.restaurantId) return res.status(404).json({ message: 'Restaurant not found' });
            const restaurant = await Restaurant.findById(req.user.restaurantId);
            if (!restaurant) return res.status(404).json({ message: 'Restaurant not found' });
            return res.json(restaurant);
        }

        const restaurant = await Restaurant.findOne({ ownerId: req.userId });
        if (!restaurant) return res.status(404).json({ message: 'Restaurant not found' });
        res.json(restaurant);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Restaurant/admin: update settings for my restaurant
router.put('/me/mine', restaurantAuth, async (req, res) => {
    try {
        if (req.user.role === 'restaurant_staff') {
            return res.status(403).json({ message: 'Access denied. Manager only.' });
        }

        const restaurant = await Restaurant.findOne({ ownerId: req.userId });
        if (!restaurant) return res.status(404).json({ message: 'Restaurant not found' });

        const allowed = ['isOpen', 'hours', 'deliveryFee', 'minimumOrder', 'deliveryTime', 'phone', 'imageUrl', 'description', 'serviceProvince', 'serviceCity', 'notificationSoundEnabled', 'notificationsMutedUntil'];
        for (const k of Object.keys(req.body || {})) {
            if (allowed.includes(k)) restaurant[k] = req.body[k];
        }

        await restaurant.save();

        await auditLog({
            restaurantId: restaurant._id,
            actorUserId: req.userId,
            action: 'restaurant.settings.update',
            meta: { fields: Object.keys(req.body || {}) }
        });

        res.json(restaurant);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Update restaurant
router.put('/:id', restaurantAuth, async (req, res) => {
    try {
        const restaurant = await Restaurant.findById(req.params.id);

        if (!restaurant) {
            return res.status(404).json({ message: 'Restaurant not found' });
        }

        if (restaurant.ownerId.toString() !== req.userId && req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Not authorized' });
        }

        const updated = await Restaurant.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true }
        );

        res.json(updated);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Delete restaurant (admin only)
router.delete('/:id', adminAuth, async (req, res) => {
    try {
        await Restaurant.findByIdAndDelete(req.params.id);
        res.json({ message: 'Restaurant deleted' });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

module.exports = router;
