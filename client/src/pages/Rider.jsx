import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bike, RefreshCw, MapPin, User } from 'lucide-react';
import { api } from '../api.js';
import { useApp } from '../store.jsx';
import { ghs, fmtDateTime } from '../lib/format.js';

/**
 * Lightweight rider app — /rider
 * Riders see deliveries that are READY (awaiting pickup) or OUT_FOR_DELIVERY.
 */
export default function Rider() {
  const { toast } = useApp();
  const [riderName, setRiderName] = useState(localStorage.getItem('ht_rider_name') || '');
  const [riderPhone, setRiderPhone] = useState(localStorage.getItem('ht_rider_phone') || '');
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    api.get('/rider/orders').then((d) => setOrders(d.orders)).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, []);

  const accept = async (order) => {
    if (!riderName.trim()) return toast('Enter your name first', 'error');
    localStorage.setItem('ht_rider_name', riderName);
    localStorage.setItem('ht_rider_phone', riderPhone);
    try {
      await api.post(`/rider/${order.id}/accept`, { riderName, riderPhone });
      toast(`Accepted ${order.id} — out for delivery!`, 'success');
      load();
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const deliver = async (order) => {
    try {
      await api.post(`/rider/${order.id}/deliver`);
      toast(`${order.id} delivered!`, 'success');
      load();
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const awaiting = orders.filter((o) => o.status === 'READY');
  const mine = orders.filter((o) => o.status === 'OUT_FOR_DELIVERY');

  return (
    <div className="page rider-page">
      <div className="rider-header">
        <h1><Bike size={24} /> Homely Treats — Rider App</h1>
        <Link to="/" className="btn btn-secondary btn-sm">Exit</Link>
      </div>

      <div className="container">
        <div className="section">
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Your name</label>
              <input className="form-input" value={riderName} onChange={(e) => setRiderName(e.target.value)} placeholder="e.g. Kwame" />
            </div>
            <div className="form-group">
              <label className="form-label">Phone</label>
              <input className="form-input" value={riderPhone} onChange={(e) => setRiderPhone(e.target.value)} placeholder="05x xxx xxxx" />
            </div>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={load}><RefreshCw size={14} /> Refresh</button>
        </div>

        {loading ? (
          <div className="empty-state"><p>Loading deliveries…</p></div>
        ) : (
          <>
            <h2 className="section-title">Awaiting pickup ({awaiting.length})</h2>
            <div className="rider-list">
              {awaiting.map((o) => (
                <div className="rider-card" key={o.id}>
                  <div className="rider-card-head">
                    <strong>{o.id}</strong>
                    <span className="status-badge status-ready">READY</span>
                  </div>
                  <p>{o.items.map((i) => `${i.name} ×${i.quantity}`).join(', ')}</p>
                  <p className="muted small"><MapPin size={13} /> {o.deliveryZone}{o.deliveryAddress ? ` — ${o.deliveryAddress}` : ''}</p>
                  <p className="muted small"><User size={13} /> {o.user?.fullName || o.guestName} · {o.user?.phone || o.guestPhone}</p>
                  <p className="muted small">Total {ghs(o.total)} · {fmtDateTime(o.updatedAt)}</p>
                  <button className="btn btn-primary btn-block" onClick={() => accept(o)}>Accept & Start Delivery</button>
                </div>
              ))}
              {awaiting.length === 0 && <p className="muted centered">No deliveries awaiting pickup</p>}
            </div>

            <h2 className="section-title">My active deliveries ({mine.length})</h2>
            <div className="rider-list">
              {mine.map((o) => (
                <div className="rider-card" key={o.id}>
                  <div className="rider-card-head">
                    <strong>{o.id}</strong>
                    <span className="status-badge status-progress">OUT FOR DELIVERY</span>
                  </div>
                  <p>{o.items.map((i) => `${i.name} ×${i.quantity}`).join(', ')}</p>
                  <p className="muted small"><MapPin size={13} /> {o.deliveryZone}{o.deliveryAddress ? ` — ${o.deliveryAddress}` : ''}</p>
                  <p className="muted small"><User size={13} /> {o.user?.fullName || o.guestName} · {o.user?.phone || o.guestPhone}</p>
                  <button className="btn btn-primary btn-block" onClick={() => deliver(o)}>Mark as Delivered</button>
                </div>
              ))}
              {mine.length === 0 && <p className="muted centered">No active deliveries.</p>}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
