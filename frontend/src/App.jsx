import React from 'react';
import { HashRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import { ToastProvider } from './context/ToastContext';
import { LocationProvider } from './context/LocationContext';
import Navbar from './components/Navbar';
import LocationSelectorModal from './components/LocationSelectorModal';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import Restaurants from './pages/Restaurants';
import RestaurantDetail from './pages/RestaurantDetail';
import Cart from './pages/Cart';
import Checkout from './pages/Checkout';
import Orders from './pages/Orders';
import OrderTracking from './pages/OrderTracking';
import Profile from './pages/Profile';
import AdminDashboard from './pages/AdminDashboard';
import Dishes from './pages/Dishes';
import ProductDetail from './pages/ProductDetail';

import RestaurantDashboard from './pages/RestaurantDashboard';
import RiderDashboard from './pages/RiderDashboard';
import ProtectedRoute from './components/ProtectedRoute';
import RiderRedirectRoute from './components/RiderRedirectRoute';

function AppLayout({ children }) {
  const location = useLocation();
  const isHome = location.pathname === '/';
  const hideGlobalNavbar = location.pathname === '/restaurant-dashboard';

  return (
    <main className={!isHome && !hideGlobalNavbar ? 'pt-[var(--app-nav-h)]' : ''}>
      {children}
    </main>
  );
}

function AppShell() {
  const location = useLocation();
  const hideGlobalNavbar = location.pathname === '/restaurant-dashboard';

  return (
    <div className="min-h-screen bg-gray-50">
      {!hideGlobalNavbar && <Navbar />}
      {!hideGlobalNavbar && <LocationSelectorModal />}
      <AppLayout>
        <Routes>
          <Route element={<RiderRedirectRoute />}>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/restaurants" element={<Restaurants />} />
            <Route path="/restaurants/:id" element={<RestaurantDetail />} />
            <Route path="/dishes" element={<Dishes />} />
            <Route path="/dishes/:id" element={<ProductDetail />} />
            <Route path="/cart" element={<Cart />} />
            <Route path="/checkout" element={<Checkout />} />
            <Route path="/orders" element={<Orders />} />
            <Route path="/track-order/:id" element={<OrderTracking />} />
            <Route path="/profile" element={<Profile />} />
          </Route>
          <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
            <Route path="/admin" element={<AdminDashboard />} />
          </Route>
          <Route element={<ProtectedRoute allowedRoles={['restaurant']} />}>
            <Route path="/restaurant-dashboard" element={<RestaurantDashboard />} />
          </Route>
          <Route element={<ProtectedRoute allowedRoles={['rider']} />}>
            <Route path="/rider-dashboard" element={<RiderDashboard />} />
          </Route>
        </Routes>
      </AppLayout>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <ToastProvider>
          <LocationProvider>
            <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
              <AppShell />
            </Router>
          </LocationProvider>
        </ToastProvider>
      </CartProvider>
    </AuthProvider>
  );
}

export default App;
