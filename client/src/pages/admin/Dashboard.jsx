import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Coins, ClipboardList, Loader, Users } from 'lucide-react';
import { api } from '../../api.js';
import StatusBadge from '../../components/StatusBadge.jsx';
import { ghs, fmtDate } from '../../lib/format.js';

function BarChart({ months }) {
  const max = Math.max(1, ...months.map((m) => m.value));
  return (
    <div className="bar-chart">
      {months.map((m, i) => (
        <div className="bar-col" key={i}>
          <div className="bar-value">{m.value > 0 ? ghs(m.value).replace('GH₵ ', '') : ''}</div>
          <div className="bar-track">
            <div className="bar-fill" style={{ height: `${Math.max(4, (m.value / max) * 100)}%` }} />
          </div>
          <div className="bar-label">{m.label}</div>
        </div>
      ))}
    </div>
  );
}

function Donut({ categories }) {
  const total = Math.max(1, categories.reduce((s, c) => s + c.value, 0));
  const colors = ['#e91e63', '#667eea', '#ffc107', '#4caf50', '#ff9800'];
  let acc = 0;
  const segments = categories.map((c, i) => {
    const start = acc;
    acc += c.value;
    return { ...c, start: (start / total) * 100, end: (acc / total) * 100, color: colors[i % colors.length] };
  });
  return (
    <div className="donut-wrap">
      <div
        className="donut"
        style={{
          background: `conic-gradient(${segments.map((s) => `${s.color} ${s.start}% ${s.end}%`).join(', ')})`,
        }}
      >
        <div className="donut-hole" />
      </div>
      <div className="donut-legend">
        {segments.map((s, i) => (
          <div className="legend-row" key={i}>
            <span className="legend-dot" style={{ background: s.color }} />
            <span>{s.name.replace(/_/g, ' ')}</span>
            <strong>{Math.round((s.value / total) * 100)}%</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [recent, setRecent] = useState([]);

  useEffect(() => {
    api.get('/admin/stats', { auth: true }).then(setStats).catch(() => {});
    api.get('/admin/orders', { auth: true }).then((d) => setRecent(d.orders.slice(0, 5))).catch(() => {});
  }, []);

  if (!stats) return <div className="empty-state"><p>Loading dashboard…</p></div>;

  return (
    <div>
      <h2 className="admin-title">Dashboard Overview</h2>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-card-icon"><Coins size={26} /></div>
          <div className="stat-card-value">{ghs(stats.totalRevenue)}</div>
          <div className="stat-card-label">Total Revenue</div>
          <p className="trend-up">↑ {ghs(stats.monthlyRevenue)} this month</p>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon"><ClipboardList size={26} /></div>
          <div className="stat-card-value">{stats.ordersToday}</div>
          <div className="stat-card-label">Orders Today</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon"><Loader size={26} /></div>
          <div className="stat-card-value">{stats.activeOrders}</div>
          <div className="stat-card-label">Active Orders</div>
          <p className="trend-warn">{stats.pendingPayments} pending payment</p>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon"><Users size={26} /></div>
          <div className="stat-card-value">{stats.totalCustomers}</div>
          <div className="stat-card-label">Total Customers</div>
          <p className="trend-up">↑ {stats.newCustomers} new this month</p>
        </div>
      </div>

      <div className="admin-grid-2">
        <div className="section">
          <h3 className="form-heading">Revenue — last 8 months (GH₵)</h3>
          <BarChart months={stats.months} />
        </div>
        <div className="section">
          <h3 className="form-heading">Orders by Category</h3>
          <Donut categories={stats.categories} />
        </div>
      </div>

      <div className="section">
        <div className="section-head-row">
          <h3 className="form-heading">Recent Orders</h3>
          <Link to="/admin/orders" className="btn btn-secondary">View all →</Link>
        </div>
        <table className="table">
          <thead>
            <tr><th>Order ID</th><th>Customer</th><th>Items</th><th>Total</th><th>Status</th><th>Date</th></tr>
          </thead>
          <tbody>
            {recent.map((o) => (
              <tr key={o.id}>
                <td>{o.id}</td>
                <td>{o.user?.fullName || o.guestName || 'Guest'}</td>
                <td>{o.items.map((i) => i.name).join(', ')}</td>
                <td>{ghs(o.total)}</td>
                <td><StatusBadge status={o.status} /></td>
                <td>{fmtDate(o.createdAt)}</td>
              </tr>
            ))}
            {recent.length === 0 && (
              <tr><td colSpan="6" className="centered muted">No orders yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
