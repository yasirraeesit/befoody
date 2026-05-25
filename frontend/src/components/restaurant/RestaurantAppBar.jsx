import React, { memo, useEffect, useRef, useState } from 'react';

const RestaurantAppBar = ({
    restaurant,
    user,
    activeTab,
    setActiveTab,
    onToggleOpen,
    toggleSaving,
    onOpenSettings,
    onLogout,
    onUploadLogo,
    counts,
    onToggleMute,
    muted
}) => {
    const [profileOpen, setProfileOpen] = useState(false);
    const profileRef = useRef(null);

    useEffect(() => {
        const onDown = (e) => {
            if (profileRef.current && !profileRef.current.contains(e.target)) setProfileOpen(false);
        };
        document.addEventListener('mousedown', onDown);
        return () => document.removeEventListener('mousedown', onDown);
    }, []);

    const tabs = [
        { id: 'orders', label: 'Orders', badge: counts?.pending || 0 },
        { id: 'menu', label: 'Menu' },
        { id: 'stats', label: 'Analytics' }
    ];

    const isOpen = restaurant?.isOpen !== false;

    return (
        <div className="sticky top-0 z-40 bg-white/90 backdrop-blur-xl border-b border-gray-100 shadow-sm">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="w-11 h-11 rounded-2xl bg-orange-50 border border-orange-100 overflow-hidden flex items-center justify-center flex-shrink-0">
                            {restaurant?.imageUrl ? (
                                <img src={restaurant.imageUrl} alt={restaurant.name} className="w-full h-full object-cover" />
                            ) : (
                                <span className="text-xl">👨‍🍳</span>
                            )}
                        </div>
                        <div className="min-w-0">
                            <div className="flex items-center gap-2">
                                <h1 className="text-lg sm:text-xl font-black text-gray-900 truncate">{restaurant?.name || 'Restaurant'}</h1>
                                {restaurant?.serviceCity && (
                                    <span className="hidden sm:inline text-xs font-black text-gray-500 bg-gray-100 border border-gray-200 px-2 py-1 rounded-full">
                                        {restaurant.serviceCity}
                                    </span>
                                )}
                            </div>
                            <p className="text-[10px] font-black text-orange-600 uppercase tracking-widest">Kitchen Hub</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 sm:gap-3">
                        <button
                            onClick={onToggleOpen}
                            disabled={toggleSaving}
                            className={`px-4 py-2 rounded-2xl text-sm font-black border transition-all ${isOpen
                                ? 'bg-green-50 text-green-700 border-green-100 hover:bg-green-100'
                                : 'bg-red-50 text-red-700 border-red-100 hover:bg-red-100'
                                }`}
                            title="Quick open/close"
                        >
                            {toggleSaving ? 'Updating…' : (isOpen ? 'Open' : 'Closed')}
                        </button>

                        <button
                            onClick={onToggleMute}
                            className={`hidden sm:flex items-center justify-center w-11 h-11 rounded-2xl border transition-all ${muted
                                ? 'bg-gray-100 border-gray-200 text-gray-500 hover:bg-gray-200'
                                : 'bg-white border-gray-100 text-gray-700 hover:border-gray-200 hover:shadow-sm'
                                }`}
                            title={muted ? 'Notifications muted' : 'Mute notifications for 30 min'}
                        >
                            {muted ? '🔕' : '🔔'}
                        </button>

                        <button
                            onClick={onOpenSettings}
                            className="hidden sm:flex items-center justify-center w-11 h-11 rounded-2xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-black transition-all"
                            title="Settings"
                        >
                            ⚙️
                        </button>

                        <div className="relative" ref={profileRef}>
                            <button
                                onClick={() => setProfileOpen((v) => !v)}
                                className="flex items-center gap-3 pl-2 pr-3 py-2 rounded-2xl border border-gray-100 hover:border-gray-200 hover:shadow-sm transition-all bg-white"
                                title="Profile"
                            >
                                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white font-black">
                                    {restaurant?.name ? restaurant.name.slice(0, 1).toUpperCase() : 'R'}
                                </div>
                                <span className="hidden sm:block text-sm font-black text-gray-900 max-w-[140px] truncate">
                                    {user?.name || 'Owner'}
                                </span>
                                <span className="text-gray-400 font-black">▾</span>
                            </button>

                            {profileOpen && (
                                <div className="absolute right-0 mt-3 w-80 bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden">
                                    <div className="p-5 bg-gray-50/60 border-b border-gray-100">
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Restaurant</p>
                                        <p className="text-base font-black text-gray-900 truncate">{restaurant?.name}</p>
                                        <p className="text-xs font-bold text-gray-500 mt-1">
                                            {restaurant?.serviceCity ? `${restaurant.serviceCity}${restaurant.serviceProvince ? `, ${restaurant.serviceProvince}` : ''}` : 'Pakistan'}
                                        </p>
                                    </div>

                                    <div className="p-3 space-y-2">
                                        <button
                                            onClick={onOpenSettings}
                                            className="w-full text-left px-4 py-3 rounded-2xl font-black text-gray-800 hover:bg-gray-50 transition-colors flex items-center gap-3"
                                        >
                                            <span>⚙️</span> Settings
                                        </button>

                                        <label className="w-full px-4 py-3 rounded-2xl font-black text-gray-800 hover:bg-gray-50 transition-colors flex items-center gap-3 cursor-pointer">
                                            <span>🖼️</span>
                                            <span className="flex-1">Upload logo</span>
                                            <input
                                                type="file"
                                                accept="image/*"
                                                className="hidden"
                                                onChange={async (e) => {
                                                    const file = e.target.files?.[0];
                                                    if (file) await onUploadLogo(file);
                                                    e.target.value = '';
                                                }}
                                            />
                                        </label>

                                        <button
                                            onClick={onLogout}
                                            className="w-full text-left px-4 py-3 rounded-2xl font-black text-red-600 hover:bg-red-50 transition-colors flex items-center gap-3"
                                        >
                                            <span>🚪</span> Sign out
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="mt-4 flex items-center justify-between gap-3">
                    <div className="flex bg-gray-100 p-1 rounded-2xl w-full sm:w-auto">
                        {tabs.map((t) => (
                            <button
                                key={t.id}
                                onClick={() => setActiveTab(t.id)}
                                className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-sm font-black transition-all ${activeTab === t.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                                    }`}
                            >
                                <span className="flex items-center gap-2">
                                    {t.label}
                                    {t.badge ? (
                                        <span className="min-w-6 h-6 px-2 rounded-full bg-orange-600 text-white text-[10px] font-black flex items-center justify-center">
                                            {t.badge}
                                        </span>
                                    ) : null}
                                </span>
                            </button>
                        ))}
                    </div>

                    <button
                        onClick={onOpenSettings}
                        className="sm:hidden w-11 h-11 rounded-2xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-black transition-all"
                        title="Settings"
                    >
                        ⚙️
                    </button>
                </div>
            </div>
        </div>
    );
};

export default memo(RestaurantAppBar);
