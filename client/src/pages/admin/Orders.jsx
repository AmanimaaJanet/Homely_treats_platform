import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Printer, ChefHat, RotateCcw } from 'lucide-react';
import { api } from '../../api.js';
import StatusBadge from '../../components/StatusBadge.jsx';
import { useApp } from '../../store.jsx';
import { ghs, fmtDate, fmtDateTime } from '../../lib/format.js';
import { useEscape } from '../../lib/a11y.js';

const STATUSES = ['PENDING', 'CONFIRMED', 'IN_PROGRESS', 'READY', 'DELIVERED', 'CANCELLED'];

export default function Orders() {
  const { toast } = useApp();
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [status, setStatus] = useState('ALL');
  const [search, setSearch] = useState('');
  const [branches, setBranches] = useState([]); // pickup locations = branches
  const [branch, setBranch] = useState('ALL');
  const [detail, setDetail] = useState(null);
  const [refunding, setRefunding] = useState(false);
  const [refundReason, setRefundReason] = useState('');

  const load = () => {
    const params = new URLSearchParams();
    if (status !== 'ALL') params.set('status', status);
    if (search) params.set('search', search);
    if (branch !== 'ALL') params.set('branch', branch);
    api.get(`/admin/orders?${params}`, { auth: true }).then((d) => setOrders(Array.isArray(d.orders) ? d.orders : [])).catch(() => {});
  };

  // The branch list (pickup locations) drives the filter dropdown.
  useEffect(() => {
    api.get('/delivery/options').then((d) => setBranches(d.pickupLocations || [])).catch(() => {});
  }, []);

  useEffect(load, [status, branch]);

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
      setRefunding(false);
      setRefundReason('');
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const refundable = detail && ['PAID', 'SIMULATED'].includes(detail.paymentStatus);

  const doRefund = async () => {
    try {
      const { order } = await api.post(
        `/admin/orders/${detail.id}/refund`,
        { reason: refundReason },
        { auth: true }
      );
      setDetail(order);
      setOrders((os) => os.map((o) => (o.id === order.id ? { ...o, ...order } : o)));
      setRefunding(false);
      setRefundReason('');
      toast(`Refunded ${ghs(order.refundAmount)} for ${order.id}. Customer notified.`, 'success');
    } catch (err) {
      toast(err.message, 'error');
    }
  };


  // Escape closes the dialog (a keyboard user's only way back out), and focus is moved
  // into it so the next Tab goes to the dialog's own controls rather than the page behind.
  const dialogRef = useRef(null);
  useEscape(!!detail, () => setDetail(null));
  useEffect(() => {
    if (detail) dialogRef.current?.focus();
  }, [detail]);
  return (
    <div>
      <h2 className="admin-title">Order Management</h2>

      <div className="admin-toolbar">
        <select aria-label="Filter by order status" className="form-select" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="ALL">All Statuses</option>
          {STATUSES.map((s) => <option key={s}>{s.replace(/_/g, ' ')}</option>)}
        </select>
        {branches.length > 1 && (
          <select aria-label="Filter by branch" className="form-select" value={branch} onChange={(e) => setBranch(e.target.value)}>
            <option value="ALL">All Branches</option>
            {branches.map((b) => <option key={b.id} value={b.name}>{b.name}</option>)}
          </select>
        )}
        <input aria-label="Search orders"
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
            <th scope="col">Order ID</th><th scope="col">Customer</th><th scope="col">Items</th><th scope="col">Amount</th>
            <th scope="col">Payment</th><th scope="col">Status</th><th scope="col">Branch</th><th scope="col">Date</th><th scope="col">Action</th>
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
                  <span key={i.id} className="item-chip">{i.name}</span>
                ))}
              </td>
              <td>{ghs(o.total)}</td>
              <td><StatusBadge status={o.paymentStatus} /></td>
              <td className="muted small">{o.pickupLocation || '—'}</td>
              <td>
                <select aria-label="Change order status"
                  className="form-select status-select"
                  value={o.status}
                  onChange={(e) => updateStatus(o.id, e.target.value)}
                >
                  {STATUSES.map((s) => <option key={s}>{s.replace(/_/g, ' ')}</option>)}
                </select>
              </td>
              <td>{fmtDate(o.createdAt)}</td>
              <td className="row-actions">
                <button className="btn btn-secondary btn-sm" onClick={() => openDetail(o.id)}>View</button>
                <button
                  className="btn btn-ghost btn-sm"
                  title="Print customer receipt"
                  onClick={() => navigate(`/admin/print/${o.id}?doc=receipt&auto=1`)}
                >
                  <Printer size={14} /> Receipt
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  title="Print kitchen ticket"
                  onClick={() => navigate(`/admin/print/${o.id}?doc=kitchen&auto=1`)}
                >
                  <ChefHat size={14} /> Ticket
                </button>
              </td>
            </tr>
          ))}
          {orders.length === 0 && <tr><td colSpan="8" className="centered muted">No orders found</td></tr>}
        </tbody>
      </table>

      {detail && (
        <div className="modal active" onClick={(e) => e.target === e.currentTarget && setDetail(null)}>
          <div ref={dialogRef} tabIndex={-1} className="modal-content modal-wide" role="dialog" aria-modal="true" aria-labelledby="order-dialog-title">
            <div className="modal-header">
              <h3 id="order-dialog-title">Order {detail.id}</h3>
              <div className="modal-header-actions">
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => navigate(`/admin/print/${detail.id}?doc=receipt`)}
                >
                  <Printer size={15} /> Receipt
                </button>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => navigate(`/admin/print/${detail.id}?doc=kitchen`)}
                >
                  <ChefHat size={15} /> Kitchen ticket
                </button>
                <button className="close-btn" onClick={() => setDetail(null)}>×</button>
              </div>
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
                    <span className="item-chip">{i.name} × {i.quantity} — {ghs(i.price * i.quantity)}</span>
                    <span className="muted"> ({[i.size, i.flavor, i.icing].filter(Boolean).join(' · ') || 'standard'})</span>
                    {i.inscription && <> — "{i.inscription}"</>}
                  </p>
                ))}
                {detail.notes && <p className="small"><strong>Notes:</strong> {detail.notes}</p>}
              </div>
            </div>

            {detail.paymentStatus === 'REFUNDED' ? (
              <div className="refund-note">
                <strong>This order has been refunded.</strong>
                <p className="small" style={{ margin: '6px 0 0' }}>
                  {ghs(detail.refundAmount || detail.total)} returned
                  {detail.refundStatus === 'OFFLINE' ? ' (settled offline)' : ''}
                  {detail.refundRef && detail.refundRef !== 'offline' ? ` · Paystack ref ${detail.refundRef}` : ''}
                  {detail.refundReason ? ` · ${detail.refundReason}` : ''}
                </p>
                <div className="refund-meta">
                  <span className="muted">Refunded {fmtDateTime(detail.refundedAt)}</span>
                  <span className="muted">Stock returned to inventory</span>
                </div>
              </div>
            ) : refundable ? (
              <div className="refund-box">
                <h4><RotateCcw size={15} /> Refund this order</h4>
                {!refunding ? (
                  <>
                    <p className="muted small" style={{ margin: '0 0 10px' }}>
                      Returns the full {ghs(detail.total)} to the customer, frees the stock back up and notifies
                      them by SMS, WhatsApp and email. The order then stops counting towards revenue.
                    </p>
                    <button className="btn btn-secondary btn-sm" onClick={() => setRefunding(true)}>
                      <RotateCcw size={15} /> Start a refund
                    </button>
                  </>
                ) : (
                  <>
                    <label className="form-label" htmlFor="refund-reason">Reason (shown to the customer)</label>
                    <input
                      id="refund-reason"
                      className="form-input"
                      placeholder="e.g. Order cancelled — customer changed their mind"
                      value={refundReason}
                      onChange={(e) => setRefundReason(e.target.value)}
                    />
                    <p className="muted small" style={{ margin: '8px 0 10px' }}>
                      Full refund only ({ghs(detail.total)}). For a part-refund, refund from your Paystack dashboard.
                    </p>
                    <div className="row-actions">
                      <button className="btn btn-secondary btn-sm" onClick={() => setRefunding(false)}>Cancel</button>
                      <button className="btn btn-primary btn-sm" onClick={doRefund}>
                        Refund {ghs(detail.total)} now
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : null}

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
