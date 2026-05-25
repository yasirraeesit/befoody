const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const Restaurant = require('../models/Restaurant');
const { auth, adminAuth, restaurantAuth } = require('../middleware/auth');
const { auditLog } = require('../utils/audit');

const ALLOWED_STATUS = new Set(['pending', 'confirmed', 'preparing', 'ready_for_pickup', 'out_for_delivery', 'delivered', 'cancelled']);

function canTransition(fromStatus, toStatus) {
    if (fromStatus === toStatus) return true;
    const transitions = {
        pending: new Set(['confirmed', 'cancelled']),
        confirmed: new Set(['preparing', 'cancelled']),
        preparing: new Set(['ready_for_pickup', 'cancelled']),
        ready_for_pickup: new Set(['out_for_delivery']),
        out_for_delivery: new Set(['delivered']),
        delivered: new Set([]),
        cancelled: new Set([])
    };
    return transitions[fromStatus]?.has(toStatus) || false;
}

// Create order (supports both authenticated and guest checkout)
router.post('/', async (req, res) => {
    try {
        // Check if user is authenticated
        const token = req.header('Authorization')?.replace('Bearer ', '');
        let userId = null;

        if (token) {
            try {
                const jwt = require('jsonwebtoken');
                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                userId = decoded.userId;
            } catch (err) {
                // Token invalid, treat as guest
                console.log('Invalid token, treating as guest checkout');
            }
        }

        // Validate required fields
        const { restaurantId, items, totalAmount, deliveryAddress, paymentMethod } = req.body;

        if (!restaurantId) {
            return res.status(400).json({ message: 'Restaurant ID is required' });
        }

        if (!items || items.length === 0) {
            return res.status(400).json({ message: 'Order must contain at least one item' });
        }

        if (!deliveryAddress || !deliveryAddress.street || !deliveryAddress.city) {
            return res.status(400).json({ message: 'Complete delivery address is required' });
        }

        // If guest checkout, validate guest info
        if (!userId && !req.body.guestInfo) {
            return res.status(400).json({ message: 'Guest information is required for guest checkout' });
        }

        // Ensure userId is handled correctly
        const orderData = { ...req.body };
        if (userId) {
            orderData.userId = userId;
        } else {
            delete orderData.userId; // Ensure no invalid userId is passed for guest
        }

        // Enforce restaurant open/closed before allowing new orders
        const restaurant = await Restaurant.findById(restaurantId).lean();
        if (!restaurant) return res.status(404).json({ message: 'Restaurant not found' });
        if (restaurant.isOpen === false) {
            return res.status(400).json({ message: 'Restaurant is currently closed' });
        }

        // Optional hours enforcement (if hours are configured)
        if (Array.isArray(restaurant.hours) && restaurant.hours.length > 0) {
            const dayKey = new Date().toLocaleDateString('en-US', { weekday: 'short' }).toLowerCase(); // mon,tue...
            const map = {
                mon: 'Mon',
                tue: 'Tue',
                wed: 'Wed',
                thu: 'Thu',
                fri: 'Fri',
                sat: 'Sat',
                sun: 'Sun'
            };
            const todayLabel = map[dayKey] || null;
            const today = todayLabel ? restaurant.hours.find((h) => h.day === todayLabel) : null;
            if (today && today.closed) {
                return res.status(400).json({ message: 'Restaurant is closed today' });
            }
            if (today && today.open && today.close) {
                const [oh, om] = today.open.split(':').map(Number);
                const [ch, cm] = today.close.split(':').map(Number);
                const now = new Date();
                const minsNow = now.getHours() * 60 + now.getMinutes();
                const minsOpen = oh * 60 + om;
                const minsClose = ch * 60 + cm;
                const inWindow = minsOpen <= minsClose
                    ? (minsNow >= minsOpen && minsNow <= minsClose)
                    : (minsNow >= minsOpen || minsNow <= minsClose); // overnight
                if (!inWindow) {
                    return res.status(400).json({ message: 'Restaurant is currently closed (outside working hours)' });
                }
            }
        }

        console.log('Creating order:', JSON.stringify(orderData, null, 2));

        const order = new Order(orderData);
        await order.save();

        if (userId) {
            await order.populate('restaurantId userId');
        } else {
            await order.populate('restaurantId');
        }

        // Emit socket event for real-time update
        const io = req.app.get('socketio');
        if (order.restaurantId) {
            // Use _id because restaurantId is populated
            const restaurantId = order.restaurantId._id || order.restaurantId;
            io.to(`restaurant_${restaurantId.toString()}`).emit('newOrder', order);
        }

        res.status(201).json(order);
    } catch (error) {
        console.error('Order creation error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Get user's orders
router.get('/my-orders', auth, async (req, res) => {
    try {
        const orders = await Order.find({ userId: req.userId })
            .populate('restaurantId', 'name imageUrl')
            .sort({ createdAt: -1 });
        res.json(orders);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Get order by ID
router.get('/:id', auth, async (req, res) => {
    try {
        const order = await Order.findById(req.params.id)
            .populate('restaurantId userId');

        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        // Check if user owns this order or is admin
        if (order.userId._id.toString() !== req.userId && req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Not authorized' });
        }

        res.json(order);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Get order by ID (public for tracking)
router.get('/track/:id', async (req, res) => {
    try {
        const order = await Order.findById(req.params.id)
            .populate('restaurantId', 'name phone address');

        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        // Return limited information for public tracking
        const publicOrderData = {
            _id: order._id,
            status: order.status,
            items: order.items,
            totalAmount: order.totalAmount,
            restaurant: order.restaurantId,
            createdAt: order.createdAt,
            deliveryAddress: order.deliveryAddress,
            // Don't expose full user details or sensitive info
        };

        res.json(publicOrderData);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Update order status
router.put('/:id/status', auth, async (req, res) => {
    try {
        const { status, rejectedReason, prepEtaMinutes } = req.body;
        const order = await Order.findById(req.params.id);

        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        if (!ALLOWED_STATUS.has(status)) {
            return res.status(400).json({ message: 'Invalid status' });
        }

        // Authorization rules:
        // - admin can update any order
        // - restaurant can update orders of their restaurant
        // - rider/customer can only update their own orders (existing behavior)
        if (req.user.role === 'restaurant') {
            const restaurant = await Restaurant.findById(order.restaurantId);
            if (!restaurant) return res.status(404).json({ message: 'Restaurant not found' });
            if (restaurant.ownerId.toString() !== req.userId) {
                return res.status(403).json({ message: 'Not authorized' });
            }
        }

        if (req.user.role === 'restaurant_staff') {
            const staffRestaurantId = req.user.restaurantId?.toString();
            if (!staffRestaurantId || staffRestaurantId !== order.restaurantId.toString()) {
                return res.status(403).json({ message: 'Not authorized' });
            }
        }

        if (req.user.role !== 'admin' && req.user.role !== 'restaurant') {
            if (order.userId && order.userId.toString() !== req.userId) {
                return res.status(403).json({ message: 'Not authorized' });
            }
        }

        const prevStatus = order.status;

        if (!canTransition(order.status, status)) {
            return res.status(400).json({ message: `Invalid transition: ${order.status} → ${status}` });
        }

        // Extra fields for restaurant workflow
        if (status === 'cancelled') {
            order.rejectedReason = (rejectedReason || '').trim() || order.rejectedReason;
        }
        if (typeof prepEtaMinutes === 'number' && Number.isFinite(prepEtaMinutes)) {
            order.prepEtaMinutes = prepEtaMinutes;
        }

        order.status = status;
        await order.save();

        if (req.user.role === 'restaurant' || req.user.role === 'restaurant_staff' || req.user.role === 'admin') {
            await auditLog({
                restaurantId: order.restaurantId,
                actorUserId: req.userId,
                action: 'order.status.update',
                meta: { orderId: order._id, from: prevStatus, to: status, rejectedReason: order.rejectedReason, prepEtaMinutes: order.prepEtaMinutes }
            });
        }

        // Emit socket event for real-time update
        try {
            const io = req.app.get('socketio');
            if (io && order.userId) io.to(`user_${order.userId}`).emit('orderStatusUpdate', order);
            if (io && order.restaurantId) io.to(`restaurant_${order.restaurantId}`).emit('orderStatusUpdate', order);
        } catch (e) {
            // no-op
        }

        res.json(order);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Get all orders (admin only)
router.get('/admin/all', adminAuth, async (req, res) => {
    try {
        const orders = await Order.find()
            .populate('restaurantId userId')
            .sort({ createdAt: -1 });
        res.json(orders);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Get orders for a specific restaurant
router.get('/restaurant/:restaurantId', auth, async (req, res) => {
    try {
        if (req.user.role === 'restaurant_staff') {
            const staffRestaurantId = req.user.restaurantId?.toString();
            if (!staffRestaurantId || staffRestaurantId !== req.params.restaurantId) {
                return res.status(403).json({ message: 'Not authorized' });
            }
        }

        const orders = await Order.find({ restaurantId: req.params.restaurantId })
            .populate('userId', 'name email phone') // Populate user details
            .populate({ path: 'riderId', populate: { path: 'userId', select: 'name email phone' } })
            .sort({ createdAt: -1 });
        res.json(orders);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Restaurant: export recent orders as CSV
router.get('/restaurant/:restaurantId/export.csv', restaurantAuth, async (req, res) => {
    try {
        const restaurantId = req.params.restaurantId;
        const restaurant = await Restaurant.findById(restaurantId);
        if (!restaurant) return res.status(404).json({ message: 'Restaurant not found' });
        if (req.user.role !== 'admin' && restaurant.ownerId.toString() !== req.userId) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        const orders = await Order.find({ restaurantId }).sort({ createdAt: -1 }).limit(500).lean();

        const header = [
            'order_id',
            'created_at',
            'status',
            'total_amount',
            'delivery_fee',
            'payment_method',
            'customer_name',
            'customer_phone',
            'delivery_street',
            'delivery_city',
            'prep_eta_minutes',
            'rejected_reason'
        ];

        const escapeCsv = (value) => {
            const s = String(value ?? '');
            if (/[\",\n]/.test(s)) return `"${s.replace(/\"/g, '""')}"`;
            return s;
        };

        const lines = [header.join(',')];
        for (const o of orders) {
            const customerName = o.guestInfo?.name || '';
            const customerPhone = o.guestInfo?.phone || '';
            lines.push([
                o._id,
                o.createdAt ? new Date(o.createdAt).toISOString() : '',
                o.status,
                o.totalAmount,
                o.deliveryFee ?? 0,
                o.paymentMethod,
                customerName,
                customerPhone,
                o.deliveryAddress?.street || '',
                o.deliveryAddress?.city || '',
                o.prepEtaMinutes ?? '',
                o.rejectedReason ?? ''
            ].map(escapeCsv).join(','));
        }

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="orders_${restaurantId}.csv"`);
        res.send(lines.join('\n'));
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

module.exports = router;
