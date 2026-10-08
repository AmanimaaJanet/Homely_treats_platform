import React, { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Cake, BarChart3, ClipboardList, Package, Users, Ticket, TrendingUp, Settings, LogOut, Store, Bike, ScrollText, MessageSquareQuote, Truck, Activity } from 'lucide-react';
import { api } from '../../api.js';
import { useApp } from '../../store.jsx';
import Seo from '../../components/Seo.jsx';

const MENU = [
  { to: '/admin', label: 'Dashboard', icon: BarChart3, end: true },
  { to: '/admin/orders', label: 'Orders', icon: ClipboardList },
  { to: '/admin/products', label: 'Products', icon: Package },
  { to: '/admin/customers', label: 'Customers', icon: Users },
  { to: '/admin/reviews', label: 'Reviews', icon: MessageSquareQuote },
  { to: '/admin/promos', label: 'Promo Codes', icon: Ticket },
  { to: '/admin/reports', label: 'Reports', icon: TrendingUp },
  { to: '/admin/deliveries', label: 'Deliveries', icon: Truck },
  { to: '/admin/riders', label: 'Riders', icon: Bike },
  { to: '/admin/audit', label: 'Activity log', icon: ScrollText },
  { to: '/admin/diagnostics', label: 'Diagnostics', icon: Activity },
  { to: '/admin/settings', label: 'Settings', icon: Settings },
];

export default function AdminLayout() {
  const { user, authReady, logout } = useApp();
  const navigate = useNavigate();
  // A quiet count of reviews waiting on the bakery, so nothing sits unnoticed.
  const [pendingReviews, setPendingReviews] = useState(0);

  useEffect(() => {
    if (authReady && (!user || user.role !== 'ADMIN')) {
      navigate('/signin');
    }
  }, [authReady, user, navigate]);

  useEffect(() => {
    if (!authReady || user?.role !== 'ADMIN') return;
    api
      .get('/admin/reviews?status=PENDING&take=1', { auth: true })
      .then((d) => setPendingReviews(d.summary?.PENDING || 0))
      .catch(() => {});
  }, [authReady, user]);

  if (!authReady || !user || user.role !== 'ADMIN') {
    return <div className="empty-state"><p>Loading…</p></div>;
  }

  return (
    <div className="admin-layout">
    <Seo title="Admin" description="Store management." noindex />
      <div className="admin-sidebar">
        <div className="admin-brand">
          <h2><Cake size={18} /> Homely Treats</h2>
          <p>Admin Portal</p>
        </div>
        <ul className="admin-menu">
          {MENU.map((m) => (
            <li key={m.to}>
              <NavLink to={m.to} end={m.end} className={({ isActive }) => (isActive ? 'active' : '')}>
                <m.icon size={16} /> {m.label}
                {m.to === '/admin/reviews' && pendingReviews > 0 && (
                  <span className="menu-count" title={`${pendingReviews} review(s) waiting`}>
                    {pendingReviews}
                  </span>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
        {/* Pinned to the bottom of the sidebar, outside the scrollable menu, so
            they are visible at any window height — the old Sign Out lived at the
            bottom of the menu list, which is exactly where a short window cut it
            off with no way to scroll to it. */}
        <div className="admin-sidebar-foot">
          <a className="admin-foot-link" href="/">
            <Store size={16} /> View Storefront
          </a>
          <button
            type="button"
            className="admin-foot-link admin-foot-signout"
            onClick={() => {
              logout();
              navigate('/');
            }}
          >
            <LogOut size={16} /> Sign Out
          </button>
        </div>
      </div>
      <div className="admin-content">
        <Outlet />
      </div>
    </div>
  );
}
