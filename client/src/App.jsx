import React, { Suspense, lazy, useEffect, useRef } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar.jsx';
import Footer from './components/Footer.jsx';
import Toasts from './components/Toasts.jsx';
import RouteFallback from './components/RouteFallback.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import { prefetchRoutes } from './lib/prefetch.js';
// The homepage is the one page that must not wait for a second download, so it stays in
// the main bundle. Everything else is fetched when it is first opened — a customer who
// only ever browses the menu never downloads the admin panel, the rider app or the print
// templates, which together are most of the app's weight.
import Home from './pages/Home.jsx';

const Menu = lazy(() => import('./pages/Menu.jsx'));
const ProductDetail = lazy(() => import('./pages/ProductDetail.jsx'));
const CustomOrder = lazy(() => import('./pages/CustomOrder.jsx'));
const Cart = lazy(() => import('./pages/Cart.jsx'));
const Track = lazy(() => import('./pages/Track.jsx'));
const SignIn = lazy(() => import('./pages/SignIn.jsx'));
const Register = lazy(() => import('./pages/Register.jsx'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword.jsx'));
const ResetPassword = lazy(() => import('./pages/ResetPassword.jsx'));
const Verify = lazy(() => import('./pages/Verify.jsx'));
const Account = lazy(() => import('./pages/Account.jsx'));
const Rider = lazy(() => import('./pages/Rider.jsx'));
const PaySimulate = lazy(() => import('./pages/PaySimulate.jsx'));
const PayCallback = lazy(() => import('./pages/PayCallback.jsx'));
// Legal.jsx exports two named pages that share one file, so both routes point at the same
// chunk rather than downloading it twice.
const Privacy = lazy(() => import('./pages/Legal.jsx').then((m) => ({ default: m.Privacy })));
const Terms = lazy(() => import('./pages/Legal.jsx').then((m) => ({ default: m.Terms })));

const AdminLayout = lazy(() => import('./pages/admin/AdminLayout.jsx'));
const AdminDashboard = lazy(() => import('./pages/admin/Dashboard.jsx'));
const AdminOrders = lazy(() => import('./pages/admin/Orders.jsx'));
const AdminProducts = lazy(() => import('./pages/admin/Products.jsx'));
const AdminCustomers = lazy(() => import('./pages/admin/Customers.jsx'));
const AdminPromos = lazy(() => import('./pages/admin/Promos.jsx'));
const AdminReports = lazy(() => import('./pages/admin/Reports.jsx'));
const AdminSettings = lazy(() => import('./pages/admin/Settings.jsx'));
const AdminRiders = lazy(() => import('./pages/admin/Riders.jsx'));
const AdminAudit = lazy(() => import('./pages/admin/Audit.jsx'));
const AdminReviews = lazy(() => import('./pages/admin/Reviews.jsx'));
const AdminDeliveries = lazy(() => import('./pages/admin/Deliveries.jsx'));
const AdminDiagnostics = lazy(() => import('./pages/admin/Diagnostics.jsx'));
const PrintDoc = lazy(() => import('./pages/admin/PrintDoc.jsx'));

/** Scroll to the top when the page changes — a route swap should start at the top. */
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [pathname]);
  return null;
}

export default function App() {
  const location = useLocation();
  const isAdmin = location.pathname.startsWith('/admin');
  const isRider = location.pathname.startsWith('/rider');
  const prefetched = useRef(false);

  // Once the homepage has settled, quietly fetch the pages a visitor is most likely to
  // open next, so the transition to the menu feels instant without slowing the first
  // paint. See lib/prefetch.js.
  useEffect(() => {
    if (prefetched.current) return;
    prefetched.current = true;
    if (location.pathname === '/') prefetchRoutes('menu', 'customOrder', 'product');
  }, [location.pathname]);

  return (
    <div className="app-shell">
      <ScrollToTop />
      {!isAdmin && !isRider && <Navbar />}
      <main className={isAdmin ? 'admin-root' : ''}>
        <ErrorBoundary>
          <Suspense
            fallback={<RouteFallback label={isAdmin ? 'Loading the admin panel' : 'Loading'} variant={isAdmin ? 'admin' : 'page'} />}
          >
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/menu" element={<Menu />} />
              <Route path="/menu/:id" element={<ProductDetail />} />
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
                <Route path="reviews" element={<AdminReviews />} />
                <Route path="deliveries" element={<AdminDeliveries />} />
                {/* Deliberately inside AdminLayout: it is the auth guard, and the print
                    stylesheet in styles.css hides the sidebar and topbar on paper — so the
                    sheet comes out clean without giving up the guard. */}
                <Route path="print/:id" element={<PrintDoc />} />
                <Route path="products" element={<AdminProducts />} />
                <Route path="customers" element={<AdminCustomers />} />
                <Route path="promos" element={<AdminPromos />} />
                <Route path="reports" element={<AdminReports />} />
                <Route path="riders" element={<AdminRiders />} />
                <Route path="audit" element={<AdminAudit />} />
                <Route path="diagnostics" element={<AdminDiagnostics />} />
                <Route path="settings" element={<AdminSettings />} />
              </Route>

              <Route path="*" element={<Home />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </main>
      {!isAdmin && !isRider && <Footer />}
      <Toasts />
    </div>
  );
}
