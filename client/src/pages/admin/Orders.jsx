import React, { useEffect, useState } from 'react';
import { api } from '../../api.js';
import StatusBadge from '../../components/StatusBadge.jsx';
import { ProductIcon } from '../../components/ProductIcon.jsx';
import { useApp } from '../../store.jsx';
import { ghs, fmtDate, fmtDateTime } from '../../lib/format.js';

const STATUSES = ['PENDING', 'CONFIRMED', 'IN_PROGRESS', 'READY', 'DELIVERED', 'CANCELLED'];

export default function Orders() {
  const { toast } = useApp();
  const [orders, setOrders] = useState([]);
  const [status, setStatus] = useState('ALL');
  const [search, setSearch] = useState('');
  const [detail, setDetail] = useState(null);

  const load = () => {
    const params = new URLSearchParams();
    if (status !== 'ALL') params.set('status', status);
    if (search) params.set('search', search);
    api.get(`/admin/orders?${params}`, { auth: true }).then((d) => setOrders(d.orders)).catch(() => {});
  };

  useEffect(load, [status]);

  const updateStatus = async (id, newStatus) => {
    try {
      const { order } = await api.patch(`/admin/orders/${id}/status`, { status: newStatus }, { auth: true });
      setOrders((os) => os.map((o) => (o.id === id ? order : o)));
      toast(`${id} → ${newStatus.replace(/_/g, ' ')}. Customer notified.`, 'success');
      if (detail?.id === id) setDetail(order);
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const openDetail = async (id) => {
    try {
      const { order } = await api.get(`/admin/orders/${id}`, { auth: true });
      setDetail(order);
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  return (
    <div>
      <h2 className="admin-title">Order Management</h2>

      <div className="admin-toolbar">
        <select className="form-select" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="ALL">All Statuses</option>
          {STATUSES.map((s) => <option key={s}>{s.replace(/_/g, ' ')}</option>)}
        </select>
        <input
          className="form-input"
          placeholder="Search order / customer…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && load()}
        />
        <button className="btn btn-secondary" onClick={load}>Search</button>
      </div>

      <table className="table">
        <thead>
          <tr>
            <th>Order ID</th><th>Customer</th><th>Items</th><th>Amount</th>
            <th>Payment</th><th>Status</th><th>Date</th><th>Action</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.id}>
              <td><button className="btn-link" onClick={() => openDetail(o.id)}>{o.id}</button></td>
              <td>
                {o.user?.fullName || o.guestName || 'Guest'}
                {o.user?.phone || o.guestPhone ? <span className="muted small block">{o.user?.phone || o.guestPhone}</span> : null}
              </td>
              <td>
                {o.items.map((i) => (
                  <span key={i.id} className="item-chip"><ProductIcon name={i.emoji} size={14} /> {i.name}</span>
                ))}
              </td>
              <td>{ghs(o.total)}</td>
              <td><StatusBadge status={o.paymentStatus} /></td>
              <td>
                <select
                  className="form-select status-select"
                  value={o.status}
                  onChange={(e) => updateStatus(o.id, e.target.value)}
                >
                  {STATUSES.map((s) => <option key={s}>{s.replace(/_/g, ' ')}</option>)}
                </select>
              </td>
              <td>{fmtDate(o.createdAt)}</td>
              <td><button className="btn btn-secondary btn-sm" onClick={() => openDetail(o.id)}>View →</button></td>
            </tr>
          ))}
          {orders.length === 0 && <tr><td colSpan="8" className="centered muted">No orders found</td></tr>}
        </tbody>
      </table>

      {detail && (
        <div className="modal active" onClick={(e) => e.target === e.currentTarget && setDetail(null)}>
          <div className="modal-content modal-wide">
            <div className="modal-header">
              <h3>Order {detail.id}</h3>
              <button className="close-btn" onClick={() => setDetail(null)}>×</button>
            </div>

            <div className="detail-grid">
              <div>
                <p><strong>Customer:</strong> {detail.user?.fullName || detail.guestName || 'Guest'}</p>
                <p><strong>Phone:</strong> {detail.user?.phone || detail.guestPhone}</p>
                <p><strong>Email:</strong> {detail.user?.email || detail.guestEmail}</p>
                <p><strong>Delivery:</strong> {detail.deliveryMethod === 'DELIVERY' ? detail.deliveryAddress : 'Pickup'}</p>
                <p><strong>Ready date:</strong> {fmtDate(detail.readyDate)}</p>
                <p><strong>Total:</strong> {ghs(detail.total)}</p>
                <p><strong>Payment:</strong> <StatusBadge status={detail.paymentStatus} /> {detail.paymentMethod}</p>
              </div>
              <div>
                <p><strong>Items</strong></p>
                {detail.items.map((i) => (
                  <p key={i.id} className="small">
                    <span className="item-chip"><ProductIcon name={i.emoji} size={14} /> {i.name} × {i.quantity} — {ghs(i.price * i.quantity)}</span>
                    <span className="muted"> ({[i.size, i.flavor, i.icing].filter(Boolean).join(' · ') || 'standard'})</span>
                    {i.inscription && <> — "{i.inscription}"</>}
                  </p>
                ))}
                {detail.notes && <p className="small"><strong>Notes:</strong> {detail.notes}</p>}
              </div>
            </div>

            <h4 className="form-heading">Status history</h4>
            <div className="timeline-list">
              {detail.events.map((ev) => (
                <div key={ev.id} className="timeline-row">
                  <strong>{ev.status.replace(/_/g, ' ')}</strong>
                  <span className="muted small">{fmtDateTime(ev.createdAt)}</span>
                  {ev.note && <span className="muted small"> — {ev.note}</span>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
