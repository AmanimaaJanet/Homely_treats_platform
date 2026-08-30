import React, { useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Cake, BarChart3, ClipboardList, Package, Users, Ticket, TrendingUp, Settings, LogOut } from 'lucide-react';
import { useApp } from '../../store.jsx';

const MENU = [
  { to: '/admin', label: 'Dashboard', icon: BarChart3, end: true },
  { to: '/admin/orders', label: 'Orders', icon: ClipboardList },
  { to: '/admin/products', label: 'Products', icon: Package },
  { to: '/admin/customers', label: 'Customers', icon: Users },
  { to: '/admin/promos', label: 'Promo Codes', icon: Ticket },
  { to: '/admin/reports', label: 'Reports', icon: TrendingUp },
  { to: '/admin/settings', label: 'Settings', icon: Settings },
];

export default function AdminLayout() {
  const { user, authReady, logout } = useApp();
  const navigate = useNavigate();

  useEffect(() => {
    if (authReady && (!user || user.role !== 'ADMIN')) {
      navigate('/signin');
    }
  }, [authReady, user, navigate]);

  if (!authReady || !user || user.role !== 'ADMIN') {
    return <div className="empty-state"><p>Loading…</p></div>;
  }

  return (
    <div className="admin-layout">
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
              </NavLink>
            </li>
          ))}
          <li style={{ marginTop: '2rem' }}>
            <a
              href="#/"
              onClick={(e) => {
                e.preventDefault();
                logout();
                navigate('/');
              }}
            >
              <LogOut size={16} /> Sign Out
            </a>
          </li>
        </ul>
      </div>
      <div className="admin-content">
        <Outlet />
      </div>
    </div>
  );
}
