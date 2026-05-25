import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../context/ToastContext';
import api from '../utils/api';

import RestaurantBottomNav from '../components/restaurant/RestaurantBottomNav';
import RestaurantAppBar from '../components/restaurant/RestaurantAppBar';

const RestaurantDashboard = () => {
    const { user, logout, loading: authLoading } = useAuth();
    const navigate = useNavigate();
    const { addToast } = useToast();
    const [restaurant, setRestaurant] = useState(null);
    const [orders, setOrders] = useState([]);
    const [foodItems, setFoodItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('orders'); // 'orders', 'menu', or 'stats' (stats mobile only)
    const [mobileActiveColumn, setMobileActiveColumn] = useState('new'); // 'new', 'preparing', 'ready', 'out'
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [rejectModalOrder, setRejectModalOrder] = useState(null);
    const [rejectReason, setRejectReason] = useState('');
    const [etaMinutes, setEtaMinutes] = useState(25);
    const [stats, setStats] = useState(null);
    const [statsLoading, setStatsLoading] = useState(false);
    const [auditLogs, setAuditLogs] = useState([]);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [settingsForm, setSettingsForm] = useState(null);
    const [settingsSaving, setSettingsSaving] = useState(false);
    const [quickToggleSaving, setQuickToggleSaving] = useState(false);
    const [nowTs, setNowTs] = useState(Date.now());
    const prevPendingIdsRef = useRef(new Set());

    // Menu Item State
    const [showAddItemModal, setShowAddItemModal] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [newItem, setNewItem] = useState({
        name: '', description: '', price: '', category: '', imageUrl: '', isAvailable: true, isVegetarian: false, isVegan: false, isFeatured: false, stockCount: '', sortOrder: 0
    });
    const [menuSearch, setMenuSearch] = useState('');
    const [menuCategory, setMenuCategory] = useState('All');
    const [menuShowUnavailable, setMenuShowUnavailable] = useState(true);
    const [uploadingImage, setUploadingImage] = useState(false);
    const [selectedOrderIds, setSelectedOrderIds] = useState(() => new Set());
    const [selectMode, setSelectMode] = useState(false);

    // Keep hook order stable: derived values must be created via hooks before any conditional returns.
    const kanbanColumns = useMemo(() => {
        const list = Array.isArray(orders) ? orders : [];
        return {
            new: list.filter((o) => o.status === 'pending'),
            preparing: list.filter((o) => o.status === 'confirmed' || o.status === 'preparing'),
            ready: list.filter((o) => o.status === 'ready_for_pickup'),
            out: list.filter((o) => o.status === 'out_for_delivery')
        };
    }, [orders]);

    const headerCounts = useMemo(
        () => ({
            pending: kanbanColumns.new.length
        }),
        [kanbanColumns.new.length]
    );

    const notificationsMuted = useMemo(() => {
        const ts = restaurant?.notificationsMutedUntil ? new Date(restaurant.notificationsMutedUntil).getTime() : 0;
        return ts && ts > nowTs;
    }, [restaurant?.notificationsMutedUntil, nowTs]);

    useEffect(() => {
        if (authLoading) return;
        if (!user || user.role !== 'restaurant') {
            navigate('/');
            return;
        }
        fetchRestaurantData();
        const interval = setInterval(fetchOrders, 10000);
        return () => clearInterval(interval);
    }, [user, navigate, authLoading]);

    useEffect(() => {
        const id = setInterval(() => setNowTs(Date.now()), 1000 * 15);
        return () => clearInterval(id);
    }, []);

    useEffect(() => {
        if (!restaurant?._id) return;
        if (activeTab !== 'stats') return;

        const fetchStats = async () => {
            setStatsLoading(true);
            try {
                const res = await api.get(`/api/restaurants/stats/${restaurant._id}`);
                setStats(res.data);
                // best-effort activity feed for managers
                try {
                    const logsRes = await api.get(`/api/restaurants/audit/${restaurant._id}`);
                    setAuditLogs(Array.isArray(logsRes.data) ? logsRes.data : []);
                } catch {
                    setAuditLogs([]);
                }
            } catch (e) {
                addToast(e?.response?.data?.message || 'Failed to load stats', 'error');
            } finally {
                setStatsLoading(false);
            }
        };

        fetchStats();
    }, [activeTab, restaurant?._id]);

    const fetchRestaurantData = async () => {
        try {
            const restaurantsRes = await api.get('/api/restaurants');
            const myUserId = user?.id || user?._id;
            const myRestaurant = restaurantsRes.data.find((r) => String(r.ownerId) === String(myUserId));

            if (!myRestaurant) {
                addToast('No restaurant found for this account', 'error');
                return;
            }

            setRestaurant(myRestaurant);
            const [ordersRes, foodItemsRes] = await Promise.all([
                api.get(`/api/orders/restaurant/${myRestaurant._id}`),
                api.get(`/api/fooditems/restaurant/${myRestaurant._id}`)
            ]);

            setOrders(ordersRes.data);
            setFoodItems(foodItemsRes.data);
        } catch (error) {
            console.error('Error fetching restaurant data:', error);
            addToast('Failed to load restaurant data', 'error');
        } finally {
            setLoading(false);
        }
    };

    const openSettings = async () => {
        setSettingsOpen(true);
        try {
            const res = await api.get('/api/restaurants/me/mine');
            const r = res.data;
            setSettingsForm({
                isOpen: !!r.isOpen,
                deliveryFee: r.deliveryFee ?? 0,
                minimumOrder: r.minimumOrder ?? 0,
                deliveryTime: r.deliveryTime ?? 30,
                serviceProvince: r.serviceProvince || '',
                serviceCity: r.serviceCity || '',
                hours: Array.isArray(r.hours) && r.hours.length > 0 ? r.hours : [
                    { day: 'Mon', open: '10:00', close: '22:00', closed: false },
                    { day: 'Tue', open: '10:00', close: '22:00', closed: false },
                    { day: 'Wed', open: '10:00', close: '22:00', closed: false },
                    { day: 'Thu', open: '10:00', close: '22:00', closed: false },
                    { day: 'Fri', open: '10:00', close: '22:00', closed: false },
                    { day: 'Sat', open: '10:00', close: '22:00', closed: false },
                    { day: 'Sun', open: '10:00', close: '22:00', closed: false }
                ],
                notificationSoundEnabled: r.notificationSoundEnabled !== false,
                notificationsMutedUntil: r.notificationsMutedUntil || null
            });
        } catch (e) {
            addToast(e?.response?.data?.message || 'Failed to load settings', 'error');
        }
    };

    const saveSettings = async () => {
        if (!settingsForm) return;
        setSettingsSaving(true);
        try {
            await api.put('/api/restaurants/me/mine', {
                ...settingsForm,
                deliveryFee: parseFloat(settingsForm.deliveryFee || 0),
                minimumOrder: parseFloat(settingsForm.minimumOrder || 0),
                deliveryTime: parseInt(settingsForm.deliveryTime || 0, 10)
            });
            addToast('Settings saved', 'success');
            setSettingsOpen(false);
            fetchRestaurantData();
        } catch (e) {
            addToast(e?.response?.data?.message || 'Failed to save settings', 'error');
        } finally {
            setSettingsSaving(false);
        }
    };

    const toggleRestaurantOpen = async () => {
        if (!restaurant?._id || quickToggleSaving) return;
        const next = !restaurant.isOpen;
        setQuickToggleSaving(true);
        try {
            await api.put('/api/restaurants/me/mine', { isOpen: next });
            setRestaurant({ ...restaurant, isOpen: next });
            if (settingsForm) setSettingsForm({ ...settingsForm, isOpen: next });
            addToast(next ? 'Restaurant is now OPEN' : 'Restaurant is now CLOSED', 'success');
        } catch (e) {
            addToast(e?.response?.data?.message || 'Failed to update open/close', 'error');
        } finally {
            setQuickToggleSaving(false);
        }
    };

    const fetchOrders = async () => {
        if (!restaurant) return;
        try {
            const ordersRes = await api.get(`/api/orders/restaurant/${restaurant._id}`);
            setOrders(ordersRes.data);

            // Lightweight new-order notifications (poll-based)
            const pending = ordersRes.data.filter((o) => o.status === 'pending');
            const nextIds = new Set(pending.map((o) => o._id));
            const prevIds = prevPendingIdsRef.current;
            const hasNew = pending.length > 0 && Array.from(nextIds).some((id) => !prevIds.has(id));
            prevPendingIdsRef.current = nextIds;

            const mutedUntil = restaurant?.notificationsMutedUntil ? new Date(restaurant.notificationsMutedUntil).getTime() : 0;
            const muted = mutedUntil && mutedUntil > Date.now();
            const soundEnabled = restaurant?.notificationSoundEnabled !== false;

            if (hasNew && soundEnabled && !muted && restaurant?.isOpen !== false) {
                try {
                    const ctx = new (window.AudioContext || window.webkitAudioContext)();
                    const o = ctx.createOscillator();
                    const g = ctx.createGain();
                    o.type = 'sine';
                    o.frequency.value = 880;
                    g.gain.value = 0.03;
                    o.connect(g);
                    g.connect(ctx.destination);
                    o.start();
                    setTimeout(() => {
                        o.stop();
                        ctx.close();
                    }, 180);
                } catch {
                    // ignore audio failures
                }
            }
        } catch (error) {
            console.error('Error fetching orders:', error);
        }
    };

    const updateOrderStatus = async (orderId, newStatus) => {
        try {
            await api.put(`/api/orders/${orderId}/status`, { status: newStatus });
            addToast(`Order moved to ${newStatus.replace('_', ' ').toUpperCase()}`, 'success');
            fetchOrders();
        } catch (error) {
            console.error('Error updating order status:', error);
            addToast('Failed to update order status', 'error');
        }
    };

    const acceptOrder = async (order) => {
        try {
            await api.put(`/api/orders/${order._id}/status`, { status: 'confirmed', prepEtaMinutes: etaMinutes });
            addToast(`Accepted. ETA ${etaMinutes} min`, 'success');
            fetchOrders();
        } catch (error) {
            addToast(error?.response?.data?.message || 'Failed to accept order', 'error');
        }
    };

    const openReject = (order) => {
        setRejectModalOrder(order);
        setRejectReason('');
    };

    const rejectOrder = async () => {
        if (!rejectModalOrder) return;
        try {
            await api.put(`/api/orders/${rejectModalOrder._id}/status`, { status: 'cancelled', rejectedReason: rejectReason });
            addToast('Order declined', 'success');
            setRejectModalOrder(null);
            setRejectReason('');
            fetchOrders();
        } catch (error) {
            addToast(error?.response?.data?.message || 'Failed to decline order', 'error');
        }
    };

    const isSelected = (orderId) => selectedOrderIds.has(orderId);
    const toggleSelected = (orderId) => {
        setSelectedOrderIds((prev) => {
            const next = new Set(prev);
            if (next.has(orderId)) next.delete(orderId);
            else next.add(orderId);
            return next;
        });
    };

    const clearSelection = () => setSelectedOrderIds(new Set());

    const bulkUpdate = async (status) => {
        const ids = Array.from(selectedOrderIds);
        if (ids.length === 0) return;
        try {
            await Promise.all(ids.map((id) => api.put(`/api/orders/${id}/status`, { status })));
            addToast(`Updated ${ids.length} orders`, 'success');
            clearSelection();
            setSelectMode(false);
            fetchOrders();
        } catch (e) {
            addToast(e?.response?.data?.message || 'Bulk update failed', 'error');
        }
    };

    const printOrderTicket = (order) => {
        const safe = (s) => String(s ?? '');
        const lines = order.items.map((i) => `${i.quantity}x ${i.name}`).join('<br/>');
        const address = `${safe(order.deliveryAddress?.street)}<br/>${safe(order.deliveryAddress?.city)}`;
        const customer = safe(order.userId?.name || order.guestInfo?.name || 'Guest');
        const phone = safe(order.userId?.phone || order.guestInfo?.phone || '');
        const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Order Ticket</title>
  <style>
    body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial; margin: 16px; }
    h1 { font-size: 18px; margin: 0 0 8px; }
    .meta { font-size: 12px; color: #444; margin-bottom: 10px; }
    .section { margin: 12px 0; }
    .label { font-size: 10px; letter-spacing: .12em; text-transform: uppercase; color: #666; font-weight: 800; }
    .box { border: 1px solid #eee; border-radius: 12px; padding: 10px; margin-top: 6px; }
    .total { font-size: 16px; font-weight: 900; margin-top: 8px; }
    @media print { body { margin: 0; } }
  </style>
</head>
<body>
  <h1>${safe(restaurant?.name || 'Restaurant')} — Ticket</h1>
  <div class="meta">Order #${safe(order._id).slice(-6)} • ${new Date(order.createdAt).toLocaleString()}</div>
  <div class="section">
    <div class="label">Items</div>
    <div class="box">${lines}</div>
  </div>
  <div class="section">
    <div class="label">Customer</div>
    <div class="box">${customer}${phone ? `<br/>${phone}` : ''}</div>
  </div>
  <div class="section">
    <div class="label">Delivery</div>
    <div class="box">${address}</div>
  </div>
  <div class="section total">Total: $${Number(order.totalAmount || 0).toFixed(2)}</div>
  <script>window.print();</script>
</body>
</html>`;
        const w = window.open('', '_blank', 'width=420,height=600');
        if (!w) {
            addToast('Popup blocked. Allow popups to print.', 'error');
            return;
        }
        w.document.open();
        w.document.write(html);
        w.document.close();
    };

    const handleAddItem = async (e) => {
        e.preventDefault();
        try {
            const payload = {
                ...newItem,
                restaurantId: restaurant._id,
                price: parseFloat(newItem.price),
                stockCount: newItem.stockCount === '' ? undefined : parseInt(newItem.stockCount, 10),
                sortOrder: parseInt(newItem.sortOrder || 0, 10)
            };
            await api.post('/api/fooditems', payload);
            addToast('Menu item added successfully!', 'success');
            setShowAddItemModal(false);
            setNewItem({ name: '', description: '', price: '', category: '', imageUrl: '', isAvailable: true, isVegetarian: false, isVegan: false, isFeatured: false, stockCount: '', sortOrder: 0 });
            fetchRestaurantData();
        } catch (error) {
            console.error('Error adding item:', error);
            addToast('Failed to add menu item', 'error');
        }
    };

    const handleUpdateItem = async (e) => {
        e.preventDefault();
        try {
            const payload = {
                ...editingItem,
                price: parseFloat(editingItem.price),
                stockCount: editingItem.stockCount === '' ? undefined : parseInt(editingItem.stockCount, 10),
                sortOrder: parseInt(editingItem.sortOrder || 0, 10)
            };
            await api.put(`/api/fooditems/${editingItem._id}`, payload);
            addToast('Menu item updated successfully!', 'success');
            setEditingItem(null);
            fetchRestaurantData();
        } catch (error) {
            console.error('Error updating item:', error);
            addToast('Failed to update menu item', 'error');
        }
    };

    const uploadImage = async (file) => {
        if (!file) return;
        setUploadingImage(true);
        try {
            // Resize/compress client-side to improve upload speed and consistency
            const maxDim = 1280;
            const bitmap = await createImageBitmap(file);
            const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
            const w = Math.max(1, Math.round(bitmap.width * scale));
            const h = Math.max(1, Math.round(bitmap.height * scale));
            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(bitmap, 0, 0, w, h);
            const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.82));
            const optimizedFile = blob ? new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' }) : file;

            const form = new FormData();
            form.append('image', optimizedFile);
            const res = await api.post('/api/uploads/image', form, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            return res.data?.url;
        } finally {
            setUploadingImage(false);
        }
    };

    const uploadRestaurantLogo = async (file) => {
        try {
            const url = await uploadImage(file);
            if (!url) return;
            await api.put('/api/restaurants/me/mine', { imageUrl: url });
            setRestaurant({ ...restaurant, imageUrl: url });
            addToast('Logo updated', 'success');
        } catch (e) {
            addToast(e?.response?.data?.message || 'Logo upload failed', 'error');
        }
    };

    const handleDeleteItem = async (itemId) => {
        if (!window.confirm('Are you sure you want to delete this item?')) return;
        try {
            await api.delete(`/api/fooditems/${itemId}`);
            addToast('Menu item deleted successfully!', 'success');
            fetchRestaurantData();
        } catch (error) {
            console.error('Error deleting item:', error);
            addToast('Failed to delete menu item', 'error');
        }
    };

    const toggleItemAvailability = async (item) => {
        try {
            await api.put(`/api/fooditems/${item._id}`, { ...item, isAvailable: !item.isAvailable });
            addToast(`Item is now ${!item.isAvailable ? 'Available' : 'Unavailable'}`, 'success');
            fetchRestaurantData();
        } catch (error) {
            addToast('Failed to toggle availability', 'error');
        }
    };

    if (loading || authLoading) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 space-y-4">
                <div className="w-12 h-12 border-4 border-orange-200 border-t-orange-600 rounded-full animate-spin"></div>
                <p className="text-gray-500 font-medium animate-pulse">Loading Kitchen...</p>
            </div>
        );
    }

    if (!restaurant) return <div className="p-8 text-center text-gray-500">No Restaurant Found. Contact Support.</div>;

    // Analytics Calculation
    const todayOrders = orders.filter(o => new Date(o.createdAt).toDateString() === new Date().toDateString());
    const revenue = todayOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
    const pendingCount = orders.filter(o => o.status === 'pending').length;

    const toggleMute30m = async () => {
        const nextUntil = notificationsMuted ? null : new Date(Date.now() + 30 * 60 * 1000);
        try {
            await api.put('/api/restaurants/me/mine', { notificationsMutedUntil: nextUntil });
            setRestaurant({ ...restaurant, notificationsMutedUntil: nextUntil });
            addToast(notificationsMuted ? 'Notifications unmuted' : 'Muted for 30 min', 'success');
        } catch (e) {
            addToast(e?.response?.data?.message || 'Failed to update mute', 'error');
        }
    };

    const dueLabel = (order) => {
        const eta = order.prepEtaMinutes;
        if (!eta || (order.status !== 'confirmed' && order.status !== 'preparing')) return null;
        const base = new Date(order.updatedAt || order.createdAt).getTime();
        const due = base + eta * 60 * 1000;
        const diff = due - nowTs;
        const mins = Math.ceil(Math.abs(diff) / (60 * 1000));
        if (diff >= 0) return { text: `ETA ${mins}m`, late: false };
        return { text: `Late ${mins}m`, late: true };
    };

    const menuCategories = ['All', ...Array.from(new Set(foodItems.map((i) => (i.category || '').trim()).filter(Boolean)))];
    const filteredMenuItems = foodItems
        .filter((i) => (menuShowUnavailable ? true : i.isAvailable))
        .filter((i) => (menuCategory === 'All' ? true : (i.category || '').toLowerCase() === menuCategory.toLowerCase()))
        .filter((i) => {
            if (!menuSearch.trim()) return true;
            const q = menuSearch.toLowerCase();
            return (i.name || '').toLowerCase().includes(q) || (i.description || '').toLowerCase().includes(q);
        });

    return (
        <div className="min-h-screen bg-gray-50 font-sans pb-20">
            <RestaurantAppBar
                restaurant={restaurant}
                user={user}
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                onToggleOpen={toggleRestaurantOpen}
                toggleSaving={quickToggleSaving}
                onOpenSettings={openSettings}
                onLogout={logout}
                onUploadLogo={uploadRestaurantLogo}
                counts={headerCounts}
                onToggleMute={toggleMute30m}
                muted={notificationsMuted}
            />

            {/* --- ANALYTICS BAR --- */}
            <div className={`grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 px-4 md:px-8 py-6 max-w-7xl mx-auto ${(activeTab !== 'stats' && activeTab !== 'orders') && 'hidden md:grid'}`}>
                <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
                    <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-green-50 text-green-600 flex items-center justify-center text-xl md:text-2xl">💰</div>
                    <div>
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Revenue</p>
                        <p className="text-xl md:text-2xl font-black text-gray-900">${revenue.toFixed(2)}</p>
                    </div>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
                    <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-xl md:text-2xl">📦</div>
                    <div>
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Orders</p>
                        <p className="text-xl md:text-2xl font-black text-gray-900">{todayOrders.length}</p>
                    </div>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
                    <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-orange-50 text-orange-600 flex items-center justify-center text-xl md:text-2xl">🔔</div>
                    <div>
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Pending</p>
                        <p className="text-xl md:text-2xl font-black text-gray-900">{pendingCount}</p>
                    </div>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
                    <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center text-xl md:text-2xl">⭐</div>
                    <div>
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Rating</p>
                        <p className="text-xl md:text-2xl font-black text-gray-900">{restaurant.rating}</p>
                    </div>
                </div>
            </div>

            {/* --- MAIN CONTENT --- */}
            <div className="px-4 md:px-8 pb-12 max-w-7xl mx-auto">

                {/* 1. KANBAN BOARD VIEW */}
                {activeTab === 'orders' && (
                    <div className="flex flex-col gap-6">
                        <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => { setSelectMode((v) => !v); clearSelection(); }}
                                    className={`btn text-sm py-2 ${selectMode ? 'bg-orange-600 text-white hover:bg-orange-700' : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'}`}
                                >
                                    {selectMode ? 'Cancel Select' : 'Select Orders'}
                                </button>
                                {selectMode && (
                                    <span className="text-sm font-black text-gray-600">{selectedOrderIds.size} selected</span>
                                )}
                            </div>

                            {selectMode && (
                                <div className="flex flex-wrap gap-2 justify-end">
                                    <button onClick={() => bulkUpdate('confirmed')} className="btn bg-gray-900 text-white hover:bg-black text-sm py-2">Accept</button>
                                    <button onClick={() => bulkUpdate('preparing')} className="btn bg-blue-600 text-white hover:bg-blue-700 text-sm py-2">Cooking</button>
                                    <button onClick={() => bulkUpdate('ready_for_pickup')} className="btn bg-green-600 text-white hover:bg-green-700 text-sm py-2">Ready</button>
                                </div>
                            )}
                        </div>

                        {/* Mobile Column Switcher */}
                        <div className="flex md:hidden bg-gray-200/50 p-1.5 rounded-2xl gap-1 overflow-x-auto no-scrollbar">
                            {Object.keys(kanbanColumns).map(col => (
                                <button
                                    key={col}
                                    onClick={() => setMobileActiveColumn(col)}
                                    className={`flex-1 min-w-[100px] py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${mobileActiveColumn === col ? 'bg-white text-gray-900 shadow-md scale-[1.02]' : 'text-gray-500'}`}
                                >
                                    {col} ({kanbanColumns[col].length})
                                </button>
                            ))}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 h-auto md:h-[calc(100vh-250px)]">
                            {/* Column: New */}
                            <div className={`bg-gray-100/50 rounded-3xl p-4 flex flex-col ${mobileActiveColumn !== 'new' && 'hidden md:flex'}`}>
                                <div className="hidden md:flex items-center justify-between mb-4 px-2">
                                    <h3 className="font-bold text-gray-700">New Orders</h3>
                                    <span className="bg-orange-100 text-orange-700 text-xs font-bold px-2 py-1 rounded-full">{kanbanColumns.new.length}</span>
                                </div>
                                <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar">
                                    {kanbanColumns.new.map(order => (
                                        <button
                                            type="button"
                                            key={order._id}
                                            onClick={() => setSelectedOrder(order)}
                                            className="text-left bg-white p-5 rounded-2xl shadow-sm border-l-4 border-orange-500 animate-in fade-in slide-in-from-bottom-2 hover:shadow-md transition-shadow"
                                        >
                                            {selectMode && (
                                                <div className="flex items-center justify-between mb-3">
                                                    <label className="flex items-center gap-2">
                                                        <input
                                                            type="checkbox"
                                                            checked={isSelected(order._id)}
                                                            onChange={(e) => { e.stopPropagation(); toggleSelected(order._id); }}
                                                            className="w-5 h-5 rounded text-orange-600 focus:ring-orange-500"
                                                        />
                                                        <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">Select</span>
                                                    </label>
                                                    <button
                                                        type="button"
                                                        onClick={(e) => { e.stopPropagation(); printOrderTicket(order); }}
                                                        className="text-[10px] font-black uppercase tracking-widest px-3 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700"
                                                    >
                                                        Print
                                                    </button>
                                                </div>
                                            )}
                                            <div className="flex justify-between items-start mb-3">
                                                <span className="font-mono text-[10px] bg-gray-100 px-2 py-1 rounded text-gray-500 uppercase">#{order._id.slice(-4)}</span>
                                                <span className="text-xs font-black text-orange-600">{new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                            </div>
                                            <div className="space-y-2 mb-4">
                                                {order.items.map((item, i) => (
                                                    <div key={i} className="text-sm font-bold text-gray-800 flex justify-between">
                                                        <span>{item.quantity}x {item.name}</span>
                                                    </div>
                                                ))}
                                            </div>
                                            <div className="flex justify-between items-center mb-4">
                                                <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Total Value</span>
                                                <p className="font-black text-gray-900 text-xl">${order.totalAmount.toFixed(2)}</p>
                                            </div>
                                            <div className="grid grid-cols-2 gap-3">
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); acceptOrder(order); }}
                                                    className="bg-gray-900 text-white py-3 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-black transition-all"
                                                >
                                                    Accept
                                                </button>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); openReject(order); }}
                                                    className="bg-white border border-gray-200 text-red-500 py-3 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-red-50 transition-all"
                                                >
                                                    Decline
                                                </button>
                                            </div>
                                        </button>
                                    ))}
                                    {kanbanColumns.new.length === 0 && <div className="text-center py-12 text-gray-400 text-xs font-black uppercase tracking-[0.2em] border-2 border-dashed border-gray-200 rounded-2xl">No new orders</div>}
                                </div>
                            </div>

                            {/* Column: Kitchen */}
                            <div className={`bg-gray-100/50 rounded-3xl p-4 flex flex-col ${mobileActiveColumn !== 'preparing' && 'hidden md:flex'}`}>
                                <div className="hidden md:flex items-center justify-between mb-4 px-2">
                                    <h3 className="font-bold text-gray-700">Kitchen</h3>
                                    <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-1 rounded-full">{kanbanColumns.preparing.length}</span>
                                </div>
                                <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar">
                                    {kanbanColumns.preparing.map(order => (
                                        <button
                                            type="button"
                                            key={order._id}
                                            onClick={() => setSelectedOrder(order)}
                                            className="text-left w-full bg-white p-5 rounded-2xl shadow-sm border-l-4 border-blue-500 hover:shadow-md transition-shadow"
                                        >
                                            {selectMode && (
                                                <div className="flex items-center justify-between mb-3">
                                                    <label className="flex items-center gap-2">
                                                        <input
                                                            type="checkbox"
                                                            checked={isSelected(order._id)}
                                                            onChange={(e) => { e.stopPropagation(); toggleSelected(order._id); }}
                                                            className="w-5 h-5 rounded text-blue-600 focus:ring-blue-500"
                                                        />
                                                        <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">Select</span>
                                                    </label>
                                                    <button
                                                        type="button"
                                                        onClick={(e) => { e.stopPropagation(); printOrderTicket(order); }}
                                                        className="text-[10px] font-black uppercase tracking-widest px-3 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700"
                                                    >
                                                        Print
                                                    </button>
                                                </div>
                                            )}
                                            <div className="flex justify-between items-start mb-3">
                                                <span className="font-mono text-[10px] bg-gray-100 px-2 py-1 rounded text-gray-500 uppercase">#{order._id.slice(-4)}</span>
                                                <div className="flex items-center gap-2">
                                                    {dueLabel(order) && (
                                                        <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-full border ${dueLabel(order).late ? 'bg-red-50 text-red-700 border-red-100' : 'bg-blue-50 text-blue-700 border-blue-100'}`}>
                                                            {dueLabel(order).text}
                                                        </span>
                                                    )}
                                                    <span className="text-xs font-black text-blue-600 uppercase tracking-widest">{order.status === 'confirmed' ? 'Queued' : 'Cooking'}</span>
                                                </div>
                                            </div>
                                            <div className="space-y-2 mb-4 opacity-80">
                                                {order.items.map((item, i) => (
                                                    <div key={i} className="text-sm font-bold text-gray-800 flex justify-between">
                                                        <span>{item.quantity}x {item.name}</span>
                                                    </div>
                                                ))}
                                            </div>
                                            <button onClick={() => updateOrderStatus(order._id, 'ready_for_pickup')} className="w-full bg-blue-600 text-white py-3.5 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20">
                                                Mark Ready 🔔
                                            </button>
                                        </button>
                                    ))}
                                    {kanbanColumns.preparing.length === 0 && <div className="text-center py-12 text-gray-400 text-xs font-black uppercase tracking-[0.2em] border-2 border-dashed border-gray-200 rounded-2xl">Kitchen Clear</div>}
                                </div>
                            </div>

                            {/* Column: Ready */}
                            <div className={`bg-gray-100/50 rounded-3xl p-4 flex flex-col ${mobileActiveColumn !== 'ready' && 'hidden md:flex'}`}>
                                <div className="hidden md:flex items-center justify-between mb-4 px-2">
                                    <h3 className="font-bold text-gray-700">Ready</h3>
                                    <span className="bg-green-100 text-green-700 text-xs font-bold px-2 py-1 rounded-full">{kanbanColumns.ready.length}</span>
                                </div>
                                <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar">
                                    {kanbanColumns.ready.map(order => (
                                        <button
                                            type="button"
                                            key={order._id}
                                            onClick={() => setSelectedOrder(order)}
                                            className="text-left w-full bg-white p-5 rounded-2xl shadow-sm border-l-4 border-green-500 opacity-90 hover:shadow-md transition-shadow"
                                        >
                                            {selectMode && (
                                                <div className="flex items-center justify-between mb-3">
                                                    <label className="flex items-center gap-2">
                                                        <input
                                                            type="checkbox"
                                                            checked={isSelected(order._id)}
                                                            onChange={(e) => { e.stopPropagation(); toggleSelected(order._id); }}
                                                            className="w-5 h-5 rounded text-green-600 focus:ring-green-500"
                                                        />
                                                        <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">Select</span>
                                                    </label>
                                                    <button
                                                        type="button"
                                                        onClick={(e) => { e.stopPropagation(); printOrderTicket(order); }}
                                                        className="text-[10px] font-black uppercase tracking-widest px-3 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700"
                                                    >
                                                        Print
                                                    </button>
                                                </div>
                                            )}
                                            <div className="flex justify-between items-start mb-3">
                                                <span className="font-mono text-[10px] bg-gray-100 px-2 py-1 rounded text-gray-500 uppercase">#{order._id.slice(-4)}</span>
                                                <span className="text-xs font-black text-green-600 uppercase tracking-widest">Ready</span>
                                            </div>
                                            <p className="text-sm font-black text-gray-800 mb-4">{order.items.length} Items Packed</p>
                                            <div className="py-3 bg-green-50 text-green-700 text-[10px] font-black uppercase tracking-widest rounded-xl text-center border border-green-100">
                                                Awaiting Rider
                                            </div>
                                        </button>
                                    ))}
                                    {kanbanColumns.ready.length === 0 && <div className="text-center py-12 text-gray-400 text-xs font-black uppercase tracking-[0.2em] border-2 border-dashed border-gray-200 rounded-2xl">No units ready</div>}
                                </div>
                            </div>

                            {/* Column: Out */}
                            <div className={`bg-gray-100/50 rounded-3xl p-4 flex flex-col ${mobileActiveColumn !== 'out' && 'hidden md:flex'}`}>
                                <div className="hidden md:flex items-center justify-between mb-4 px-2">
                                    <h3 className="font-bold text-gray-700">On the Way</h3>
                                    <span className="bg-purple-100 text-purple-700 text-xs font-bold px-2 py-1 rounded-full">{kanbanColumns.out.length}</span>
                                </div>
                                <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar">
                                    {kanbanColumns.out.map(order => (
                                        <button
                                            type="button"
                                            key={order._id}
                                            onClick={() => setSelectedOrder(order)}
                                            className="text-left w-full bg-white p-5 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
                                        >
                                            {selectMode && (
                                                <div className="flex items-center justify-between mb-3">
                                                    <label className="flex items-center gap-2">
                                                        <input
                                                            type="checkbox"
                                                            checked={isSelected(order._id)}
                                                            onChange={(e) => { e.stopPropagation(); toggleSelected(order._id); }}
                                                            className="w-5 h-5 rounded text-purple-600 focus:ring-purple-500"
                                                        />
                                                        <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">Select</span>
                                                    </label>
                                                    <button
                                                        type="button"
                                                        onClick={(e) => { e.stopPropagation(); printOrderTicket(order); }}
                                                        className="text-[10px] font-black uppercase tracking-widest px-3 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700"
                                                    >
                                                        Print
                                                    </button>
                                                </div>
                                            )}
                                            <div className="flex justify-between items-start mb-4">
                                                <span className="font-mono text-[10px] bg-gray-100 px-2 py-1 rounded text-gray-500 uppercase">#{order._id.slice(-4)}</span>
                                                <span className="text-xs font-black text-purple-600 uppercase tracking-widest">En Route</span>
                                            </div>
                                            <div className="flex items-center gap-3 p-3 bg-purple-50 rounded-2xl border border-purple-100">
                                                <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-xl shadow-sm">🛵</div>
                                                <div>
                                                    <p className="text-[10px] font-black text-purple-400 uppercase leading-none mb-1">Assigned Rider</p>
                                                    <p className="text-sm font-black text-gray-900">{order.riderId?.userId?.name || 'Rider-449'}</p>
                                                </div>
                                            </div>
                                        </button>
                                    ))}
                                    {kanbanColumns.out.length === 0 && <div className="text-center py-12 text-gray-400 text-xs font-black uppercase tracking-[0.2em] border-2 border-dashed border-gray-200 rounded-2xl">No active deliveries</div>}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* 2. MENU MANAGER VIEW */}
                {activeTab === 'menu' && (
                    <div className="animate-in fade-in zoom-in-95 duration-300">
                        <div className="flex justify-between items-center mb-8 px-1">
                            <div>
                                <h2 className="text-2xl font-black text-gray-900">Menu items</h2>
                                <p className="text-gray-400 text-sm font-bold uppercase tracking-widest leading-none mt-1">
                                    {filteredMenuItems.length} items
                                </p>
                            </div>
                            <button onClick={() => setShowAddItemModal(true)} className="bg-gray-900 text-white w-12 h-12 md:w-auto md:px-6 md:py-3 rounded-2xl font-bold shadow-xl hover:bg-black transition-all flex items-center justify-center gap-2">
                                <span className="text-2xl leading-none">+</span> <span className="hidden md:inline">Add Dish</span>
                            </button>
                        </div>

                        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-4 md:p-5 mb-6 flex flex-col md:flex-row gap-4 md:items-center md:justify-between">
                            <input
                                value={menuSearch}
                                onChange={(e) => setMenuSearch(e.target.value)}
                                className="input-field flex-1"
                                placeholder="Search menu items..."
                            />
                            <div className="flex gap-3">
                                <select
                                    value={menuCategory}
                                    onChange={(e) => setMenuCategory(e.target.value)}
                                    className="input-field !py-3 !rounded-2xl w-full md:w-52"
                                >
                                    {menuCategories.map((c) => (
                                        <option key={c} value={c}>{c}</option>
                                    ))}
                                </select>
                                <button
                                    type="button"
                                    onClick={() => setMenuShowUnavailable((v) => !v)}
                                    className={`btn ${menuShowUnavailable ? 'bg-gray-100 text-gray-800 hover:bg-gray-200' : 'bg-green-50 text-green-700 hover:bg-green-100'} text-sm py-2`}
                                    title="Toggle showing disabled items"
                                >
                                    {menuShowUnavailable ? 'Hide Disabled' : 'Show Disabled'}
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                            {filteredMenuItems.map(item => (
                                <div key={item._id} className={`bg-white rounded-[2.5rem] p-4 border transition-all flex flex-col ${!item.isAvailable ? 'border-gray-200 opacity-60 grayscale' : 'border-gray-100 hover:shadow-2xl hover:shadow-orange-500/10 hover:-translate-y-1'}`}>
                                    <div className="relative h-48 mb-6 rounded-3xl overflow-hidden group">
                                        <img src={item.imageUrl || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500'} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" alt={item.name} />
                                        <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => setEditingItem(item)} className="w-full bg-white py-2 rounded-xl shadow-sm hover:bg-gray-50 text-gray-900 font-black text-[10px] uppercase tracking-widest transition-all">Quick Edit</button>
                                        </div>
                                        {item.isFeatured && (
                                            <div className="absolute top-3 left-3 px-2 py-1 rounded-full bg-orange-600 text-white text-[10px] font-black uppercase tracking-widest shadow-lg">
                                                Featured
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex justify-between items-start mb-3 px-1">
                                        <h3 className="font-black text-gray-900 text-lg leading-tight flex-1 pr-2">{item.name}</h3>
                                        <span className="font-black text-green-600 bg-green-50 px-3 py-1 rounded-full border border-green-100">${item.price.toFixed(2)}</span>
                                    </div>
                                    <p className="text-sm text-gray-400 font-medium line-clamp-2 mb-6 h-10 px-1">{item.description}</p>
                                    <div className="flex flex-wrap gap-2 px-1 mb-4">
                                        {item.category && <span className="badge bg-gray-100 text-gray-700 text-[10px]">{item.category}</span>}
                                        {typeof item.stockCount === 'number' && (
                                            <span className={`badge text-[10px] ${item.stockCount === 0 ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700'}`}>
                                                Stock: {item.stockCount}
                                            </span>
                                        )}
                                    </div>

                                    <div className="flex gap-2 mt-auto">
                                        <button
                                            onClick={() => api.put(`/api/fooditems/${item._id}`, { isFeatured: !item.isFeatured }).then(fetchRestaurantData)}
                                            className={`w-12 h-12 flex items-center justify-center rounded-2xl border shadow-sm transition-all ${item.isFeatured ? 'bg-orange-50 border-orange-100 text-orange-600 hover:bg-orange-100' : 'bg-gray-50 border-gray-100 text-gray-500 hover:bg-gray-100'}`}
                                            title="Toggle featured"
                                        >
                                            ★
                                        </button>
                                        <button
                                            onClick={async () => {
                                                const current = parseInt(item.sortOrder || 0, 10);
                                                await api.put(`/api/fooditems/${item._id}`, { sortOrder: current - 1 });
                                                fetchRestaurantData();
                                            }}
                                            className="w-12 h-12 flex items-center justify-center bg-gray-50 rounded-2xl text-gray-500 hover:bg-gray-100 transition-all border border-gray-100 shadow-sm"
                                            title="Move up"
                                        >
                                            ↑
                                        </button>
                                        <button
                                            onClick={async () => {
                                                const current = parseInt(item.sortOrder || 0, 10);
                                                await api.put(`/api/fooditems/${item._id}`, { sortOrder: current + 1 });
                                                fetchRestaurantData();
                                            }}
                                            className="w-12 h-12 flex items-center justify-center bg-gray-50 rounded-2xl text-gray-500 hover:bg-gray-100 transition-all border border-gray-100 shadow-sm"
                                            title="Move down"
                                        >
                                            ↓
                                        </button>
                                        <button
                                            onClick={() => toggleItemAvailability(item)}
                                            className={`flex-1 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${item.isAvailable ? 'bg-red-50 text-red-500 hover:bg-red-500 hover:text-white' : 'bg-green-50 text-green-500 hover:bg-green-500 hover:text-white'}`}
                                        >
                                            {item.isAvailable ? 'Disable' : 'Enable'}
                                        </button>
                                        <button
                                            onClick={() => handleDeleteItem(item._id)}
                                            className="w-12 h-12 flex items-center justify-center bg-gray-50 rounded-2xl text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all border border-gray-100 shadow-sm"
                                        >
                                            🗑️
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* 3. STATS VIEW */}
                {activeTab === 'stats' && (
                    <div className="animate-in fade-in zoom-in-95 duration-300">
                        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8 px-1">
                            <div>
                                <h2 className="text-2xl font-black text-gray-900">Analytics</h2>
                                <p className="text-gray-400 text-sm font-bold uppercase tracking-widest leading-none mt-1">Last 7 days</p>
                            </div>
                            <div className="flex gap-3">
                                <button
                                    type="button"
                                    onClick={async () => {
                                        try {
                                            const res = await api.get(`/api/orders/restaurant/${restaurant._id}/export.csv`, { responseType: 'blob' });
                                            const blobUrl = window.URL.createObjectURL(new Blob([res.data], { type: 'text/csv' }));
                                            const a = document.createElement('a');
                                            a.href = blobUrl;
                                            a.download = `orders_${restaurant._id}.csv`;
                                            document.body.appendChild(a);
                                            a.click();
                                            a.remove();
                                            window.URL.revokeObjectURL(blobUrl);
                                        } catch (e) {
                                            addToast(e?.response?.data?.message || 'CSV export failed', 'error');
                                        }
                                    }}
                                    className="btn bg-gray-900 text-white hover:bg-black text-sm py-2"
                                >
                                    Download CSV
                                </button>
                            </div>
                        </div>

                        {statsLoading ? (
                            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-8 text-gray-500 font-bold">
                                Loading analytics…
                            </div>
                        ) : !stats ? (
                            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-8 text-gray-500 font-bold">
                                No analytics available yet.
                            </div>
                        ) : (
                            <div className="grid lg:grid-cols-3 gap-6">
                                <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Today</p>
                                    <p className="text-3xl font-black text-gray-900 mt-2">${(stats.today?.revenue || 0).toFixed(2)}</p>
                                    <p className="text-sm font-bold text-gray-500 mt-2">{stats.today?.orders || 0} orders</p>
                                </div>
                                <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Week</p>
                                    <p className="text-3xl font-black text-gray-900 mt-2">${(stats.week?.revenue || 0).toFixed(2)}</p>
                                    <p className="text-sm font-bold text-gray-500 mt-2">{stats.week?.orders || 0} orders</p>
                                </div>
                                <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Status</p>
                                    <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                                        {['pending', 'confirmed', 'preparing', 'ready_for_pickup', 'out_for_delivery', 'delivered', 'cancelled'].map((k) => (
                                            <div key={k} className="flex items-center justify-between bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3">
                                                <span className="font-black text-gray-700">{k.replaceAll('_', ' ')}</span>
                                                <span className="font-black text-gray-900">{stats.counts?.[k] || 0}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 lg:col-span-2">
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Revenue trend</p>
                                    <div className="mt-4 grid grid-cols-7 gap-2 items-end h-32">
                                        {stats.chart?.map((d, idx) => {
                                            const max = Math.max(...stats.chart.map(x => x.revenue || 0), 1);
                                            const h = Math.max(8, Math.round(((d.revenue || 0) / max) * 120));
                                            return (
                                                <div key={idx} className="flex flex-col items-center gap-2">
                                                    <div className="w-full bg-orange-100 rounded-xl overflow-hidden">
                                                        <div className="bg-orange-600 rounded-xl" style={{ height: `${h}px` }} />
                                                    </div>
                                                    <span className="text-[10px] font-black text-gray-500">{d.day}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Top items</p>
                                    <div className="mt-4 space-y-3">
                                        {(stats.topItems || []).length === 0 ? (
                                            <p className="text-sm font-bold text-gray-500">No sales yet.</p>
                                        ) : (
                                            stats.topItems.map((it) => (
                                                <div key={it._id} className="flex items-center justify-between bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3">
                                                    <div className="min-w-0">
                                                        <p className="font-black text-gray-900 truncate">{it._id}</p>
                                                        <p className="text-xs font-bold text-gray-500">{it.qty} sold</p>
                                                    </div>
                                                    <p className="font-black text-gray-900">${(it.sales || 0).toFixed(2)}</p>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>

                                <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 lg:col-span-3">
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Recent activity</p>
                                    <div className="mt-4 space-y-3">
                                        {auditLogs.length === 0 ? (
                                            <p className="text-sm font-bold text-gray-500">No activity yet.</p>
                                        ) : (
                                            auditLogs.slice(0, 12).map((l) => (
                                                <div key={l._id} className="flex items-start justify-between gap-3 bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3">
                                                    <div className="min-w-0">
                                                        <p className="font-black text-gray-900 truncate">{l.action.replaceAll('.', ' ')}</p>
                                                        <p className="text-xs font-bold text-gray-500 mt-1">
                                                            {(l.actorUserId?.name || l.actorUserId?.email || 'Someone')} • {new Date(l.createdAt).toLocaleString()}
                                                        </p>
                                                    </div>
                                                    <span className="text-[10px] font-black text-gray-500 bg-white border border-gray-200 px-2 py-1 rounded-full">
                                                        {l.actorUserId?.role || '—'}
                                                    </span>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Mobile Bottom Navigation */}
            <RestaurantBottomNav activeTab={activeTab} setActiveTab={setActiveTab} />

            {/* --- MODALS --- */}
            {(showAddItemModal || editingItem) && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl p-8 max-w-lg w-full shadow-2xl">
                        <h2 className="text-2xl font-black text-gray-900 mb-6">{editingItem ? 'Edit Item' : 'New Dish'}</h2>
                        <form onSubmit={editingItem ? handleUpdateItem : handleAddItem} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-gray-500 uppercase">Name</label>
                                    <input className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900"
                                        value={editingItem ? editingItem.name : newItem.name}
                                        onChange={e => (editingItem ? setEditingItem({ ...editingItem, name: e.target.value }) : setNewItem({ ...newItem, name: e.target.value }))}
                                        required
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-gray-500 uppercase">Price</label>
                                    <input className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900"
                                        type="number" step="0.01"
                                        value={editingItem ? editingItem.price : newItem.price}
                                        onChange={e => (editingItem ? setEditingItem({ ...editingItem, price: e.target.value }) : setNewItem({ ...newItem, price: e.target.value }))}
                                        required
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-gray-500 uppercase">Category</label>
                                    <input
                                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900"
                                        value={editingItem ? (editingItem.category || '') : newItem.category}
                                        onChange={e => (editingItem ? setEditingItem({ ...editingItem, category: e.target.value }) : setNewItem({ ...newItem, category: e.target.value }))}
                                        placeholder="e.g. Pizza, BBQ, Desserts"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-gray-500 uppercase">Sort Order</label>
                                    <input
                                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900"
                                        type="number"
                                        value={editingItem ? (editingItem.sortOrder ?? 0) : newItem.sortOrder}
                                        onChange={e => (editingItem ? setEditingItem({ ...editingItem, sortOrder: e.target.value }) : setNewItem({ ...newItem, sortOrder: e.target.value }))}
                                    />
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-bold text-gray-500 uppercase">Description</label>
                                <textarea className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900"
                                    rows="3"
                                    value={editingItem ? editingItem.description : newItem.description}
                                    onChange={e => (editingItem ? setEditingItem({ ...editingItem, description: e.target.value }) : setNewItem({ ...newItem, description: e.target.value }))}
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-bold text-gray-500 uppercase">Image URL</label>
                                <input className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900"
                                    value={editingItem ? editingItem.imageUrl : newItem.imageUrl}
                                    onChange={e => (editingItem ? setEditingItem({ ...editingItem, imageUrl: e.target.value }) : setNewItem({ ...newItem, imageUrl: e.target.value }))}
                                />
                                <div className="flex items-center justify-between gap-3 mt-2">
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={async (e) => {
                                            const file = e.target.files?.[0];
                                            if (!file) return;
                                            try {
                                                const url = await uploadImage(file);
                                                if (url) {
                                                    if (editingItem) setEditingItem({ ...editingItem, imageUrl: url });
                                                    else setNewItem({ ...newItem, imageUrl: url });
                                                }
                                            } catch (err) {
                                                addToast(err?.response?.data?.message || 'Image upload failed', 'error');
                                            } finally {
                                                e.target.value = '';
                                            }
                                        }}
                                        className="block w-full text-sm font-bold text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:bg-gray-200 file:text-gray-900 hover:file:bg-gray-300"
                                    />
                                    {uploadingImage && <span className="text-xs font-black text-gray-500 whitespace-nowrap">Uploading…</span>}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 py-2">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        className="w-5 h-5 rounded text-orange-600 focus:ring-orange-500"
                                        checked={editingItem ? !!editingItem.isFeatured : !!newItem.isFeatured}
                                        onChange={e => (editingItem ? setEditingItem({ ...editingItem, isFeatured: e.target.checked }) : setNewItem({ ...newItem, isFeatured: e.target.checked }))}
                                    />
                                    <span className="font-bold text-gray-700 text-sm">Featured</span>
                                </label>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-gray-500 uppercase">Stock</label>
                                    <input
                                        type="number"
                                        min="0"
                                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900"
                                        value={editingItem ? (editingItem.stockCount ?? '') : newItem.stockCount}
                                        onChange={e => (editingItem ? setEditingItem({ ...editingItem, stockCount: e.target.value }) : setNewItem({ ...newItem, stockCount: e.target.value }))}
                                        placeholder="optional"
                                    />
                                </div>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input type="checkbox" className="w-5 h-5 rounded text-green-600 focus:ring-green-500"
                                        checked={editingItem ? editingItem.isVegetarian : newItem.isVegetarian}
                                        onChange={e => (editingItem ? setEditingItem({ ...editingItem, isVegetarian: e.target.checked }) : setNewItem({ ...newItem, isVegetarian: e.target.checked }))}
                                    />
                                    <span className="font-bold text-gray-700 text-sm">Vegetarian</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input type="checkbox" className="w-5 h-5 rounded text-green-600 focus:ring-green-500"
                                        checked={editingItem ? editingItem.isVegan : newItem.isVegan}
                                        onChange={e => (editingItem ? setEditingItem({ ...editingItem, isVegan: e.target.checked }) : setNewItem({ ...newItem, isVegan: e.target.checked }))}
                                    />
                                    <span className="font-bold text-gray-700 text-sm">Vegan</span>
                                </label>
                            </div>

                            <div className="flex gap-3 pt-4 border-t border-gray-100">
                                <button type="button" onClick={() => { setShowAddItemModal(false); setEditingItem(null) }} className="flex-1 py-3 rounded-xl font-bold text-gray-500 hover:bg-gray-100 transition-colors">Cancel</button>
                                <button type="submit" className="flex-1 bg-gray-900 text-white py-3 rounded-xl font-bold hover:bg-gray-800 transition-colors shadow-lg">Save Item</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Reject Reason Modal */}
            {rejectModalOrder && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl p-8 max-w-lg w-full shadow-2xl">
                        <h2 className="text-2xl font-black text-gray-900 mb-2">Decline order</h2>
                        <p className="text-gray-500 font-medium mb-6">Add a reason so the customer understands.</p>
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-500 uppercase">Reason</label>
                            <textarea
                                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900"
                                rows="3"
                                value={rejectReason}
                                onChange={(e) => setRejectReason(e.target.value)}
                                placeholder="e.g. Out of stock, kitchen closed, too busy..."
                            />
                        </div>
                        <div className="flex gap-3 pt-6">
                            <button
                                type="button"
                                onClick={() => { setRejectModalOrder(null); setRejectReason(''); }}
                                className="flex-1 py-3 rounded-xl font-bold text-gray-500 hover:bg-gray-100 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={rejectOrder}
                                className="flex-1 bg-red-600 text-white py-3 rounded-xl font-bold hover:bg-red-700 transition-colors shadow-lg shadow-red-500/20"
                            >
                                Decline
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Order Detail Drawer */}
            {selectedOrder && (
                <div className="fixed inset-0 z-50">
                    <div className="absolute inset-0 bg-gray-900/50" onClick={() => setSelectedOrder(null)} />
                    <div className="absolute right-0 top-0 h-full w-full sm:w-[520px] bg-white shadow-2xl border-l border-gray-100 overflow-y-auto">
                        <div className="p-6 border-b border-gray-100 flex items-start justify-between gap-4">
                            <div>
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Order</p>
                                <h3 className="text-2xl font-black text-gray-900">#{selectedOrder._id.slice(-6)}</h3>
                                <p className="text-sm font-bold text-gray-500 mt-1">
                                    {new Date(selectedOrder.createdAt).toLocaleString()}
                                </p>
                            </div>
                            <button
                                onClick={() => setSelectedOrder(null)}
                                className="w-10 h-10 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-black"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="p-6 space-y-6">
                            <div className="flex items-center justify-between gap-3">
                                <div className="px-3 py-1.5 rounded-full bg-gray-100 text-gray-700 text-xs font-black uppercase tracking-widest">
                                    {selectedOrder.status?.replaceAll('_', ' ') || 'status'}
                                </div>
                                <div className="flex items-center gap-2">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">ETA</label>
                                    <input
                                        type="number"
                                        min="0"
                                        className="w-20 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 font-black text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900"
                                        value={etaMinutes}
                                        onChange={(e) => setEtaMinutes(parseInt(e.target.value || '0', 10))}
                                    />
                                    <span className="text-xs font-bold text-gray-500">min</span>
                                </div>
                            </div>

                            <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Customer</p>
                                <p className="font-black text-gray-900">
                                    {selectedOrder.userId?.name || selectedOrder.guestInfo?.name || 'Guest'}
                                </p>
                                <p className="text-sm font-bold text-gray-600 mt-1">
                                    {selectedOrder.userId?.phone || selectedOrder.guestInfo?.phone || '—'}
                                </p>
                            </div>

                            <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Delivery</p>
                                <p className="text-sm font-bold text-gray-800">
                                    {selectedOrder.deliveryAddress?.street || '—'}
                                </p>
                                <p className="text-sm font-bold text-gray-600">
                                    {selectedOrder.deliveryAddress?.city || '—'}
                                </p>
                            </div>

                            <div>
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Items</p>
                                <div className="space-y-2">
                                    {selectedOrder.items.map((it, idx) => (
                                        <div key={idx} className="flex items-center justify-between bg-white rounded-2xl border border-gray-100 p-4">
                                            <div className="min-w-0">
                                                <p className="font-black text-gray-900 truncate">{it.quantity}x {it.name}</p>
                                                <p className="text-xs font-bold text-gray-400">${(it.price || 0).toFixed(2)} each</p>
                                            </div>
                                            <p className="font-black text-gray-900">${((it.price || 0) * it.quantity).toFixed(2)}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="flex items-center justify-between bg-gray-900 text-white rounded-2xl p-4">
                                <p className="text-xs font-black uppercase tracking-widest opacity-80">Total</p>
                                <p className="text-2xl font-black">${selectedOrder.totalAmount.toFixed(2)}</p>
                            </div>

                            {selectedOrder.rejectedReason && (
                                <div className="bg-red-50 border border-red-100 rounded-2xl p-4">
                                    <p className="text-[10px] font-black text-red-400 uppercase tracking-widest mb-2">Decline Reason</p>
                                    <p className="text-sm font-bold text-red-700">{selectedOrder.rejectedReason}</p>
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-3">
                                {selectedOrder.status === 'pending' && (
                                    <>
                                        <button onClick={() => acceptOrder(selectedOrder)} className="bg-gray-900 text-white py-3 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-black transition-all">
                                            Accept
                                        </button>
                                        <button onClick={() => openReject(selectedOrder)} className="bg-white border border-gray-200 text-red-500 py-3 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-red-50 transition-all">
                                            Decline
                                        </button>
                                    </>
                                )}

                                {selectedOrder.status === 'confirmed' && (
                                    <>
                                        <button onClick={() => api.put(`/api/orders/${selectedOrder._id}/status`, { status: 'preparing', prepEtaMinutes: etaMinutes }).then(fetchOrders)} className="bg-blue-600 text-white py-3 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-blue-700 transition-all">
                                            Start Cooking
                                        </button>
                                        <button onClick={() => openReject(selectedOrder)} className="bg-white border border-gray-200 text-red-500 py-3 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-red-50 transition-all">
                                            Cancel
                                        </button>
                                    </>
                                )}

                                {selectedOrder.status === 'preparing' && (
                                    <button onClick={() => updateOrderStatus(selectedOrder._id, 'ready_for_pickup')} className="col-span-2 bg-green-600 text-white py-3 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-green-700 transition-all">
                                        Mark Ready
                                    </button>
                                )}

                                <button
                                    onClick={async () => {
                                        const text = selectedOrder.items.map(i => `${i.quantity}x ${i.name}`).join('\n');
                                        try { await navigator.clipboard.writeText(text); addToast('Copied items', 'success'); } catch { addToast('Copy failed', 'error'); }
                                    }}
                                    className="col-span-2 bg-gray-100 text-gray-800 py-3 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-gray-200 transition-all"
                                >
                                    Copy items
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Settings Modal */}
            {settingsOpen && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl p-8 max-w-2xl w-full shadow-2xl">
                        <div className="flex items-start justify-between gap-4 mb-6">
                            <div>
                                <h2 className="text-2xl font-black text-gray-900">Restaurant Settings</h2>
                                <p className="text-gray-500 font-medium mt-1">Control availability and delivery settings.</p>
                            </div>
                            <button onClick={() => setSettingsOpen(false)} className="w-10 h-10 rounded-xl bg-gray-100 hover:bg-gray-200 font-black">✕</button>
                        </div>

                        {!settingsForm ? (
                            <div className="text-gray-500 font-bold">Loading…</div>
                        ) : (
                            <div className="space-y-6">
                                <div className="grid md:grid-cols-2 gap-4">
                                    <label className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-2xl px-4 py-4 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={settingsForm.isOpen}
                                            onChange={(e) => setSettingsForm({ ...settingsForm, isOpen: e.target.checked })}
                                            className="w-5 h-5 rounded text-green-600 focus:ring-green-500"
                                        />
                                        <div>
                                            <p className="font-black text-gray-900 leading-none">Store Open</p>
                                            <p className="text-xs font-bold text-gray-500 mt-1">Turn off to pause new orders</p>
                                        </div>
                                    </label>
                                    <div className="bg-gray-50 border border-gray-200 rounded-2xl px-4 py-4">
                                        <p className="text-xs font-black uppercase tracking-widest text-gray-500 mb-2">Service Area</p>
                                        <div className="grid grid-cols-2 gap-3">
                                            <input
                                                className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900"
                                                value={settingsForm.serviceProvince}
                                                onChange={(e) => setSettingsForm({ ...settingsForm, serviceProvince: e.target.value })}
                                                placeholder="Province"
                                            />
                                            <input
                                                className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900"
                                                value={settingsForm.serviceCity}
                                                onChange={(e) => setSettingsForm({ ...settingsForm, serviceCity: e.target.value })}
                                                placeholder="City"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="grid md:grid-cols-3 gap-4">
                                    <div className="bg-gray-50 border border-gray-200 rounded-2xl px-4 py-4">
                                        <p className="text-xs font-black uppercase tracking-widest text-gray-500 mb-2">Delivery Fee</p>
                                        <input
                                            type="number"
                                            step="0.01"
                                            className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 font-black text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900"
                                            value={settingsForm.deliveryFee}
                                            onChange={(e) => setSettingsForm({ ...settingsForm, deliveryFee: e.target.value })}
                                        />
                                    </div>
                                    <div className="bg-gray-50 border border-gray-200 rounded-2xl px-4 py-4">
                                        <p className="text-xs font-black uppercase tracking-widest text-gray-500 mb-2">Minimum Order</p>
                                        <input
                                            type="number"
                                            step="0.01"
                                            className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 font-black text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900"
                                            value={settingsForm.minimumOrder}
                                            onChange={(e) => setSettingsForm({ ...settingsForm, minimumOrder: e.target.value })}
                                        />
                                    </div>
                                    <div className="bg-gray-50 border border-gray-200 rounded-2xl px-4 py-4">
                                        <p className="text-xs font-black uppercase tracking-widest text-gray-500 mb-2">Delivery Time (min)</p>
                                        <input
                                            type="number"
                                            className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 font-black text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900"
                                            value={settingsForm.deliveryTime}
                                            onChange={(e) => setSettingsForm({ ...settingsForm, deliveryTime: e.target.value })}
                                        />
                                    </div>
                                </div>

                                <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5">
                                    <p className="text-xs font-black uppercase tracking-widest text-gray-500 mb-4">Hours</p>
                                    <div className="space-y-3">
                                        {settingsForm.hours.map((h, idx) => (
                                            <div key={h.day} className="grid grid-cols-12 gap-3 items-center bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3">
                                                <div className="col-span-2">
                                                    <p className="font-black text-gray-900">{h.day}</p>
                                                </div>
                                                <div className="col-span-3 flex items-center gap-2">
                                                    <input
                                                        type="checkbox"
                                                        checked={!!h.closed}
                                                        onChange={(e) => {
                                                            const next = [...settingsForm.hours];
                                                            next[idx] = { ...next[idx], closed: e.target.checked };
                                                            setSettingsForm({ ...settingsForm, hours: next });
                                                        }}
                                                        className="w-5 h-5 rounded text-red-600 focus:ring-red-500"
                                                    />
                                                    <span className="text-xs font-black text-gray-600 uppercase tracking-widest">Closed</span>
                                                </div>
                                                <div className="col-span-3">
                                                    <input
                                                        type="time"
                                                        disabled={h.closed}
                                                        value={h.open || '10:00'}
                                                        onChange={(e) => {
                                                            const next = [...settingsForm.hours];
                                                            next[idx] = { ...next[idx], open: e.target.value };
                                                            setSettingsForm({ ...settingsForm, hours: next });
                                                        }}
                                                        className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 font-black text-gray-900 disabled:opacity-50"
                                                    />
                                                </div>
                                                <div className="col-span-1 text-center font-black text-gray-400">—</div>
                                                <div className="col-span-3">
                                                    <input
                                                        type="time"
                                                        disabled={h.closed}
                                                        value={h.close || '22:00'}
                                                        onChange={(e) => {
                                                            const next = [...settingsForm.hours];
                                                            next[idx] = { ...next[idx], close: e.target.value };
                                                            setSettingsForm({ ...settingsForm, hours: next });
                                                        }}
                                                        className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 font-black text-gray-900 disabled:opacity-50"
                                                    />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5">
                                    <p className="text-xs font-black uppercase tracking-widest text-gray-500 mb-4">Notifications</p>
                                    <div className="flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between">
                                        <label className="flex items-center gap-3 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={!!settingsForm.notificationSoundEnabled}
                                                onChange={(e) => setSettingsForm({ ...settingsForm, notificationSoundEnabled: e.target.checked })}
                                                className="w-5 h-5 rounded text-orange-600 focus:ring-orange-500"
                                            />
                                            <div>
                                                <p className="font-black text-gray-900 leading-none">Sound</p>
                                                <p className="text-xs font-bold text-gray-500 mt-1">Play a beep for new orders</p>
                                            </div>
                                        </label>
                                        <button
                                            type="button"
                                            onClick={() => setSettingsForm({ ...settingsForm, notificationsMutedUntil: settingsForm.notificationsMutedUntil ? null : new Date(Date.now() + 30 * 60 * 1000) })}
                                            className={`btn text-sm py-2 ${settingsForm.notificationsMutedUntil ? 'bg-gray-100 text-gray-800 hover:bg-gray-200' : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'}`}
                                        >
                                            {settingsForm.notificationsMutedUntil ? 'Unmute' : 'Mute 30 min'}
                                        </button>
                                    </div>
                                </div>

                                <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-100">
                                    <button
                                        type="button"
                                        onClick={() => setSettingsOpen(false)}
                                        className="btn bg-gray-100 text-gray-800 hover:bg-gray-200"
                                        disabled={settingsSaving}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="button"
                                        onClick={saveSettings}
                                        className="btn btn-primary"
                                        disabled={settingsSaving}
                                    >
                                        {settingsSaving ? 'Saving…' : 'Save'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default RestaurantDashboard;
