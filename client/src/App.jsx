import React from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar.jsx';
import Footer from './components/Footer.jsx';
import Toasts from './components/Toasts.jsx';
import Home from './pages/Home.jsx';
import Menu from './pages/Menu.jsx';
import CustomOrder from './pages/CustomOrder.jsx';
import Cart from './pages/Cart.jsx';
import Track from './pages/Track.jsx';
import SignIn from './pages/SignIn.jsx';
import Register from './pages/Register.jsx';
import ForgotPassword from './pages/ForgotPassword.jsx';
import ResetPassword from './pages/ResetPassword.jsx';
import { Privacy, Terms } from './pages/Legal.jsx';
import Verify from './pages/Verify.jsx';
import Account from './pages/Account.jsx';
import Rider from './pages/Rider.jsx';
import PaySimulate from './pages/PaySimulate.jsx';
import PayCallback from './pages/PayCallback.jsx';
import AdminLayout from './pages/admin/AdminLayout.jsx';
import AdminDashboard from './pages/admin/Dashboard.jsx';
import AdminOrders from './pages/admin/Orders.jsx';
import AdminProducts from './pages/admin/Products.jsx';
import AdminCustomers from './pages/admin/Customers.jsx';
import AdminPromos from './pages/admin/Promos.jsx';
import AdminReports from './pages/admin/Reports.jsx';
import AdminSettings from './pages/admin/Settings.jsx';
import AdminRiders from './pages/admin/Riders.jsx';
import AdminAudit from './pages/admin/Audit.jsx';

export default function App() {
  const location = useLocation();
  const isAdmin = location.pathname.startsWith('/admin');
  const isRider = location.pathname.startsWith('/rider');

  return (
    <div className="app-shell">
      {!isAdmin && !isRider && <Navbar />}
      <main className={isAdmin ? 'admin-root' : ''}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/menu" element={<Menu />} />
          <Route path="/custom-order" element={<CustomOrder />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/track" element={<Track />} />
          <Route path="/signin" element={<SignIn />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/verify" element={<Verify />} />
          <Route path="/account" element={<Account />} />
          <Route path="/rider" element={<Rider />} />
          <Route path="/pay/simulate" element={<PaySimulate />} />
          <Route path="/pay/callback" element={<PayCallback />} />

          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<AdminDashboard />} />
            <Route path="orders" element={<AdminOrders />} />
            <Route path="products" element={<AdminProducts />} />
            <Route path="customers" element={<AdminCustomers />} />
            <Route path="promos" element={<AdminPromos />} />
            <Route path="reports" element={<AdminReports />} />
            <Route path="riders" element={<AdminRiders />} />
            <Route path="audit" element={<AdminAudit />} />
            <Route path="settings" element={<AdminSettings />} />
          </Route>
        </Routes>
      </main>
      {!isAdmin && !isRider && <Footer />}
      <Toasts />
    </div>
  );
}
