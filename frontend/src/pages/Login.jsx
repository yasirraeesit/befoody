import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLocationContext } from '../context/LocationContext';

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();
    const { location: deliveryLocation, setSelectorOpen } = useLocationContext();

    const handleDemoLogin = async (role) => {
        let demoEmail = '';
        let demoPassword = 'password123';

        switch (role) {
            case 'admin':
                demoEmail = 'admin@befoody.com';
                demoPassword = 'password123';
                break;
            case 'restaurant':
                demoEmail = 'owner@restaurant.com';
                break;
            case 'rider':
                demoEmail = 'alex.rider@befoody.com';
                break;
            case 'customer':
                demoEmail = 'john.doe@gmail.com';
                break;
            default:
                return;
        }

        setEmail(demoEmail);
        setPassword(demoPassword);

        // Optional: auto-submit or just fill
        // Here we just fill the form for clarity, user can click sign in, or we can call login directly
        // Let's call login directly for better UX
        handleLoginDirectly(demoEmail, demoPassword);
    };

    const handleLahoreDemoLogin = async (role) => {
        const demoPassword = 'password123';
        let demoEmail = '';

        switch (role) {
            case 'restaurant':
                demoEmail = 'lahore.owner@befoody.com';
                break;
            case 'rider':
                demoEmail = 'lahore.rider@befoody.com';
                break;
            case 'customer':
                demoEmail = 'lahore.user@befoody.com';
                break;
            default:
                return;
        }

        setEmail(demoEmail);
        setPassword(demoPassword);
        handleLoginDirectly(demoEmail, demoPassword);
    };

    const handleLoginDirectly = async (emailToUse, passwordToUse) => {
        setError('');
        setLoading(true);

        const result = await login(emailToUse, passwordToUse);

        if (result.success) {
            const user = result.user;
            if (user?.role === 'admin') navigate('/admin');
            else if (user?.role === 'restaurant') navigate('/restaurant-dashboard');
            else if (user?.role === 'rider') navigate('/rider-dashboard');
            else navigate('/');
        } else {
            setError(result.message);
        }
        setLoading(false);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        handleLoginDirectly(email, password);
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
            <div className="max-w-md w-full">
                <div className="text-center mb-8">
                    <h2 className="text-4xl font-heading font-bold text-gray-900 mb-2">
                        Welcome Back!
                    </h2>
                    <p className="text-gray-600">Sign in to your account</p>
                </div>

                <div className="card mb-6">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {error && (
                            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                                {error}
                            </div>
                        )}

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Email Address
                            </label>
                            <input
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="input-field"
                                placeholder="you@example.com"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Password
                            </label>
                            <input
                                type="password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="input-field"
                                placeholder="••••••••"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="btn btn-primary w-full"
                        >
                            {loading ? 'Signing in...' : 'Sign In'}
                        </button>
                    </form>

                    <div className="mt-6 text-center">
                        <p className="text-gray-600">
                            Don't have an account?{' '}
                            <Link to="/register" className="text-primary-500 hover:text-primary-600 font-medium">
                                Sign up
                            </Link>
                        </p>
                    </div>
                </div>

                <div className="text-center">
                    <p className="text-xs text-gray-400 uppercase font-bold tracking-wider mb-4">— Quick Demo Access —</p>
                    <div className="grid grid-cols-4 gap-2">
                        <button
                            onClick={() => handleDemoLogin('admin')}
                            className="flex flex-col items-center justify-center p-2 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-all group"
                        >
                            <span className="text-lg mb-1 group-hover:scale-110 transition-transform">⚡️</span>
                            <span className="text-[10px] font-bold text-gray-700">Admin</span>
                        </button>
                        <button
                            onClick={() => handleDemoLogin('restaurant')}
                            className="flex flex-col items-center justify-center p-2 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-all group"
                        >
                            <span className="text-lg mb-1 group-hover:scale-110 transition-transform">🍳</span>
                            <span className="text-[10px] font-bold text-gray-700">Rest.</span>
                        </button>
                        <button
                            onClick={() => handleDemoLogin('rider')}
                            className="flex flex-col items-center justify-center p-2 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-all group"
                        >
                            <span className="text-lg mb-1 group-hover:scale-110 transition-transform">🚴</span>
                            <span className="text-[10px] font-bold text-gray-700">Rider</span>
                        </button>
                        <button
                            onClick={() => handleDemoLogin('customer')}
                            className="flex flex-col items-center justify-center p-2 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-all group"
                        >
                            <span className="text-lg mb-1 group-hover:scale-110 transition-transform">👤</span>
                            <span className="text-[10px] font-bold text-gray-700">User</span>
                        </button>
                    </div>
                </div>

                {deliveryLocation?.city?.toLowerCase?.() === 'lahore' && (
                    <div className="text-center mt-8">
                        <p className="text-xs text-gray-400 uppercase font-bold tracking-wider mb-4">— Lahore Demo Accounts —</p>
                        <div className="grid grid-cols-3 gap-2">
                            <button
                                onClick={() => handleLahoreDemoLogin('restaurant')}
                                className="flex flex-col items-center justify-center p-3 bg-white border border-gray-200 rounded-2xl hover:bg-gray-50 hover:border-gray-300 transition-all group"
                                title="lahore.owner@befoody.com / password123"
                            >
                                <span className="text-lg mb-1 group-hover:scale-110 transition-transform">🍳</span>
                                <span className="text-[10px] font-bold text-gray-700">Restaurant</span>
                            </button>
                            <button
                                onClick={() => handleLahoreDemoLogin('rider')}
                                className="flex flex-col items-center justify-center p-3 bg-white border border-gray-200 rounded-2xl hover:bg-gray-50 hover:border-gray-300 transition-all group"
                                title="lahore.rider@befoody.com / password123"
                            >
                                <span className="text-lg mb-1 group-hover:scale-110 transition-transform">🚴</span>
                                <span className="text-[10px] font-bold text-gray-700">Rider</span>
                            </button>
                            <button
                                onClick={() => handleLahoreDemoLogin('customer')}
                                className="flex flex-col items-center justify-center p-3 bg-white border border-gray-200 rounded-2xl hover:bg-gray-50 hover:border-gray-300 transition-all group"
                                title="lahore.user@befoody.com / password123"
                            >
                                <span className="text-lg mb-1 group-hover:scale-110 transition-transform">👤</span>
                                <span className="text-[10px] font-bold text-gray-700">User</span>
                            </button>
                        </div>

                        <button
                            type="button"
                            onClick={() => setSelectorOpen(true)}
                            className="mt-4 text-xs font-black text-primary-600 hover:text-primary-700 underline"
                        >
                            Change location
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Login;
