import React, { useEffect, useState } from 'react';
import { Users, ShoppingCart, Coins } from 'lucide-react';
import { api } from '../../api.js';
import { ghs, fmtDate, initials } from '../../lib/format.js';

export default function Customers() {
  const [customers, setCustomers] = useState([]);

  useEffect(() => {
    api.get('/admin/customers', { auth: true }).then((d) => setCustomers(d.customers)).catch(() => {});
  }, []);

  const totalSpent = customers.reduce((s, c) => s + c.totalSpent, 0);

  return (
    <div>
      <h2 className="admin-title">Customer Management</h2>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-card-icon"><Users size={26} /></div>
          <div className="stat-card-value">{customers.length}</div>
          <div className="stat-card-label">Total Customers</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon"><ShoppingCart size={26} /></div>
          <div className="stat-card-value">{customers.filter((c) => c.totalOrders > 0).length}</div>
          <div className="stat-card-label">Active Buyers</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon"><Coins size={26} /></div>
          <div className="stat-card-value">{ghs(totalSpent)}</div>
          <div className="stat-card-label">Customer Lifetime Value</div>
        </div>
      </div>

      <table className="table">
        <thead>
          <tr><th>Customer</th><th>Email</th><th>Phone</th><th>Orders</th><th>Total Spent</th><th>Member Since</th></tr>
        </thead>
        <tbody>
          {customers.map((c) => (
            <tr key={c.id}>
              <td><strong className="customer-cell"><span className="avatar avatar-sm">{initials(c.fullName)}</span> {c.fullName}</strong></td>
              <td>{c.email}</td>
              <td>{c.phone}</td>
              <td>{c.totalOrders}</td>
              <td>{ghs(c.totalSpent)}</td>
              <td>{fmtDate(c.createdAt)}</td>
            </tr>
          ))}
          {customers.length === 0 && <tr><td colSpan="6" className="centered muted">No customers yet</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
