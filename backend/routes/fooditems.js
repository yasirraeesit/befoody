const express = require('express');
const router = express.Router();
const FoodItem = require('../models/FoodItem');
const Restaurant = require('../models/Restaurant');
const { auth, restaurantAuth } = require('../middleware/auth');
const { auditLog } = require('../utils/audit');

// Get all food items (with optional restaurant filter)
router.get('/', async (req, res) => {
    try {
        const { restaurantId, category, vegetarian, limit, random, city, province, featured } = req.query;
        let query = { isAvailable: true };

        if (restaurantId) {
            query.restaurantId = restaurantId;
        }

        if (category) {
            query.category = category;
        }

        if (vegetarian === 'true') {
            query.isVegetarian = true;
        }

        if (featured === 'true' || featured === '1') {
            query.isFeatured = true;
        }

        if ((city || province) && !restaurantId) {
            const restaurantQuery = {};
            if (city) restaurantQuery.serviceCity = { $regex: city, $options: 'i' };
            if (province) restaurantQuery.serviceProvince = { $regex: province, $options: 'i' };

            const restaurantIds = await Restaurant.find(restaurantQuery, { _id: 1 }).lean();
            query.restaurantId = { $in: restaurantIds.map((r) => r._id) };
        }

        const queryLimit = Number.isFinite(Number(limit)) ? Math.max(0, parseInt(limit, 10)) : 0;
        const shouldRandom = random === 'true' || random === '1';

        let foodItems;
        if (shouldRandom && queryLimit) {
            foodItems = await FoodItem.aggregate([
                { $match: query },
                { $sample: { size: queryLimit } }
            ]);
            foodItems = await FoodItem.populate(foodItems, { path: 'restaurantId', select: 'name' });
        } else {
            const mongoQuery = FoodItem.find(query).sort({ isFeatured: -1, sortOrder: 1, createdAt: -1 });
            if (queryLimit) mongoQuery.limit(queryLimit);
            foodItems = await mongoQuery.populate('restaurantId', 'name');
        }

        res.json(foodItems);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Restaurant/admin: get all items for a restaurant (including unavailable)
router.get('/restaurant/:restaurantId', restaurantAuth, async (req, res) => {
    try {
        const restaurantId = req.params.restaurantId;
        const items = await FoodItem.find({ restaurantId }).sort({ isFeatured: -1, sortOrder: 1, createdAt: -1 });
        res.json(items);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Get food item by ID
router.get('/:id', async (req, res) => {
    try {
        const foodItem = await FoodItem.findById(req.params.id).populate('restaurantId');
        if (!foodItem) {
            return res.status(404).json({ message: 'Food item not found' });
        }
        res.json(foodItem);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Create food item (restaurant owner)
router.post('/', restaurantAuth, async (req, res) => {
    try {
        if (req.user.role === 'restaurant_staff') {
            const staffRestaurantId = req.user.restaurantId?.toString();
            if (!staffRestaurantId || staffRestaurantId !== String(req.body.restaurantId)) {
                return res.status(403).json({ message: 'Not authorized' });
            }
        }

        const foodItem = new FoodItem(req.body);
        await foodItem.save();

        await auditLog({
            restaurantId: foodItem.restaurantId,
            actorUserId: req.userId,
            action: 'menu.item.create',
            meta: { foodItemId: foodItem._id, name: foodItem.name }
        });

        res.status(201).json(foodItem);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Update food item
router.put('/:id', restaurantAuth, async (req, res) => {
    try {
        if (typeof req.body.stockCount === 'number' && req.body.stockCount <= 0) {
            req.body.isAvailable = false;
        }

        const foodItem = await FoodItem.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true }
        );

        if (!foodItem) {
            return res.status(404).json({ message: 'Food item not found' });
        }

        if (req.user.role === 'restaurant_staff') {
            const staffRestaurantId = req.user.restaurantId?.toString();
            if (!staffRestaurantId || staffRestaurantId !== foodItem.restaurantId.toString()) {
                return res.status(403).json({ message: 'Not authorized' });
            }
        }

        await auditLog({
            restaurantId: foodItem.restaurantId,
            actorUserId: req.userId,
            action: 'menu.item.update',
            meta: { foodItemId: foodItem._id }
        });

        res.json(foodItem);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Delete food item
router.delete('/:id', restaurantAuth, async (req, res) => {
    try {
        const existing = await FoodItem.findById(req.params.id);
        if (!existing) return res.status(404).json({ message: 'Food item not found' });

        if (req.user.role === 'restaurant_staff') {
            const staffRestaurantId = req.user.restaurantId?.toString();
            if (!staffRestaurantId || staffRestaurantId !== existing.restaurantId.toString()) {
                return res.status(403).json({ message: 'Not authorized' });
            }
        }

        await FoodItem.findByIdAndDelete(req.params.id);

        await auditLog({
            restaurantId: existing.restaurantId,
            actorUserId: req.userId,
            action: 'menu.item.delete',
            meta: { foodItemId: existing._id, name: existing.name }
        });

        res.json({ message: 'Food item deleted' });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

module.exports = router;
