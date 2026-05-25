import React, { useEffect, useCallback, useMemo, useRef, useState, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLocationContext } from '../context/LocationContext';
import api from '../utils/api';
import Hero from '../components/Hero';
import CuisineCategories from '../components/CuisineCategories';

const PopularDishes = React.lazy(() => import('../components/PopularDishes'));
const Collections = React.lazy(() => import('../components/Collections'));
const ServiceHighlights = React.lazy(() => import('../components/ServiceHighlights'));
const Testimonials = React.lazy(() => import('../components/Testimonials'));
const Footer = React.lazy(() => import('../components/Footer'));

const Home = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { location: deliveryLocation } = useLocationContext();
    const [restaurants, setRestaurants] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeCategory, setActiveCategory] = useState('All');
    const [renderBelowFold, setRenderBelowFold] = useState(false);
    const restaurantCacheRef = useRef(new Map());

    useEffect(() => {
        if (user) {
            if (user.role === 'admin') navigate('/admin');
            else if (user.role === 'restaurant') navigate('/restaurant-dashboard');
            else if (user.role === 'rider') navigate('/rider-dashboard');
        }
    }, [user, navigate]);

    useEffect(() => {
        const idleCallback = window.requestIdleCallback
            ? window.requestIdleCallback(() => setRenderBelowFold(true), { timeout: 1500 })
            : window.setTimeout(() => setRenderBelowFold(true), 400);

        return () => {
            if (window.cancelIdleCallback) window.cancelIdleCallback(idleCallback);
            else window.clearTimeout(idleCallback);
        };
    }, []);

    const fetchRestaurants = useCallback(async (category) => {
        const key = `${category || 'All'}|${deliveryLocation?.city || ''}`;
        const cached = restaurantCacheRef.current.get(key);
        if (cached) {
            setRestaurants(cached);
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            setError(null);
            const params = new URLSearchParams();
            params.set('limit', '6');
            const categoryKey = category || 'All';
            if (categoryKey !== 'All') params.set('cuisine', categoryKey);
            if (deliveryLocation?.city) params.set('city', deliveryLocation.city);
            if (deliveryLocation?.province) params.set('province', deliveryLocation.province);

            const response = await api.get(`/api/restaurants?${params.toString()}`);
            const data = Array.isArray(response.data) ? response.data : [];
            restaurantCacheRef.current.set(key, data);
            setRestaurants(data);
            setLoading(false);
        } catch (err) {
            console.error('Error fetching restaurants:', err);
            setError('Failed to load restaurants');
            setLoading(false);
        }
    }, [deliveryLocation?.city, deliveryLocation?.province]);

    useEffect(() => {
        fetchRestaurants(activeCategory);
    }, [activeCategory, fetchRestaurants]);

    const handleSearch = useCallback((e) => {
        e.preventDefault();
        if (searchTerm.trim()) {
            navigate(`/restaurants?search=${encodeURIComponent(searchTerm)}`);
        }
    }, [searchTerm, navigate]);

    const featuredRestaurants = useMemo(() => restaurants.slice(0, 6), [restaurants]);

    return (
        <div className="min-h-screen bg-white">
            {/* Hero Section */}
            <Hero
                searchTerm={searchTerm}
                setSearchTerm={setSearchTerm}
                handleSearch={handleSearch}
            />

            {/* Cuisine Categories */}
            <CuisineCategories
                activeCategory={activeCategory}
                onCategoryChange={setActiveCategory}
            />

            {/* Featured Restaurants Section */}
            <section className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-end justify-between mb-12">
                    <div>
                        <h2 className="text-4xl font-black text-gray-900 tracking-tighter">Featured Restaurants</h2>
                        <p className="text-gray-500 font-medium mt-2">The most popular spots in your neighborhood</p>
                    </div>
                    <button
                        onClick={() => navigate('/restaurants')}
                        className="hidden md:block px-8 py-3 rounded-2xl border-2 border-gray-100 font-black text-gray-600 hover:bg-gray-50 hover:border-gray-200 transition-all"
                    >
                        View All
                    </button>
                </div>

                {loading ? (
                    <div className="grid md:grid-cols-3 gap-8">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="animate-pulse">
                                <div className="bg-gray-200 h-64 rounded-3xl mb-4"></div>
                                <div className="bg-gray-200 h-6 w-3/4 rounded-lg mb-2"></div>
                                <div className="bg-gray-200 h-4 w-1/2 rounded-lg"></div>
                            </div>
                        ))}
                    </div>
                ) : error ? (
                    <div className="text-center py-20 bg-red-50 rounded-3xl border border-red-100">
                        <p className="text-red-600 font-bold">{error}</p>
                        <button onClick={() => fetchRestaurants(activeCategory)} className="mt-4 text-red-700 underline font-black">Try again</button>
                    </div>
                ) : restaurants.length === 0 ? (
                    <div className="text-center py-20 bg-gray-50 rounded-3xl border border-gray-100">
                        <p className="text-gray-500 font-bold">No restaurants found in this category.</p>
                        <button onClick={() => setActiveCategory('All')} className="mt-4 text-primary-600 font-black underline">View all categories</button>
                    </div>
                ) : (
                    <div className="grid md:grid-cols-3 gap-8">
                        {featuredRestaurants.map((restaurant) => (
                            <div
                                key={restaurant._id}
                                onClick={() => navigate(`/restaurants/${restaurant._id}`)}
                                className="group cursor-pointer"
                            >
                                <div className="relative h-64 rounded-[2rem] overflow-hidden mb-5 shadow-lg group-hover:shadow-2xl transition-all duration-500 transform group-hover:-translate-y-2">
                                    <img
                                        src={restaurant.imageUrl || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=70'}
                                        alt={restaurant.name}
                                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                                        loading="lazy"
                                        decoding="async"
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60"></div>
                                    <div className="absolute bottom-6 left-6 right-6 flex items-center justify-between">
                                        <div className="px-3 py-1 rounded-full bg-white/20 backdrop-blur-md border border-white/20 text-white text-[10px] font-black uppercase tracking-wider">
                                            {restaurant.deliveryTime || '30-45'} min
                                        </div>
                                        <div className="flex items-center gap-1 px-3 py-1 rounded-full bg-primary-500 text-white text-[10px] font-black shadow-lg">
                                            <span>★</span> {restaurant.rating || '4.5'}
                                        </div>
                                    </div>
                                </div>
                                <h3 className="text-2xl font-black text-gray-900 leading-tight group-hover:text-primary-600 transition-colors">
                                    {restaurant.name}
                                </h3>
                                <div className="flex items-center gap-2 mt-2">
                                    <span className="text-sm font-bold text-gray-400 capitalize">
                                        {(Array.isArray(restaurant.cuisine) ? restaurant.cuisine.join(', ') : restaurant.cuisine) || 'Cuisine'} • {restaurant?.serviceCity || restaurant?.address?.city || 'Nearby'}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </section>

            {renderBelowFold && (
                <Suspense fallback={null}>
                    {/* UI Component: Popular Dishes */}
                    <PopularDishes />

                    {/* Collections Section */}
                    <Collections />

                    {/* UI Component: Service Highlights */}
                    <ServiceHighlights />

                    {/* Testimonials */}
                    <Testimonials />

                    {/* Footer */}
                    <Footer />
                </Suspense>
            )}
        </div>
    );
};

export default Home;
