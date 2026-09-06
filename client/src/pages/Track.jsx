import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { MessageSquare, Mail, MessageCircle, Bike, Copy, Check, Circle } from 'lucide-react';
import { api } from '../api.js';
import StatusBadge from '../components/StatusBadge.jsx';
import { ProductIcon } from '../components/ProductIcon.jsx';
import { ghs, fmtDate, fmtDateTime } from '../lib/format.js';

const CHANNEL_ICON = { SMS: MessageSquare, EMAIL: Mail, WHATSAPP: MessageCircle };

export default function Track() {
  const [params, setParams] = useSearchParams();
  const [ref, setRef] = useState(params.get('ref') || '');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [live, setLive] = useState(false);
  const [pickupAddress, setPickupAddress] = useState('Airport Residential, Accra');
  const wsRef = useRef(null);
  const refRef = useRef(ref);
  refRef.current = ref;

  useEffect(() => {
    api.get('/settings/public').then((d) => setPickupAddress(d.settings.businessAddress || pickupAddress)).catch(() => {});
  }, []);

  const load = (r) => {
    setError('');
    setLoading(true);
    api
      .get(`/orders/track/${encodeURIComponent(r.trim())}`)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  const loadRef = useRef(load);
  loadRef.current = load;

  // Real-time updates: WebSocket first, polling fallback
  useEffect(() => {
    const id = refRef.current.trim();
    if (!id) return undefined;
    let poll = null;
    let closed = false;

    const startPolling = () => {
      setLive(false);
      if (poll) clearInterval(poll);
      poll = setInterval(() => loadRef.current(id), 12000);
    };

    const connect = () => {
      try {
        const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
        const ws = new WebSocket(`${proto}://${window.location.host}/ws?order=${id}`);
        wsRef.current = ws;
        ws.onopen = () => {
          setLive(true);
          if (poll) clearInterval(poll);
        };
        ws.onmessage = (e) => {
          try {
            const m = JSON.parse(e.data);
            if (m.type === 'ORDER_UPDATED' && m.orderId === id) loadRef.current(id);
          } catch { /* ignore */ }
        };
        ws.onerror = () => { if (!closed) { ws.close(); startPolling(); } };
        ws.onclose = () => { if (!closed) startPolling(); };
      } catch {
        startPolling();
      }
    };

    connect();
    return () => {
      closed = true;
      if (wsRef.current) wsRef.current.close();
      if (poll) clearInterval(poll);
    };
  }, []);

  const submit = (e) => {
    e.preventDefault();
    if (!ref.trim()) return;
    setParams({ ref: ref.trim() });
    load(ref.trim());
  };

  const { order, timeline } = data || {};

  return (
    <div className="page">
      <div className="container">
        <div className="section">
          <h2 className="section-title">Track Your Order</h2>
          <p className="centered muted">Enter your order reference to see real-time status updates</p>

          <div className="track-search">
            <form onSubmit={submit} className="track-form">
              <input
                className="form-input"
                placeholder="HT-YYYYMMDD-0001"
                value={ref}
                onChange={(e) => setRef(e.target.value)}
              />
              <button className="btn btn-primary" type="submit">Track →</button>
            </form>
          </div>

          {loading && <div className="empty-state"><p>Loading…</p></div>}
          {error && <div className="alert danger">{error}</div>}

          {order && (
            <>
              <div className="track-card">
                <div className="track-card-head">
                  <div>
                    <h3>{order.items.map((i) => i.name).join(' + ')}</h3>
                    <p className="muted">
                      {fmtDate(order.createdAt)} · {ghs(order.total)} · {order.paymentMethod === 'COD' ? 'Pay on delivery' : order.paymentMethod} ·{' '}
                      <StatusBadge status={order.paymentStatus} />
                    </p>
                    {order.status !== 'CANCELLED' && (
                      <span className={`live-pill ${live ? 'live-on' : ''}`}>
                        {live ? '● Live updates' : '○ Auto-refresh'}
                      </span>
                    )}
                  </div>
                  <button className="btn btn-secondary" onClick={() => navigator.clipboard?.writeText(order.id)}>
                    <Copy size={15} /> {order.id}
                  </button>
                </div>

                {order.riderName && ['READY', 'OUT_FOR_DELIVERY', 'DELIVERED'].includes(order.status) && (
                  <div className="rider-chip">
                    <Bike size={16} /> <strong>{order.riderName}</strong>{order.riderPhone && <> · {order.riderPhone}</>} is your rider
                  </div>
                )}

                <div className="tracking-timeline">
                  {timeline.map((step) => (
                    <div key={step.key} className={`timeline-item ${step.done ? 'completed' : ''}`}>
                      <div className="timeline-icon">
                        {step.done ? <Check size={13} /> : <Circle size={13} />}
                      </div>
                      <div>
                        <h4>{step.label}</h4>
                        <p className="muted small">{step.at ? fmtDateTime(step.at) : step.done ? 'Done' : 'Pending'}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="track-grid">
                <div>
                  <h3 className="form-heading">Order Details</h3>
                  <div className="info-card">
                    <p><strong>Order ID:</strong> {order.id}</p>
                    <p><strong>Delivery:</strong> {order.deliveryMethod === 'DELIVERY' ? `Home Delivery — ${order.deliveryZone || ''}${order.deliveryAddress ? ', ' + order.deliveryAddress : ''}` : `Pickup (${pickupAddress})`}</p>
                    <p><strong>Ready Date:</strong> {fmtDate(order.readyDate)}</p>
                    <p><strong>Subtotal:</strong> {ghs(order.subtotal)}</p>
                    {order.discount > 0 && <p><strong>Discount:</strong> −{ghs(order.discount)}</p>}
                    {order.loyaltyDiscount > 0 && <p><strong>Loyalty points:</strong> −{ghs(order.loyaltyDiscount)} ({order.pointsRedeemed} pts)</p>}
                    <p><strong>Delivery fee:</strong> {ghs(order.deliveryFee)}</p>
                    <p><strong>Total Paid:</strong> {ghs(order.total)}</p>
                    <p><strong>Status:</strong> <StatusBadge status={order.status} /></p>
                  </div>
                </div>

                <div>
                  <h3 className="form-heading">Items Ordered</h3>
                  {order.items.map((i) => (
                    <div className="info-card" key={i.id}>
                      <p className="item-line"><ProductIcon name={i.emoji} size={18} /> <strong>{i.name}</strong> × {i.quantity}</p>
                      <p className="muted small">{[i.size, i.flavor, i.icing].filter(Boolean).join(' · ')}</p>
                      {i.inscription && <p className="italic">"{i.inscription}"</p>}
                      <p className="small">{ghs(i.price * i.quantity)}</p>
                    </div>
                  ))}
                  {order.photos?.length > 0 && (
                    <div className="info-card">
                      <strong>Design references</strong>
                      <div className="thumb-row">
                        {order.photos.map((p) => <img key={p.id} className="thumb-img lg" src={p.url} alt="design" />)}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div style={{ marginTop: '2rem' }}>
                <h3 className="form-heading">Notifications Sent</h3>
                {order.notifications.length === 0 ? (
                  <p className="muted">No notifications yet.</p>
                ) : (
                  <div className="notif-grid">
                    {order.notifications.map((n) => {
                      const CIcon = CHANNEL_ICON[n.channel] || MessageSquare;
                      const channelLabel = n.channel === 'SMS' ? 'SMS' : n.channel === 'WHATSAPP' ? 'WhatsApp' : 'Email';
                      return (
                        <div className="info-card" key={n.id}>
                          <p><CIcon size={15} /> <strong>{channelLabel}: {n.type.replace(/_/g, ' ')}</strong></p>
                          <p className="muted small">
                            {fmtDateTime(n.createdAt)} · {n.status === 'SIMULATED' ? 'Simulated' : n.status === 'SENT' ? 'Delivered' : n.status}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
