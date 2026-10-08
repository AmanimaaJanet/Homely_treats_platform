import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { MessageSquare, Mail, MessageCircle, Bike, Copy, Check, Circle, UserPlus, LogIn, LocateFixed } from 'lucide-react';
import { api } from '../api.js';
import { useApp } from '../store.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import { ghs, fmtDate, fmtDateTime } from '../lib/format.js';
import { distanceKm, etaMinutes, formatKm } from '../lib/geo.js';
import Seo from '../components/Seo.jsx';

const CHANNEL_ICON = { SMS: MessageSquare, EMAIL: Mail, WHATSAPP: MessageCircle };

export default function Track() {
  const [params, setParams] = useSearchParams();
  const [ref, setRef] = useState(params.get('ref') || '');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [live, setLive] = useState(false);
  const [pickupAddress, setPickupAddress] = useState('Airport Residential, Accra');
  const [branchHours, setBranchHours] = useState('');
  const { user } = useApp();
  const navigate = useNavigate();
  const wsRef = useRef(null);
  const refRef = useRef(ref);
  refRef.current = ref;

  // Live rider position (from the rider's GPS, via the server) and — only if the
  // customer opts in — their own location, used to measure the remaining distance.
  // The customer's coordinates never leave this browser: the distance is computed
  // right here.
  const [riderPos, setRiderPos] = useState(null);
  const [myLoc, setMyLoc] = useState(null);
  const [locState, setLocState] = useState('idle'); // idle | asking | have | denied
  const [now, setNow] = useState(0);

  useEffect(() => {
    api.get('/settings/public').then((d) => setPickupAddress(d.settings.businessAddress || pickupAddress)).catch(() => {});
  }, []);

  const load = (r) => {
    setError('');
    setLoading(true);
    api
      .get(`/orders/track/${encodeURIComponent(r.trim())}`)
      .then((d) => {
        setData(d);
        // With more than one branch, the customer must see the address of the branch
        // they actually chose, not the shop-wide one.
        if (d.pickupBranch?.address) {
          setPickupAddress(d.pickupBranch.address);
          setBranchHours(d.pickupBranch.hours || '');
        }
        // Pick up the rider's last known position (the WebSocket below keeps it live).
        if (d.order?.status === 'OUT_FOR_DELIVERY') {
          api.get(`/orders/${encodeURIComponent(r.trim())}/rider-location`)
            .then((p) => setRiderPos(p.position || null))
            .catch(() => {});
        } else {
          setRiderPos(null);
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  const loadRef = useRef(load);
  loadRef.current = load;

  // Keep the "updated Ns ago" readout honest while a rider is live.
  useEffect(() => {
    if (!riderPos) return undefined;
    setNow(Date.now()); // immediately, then every few seconds
    const t = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(t);
  }, [riderPos]);

  const shareMyLocation = () => {
    if (!('geolocation' in navigator)) return setLocState('denied');
    setLocState('asking');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setMyLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocState('have');
      },
      () => setLocState('denied'),
      { enableHighAccuracy: true, timeout: 15000 },
    );
  };

  const secsAgo = riderPos ? Math.max(0, Math.round((now - riderPos.updatedAt) / 1000)) : 0;
  const kmAway = riderPos && myLoc ? distanceKm(myLoc.lat, myLoc.lng, riderPos.lat, riderPos.lng) : null;

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
            if (m.type === 'RIDER_LOCATION' && m.orderId === id) {
              setRiderPos({ lat: m.lat, lng: m.lng, accuracy: m.accuracy, updatedAt: m.updatedAt });
            }
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
  // A guest order is a dead end unless we offer the next step. Shown only when the
  // visitor is signed out: "keep this order — and order faster next time".
  const showClaim = order && !user && !order.userId;

  return (
    <div className="page">
    <Seo title="Track Your Order" description="Follow your order from the kitchen to your door in real time." />
      <div className="container">
        {showClaim && (
          <section className="claim-panel">
            <div>
              <strong><UserPlus size={16} /> Keep track of this order</strong>
              <p className="muted small" style={{ margin: '4px 0 0' }}>
                Create an account with the same email you ordered with and this order joins your
                history — plus you can reorder in two taps next time.
              </p>
            </div>
            <div className="row-actions">
              <button className="btn btn-primary btn-sm" onClick={() => navigate('/register')}>
                <UserPlus size={14} /> Create an account
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => navigate('/signin')}>
                <LogIn size={14} /> Sign in
              </button>
            </div>
          </section>
        )}

        <div className="section">
          <h2 className="section-title">Track Your Order</h2>
          <p className="centered muted">Enter your order reference to see real-time status updates</p>

          <div className="track-search">
            <form onSubmit={submit} className="track-form">
              <input aria-label="Order number"
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

                {order.status === 'OUT_FOR_DELIVERY' && (
                  <div className="rider-live">
                    {riderPos ? (
                      <>
                        <div className="rider-live-top">
                          <span className="rider-live-dot" aria-hidden="true" />
                          <strong>{order.riderName || 'Your rider'} is on the way</strong>
                          <span className="muted small">· updated {secsAgo}s ago</span>
                        </div>
                        {kmAway !== null ? (
                          <p className="rider-live-dist">
                            About {formatKm(kmAway)} away — roughly {etaMinutes(kmAway)} min
                          </p>
                        ) : (
                          <div className="rider-live-share">
                            <p className="muted small">
                              {locState === 'denied'
                                ? 'Location sharing is off — you will still see status updates here.'
                                : 'See how far away they are:'}
                            </p>
                            {locState !== 'denied' && locState !== 'have' && (
                              <button className="btn btn-secondary btn-sm" onClick={shareMyLocation} disabled={locState === 'asking'}>
                                <LocateFixed size={14} /> {locState === 'asking' ? 'Asking…' : 'Show their distance'}
                              </button>
                            )}
                          </div>
                        )}
                        <p className="muted small rider-live-note">
                          Live while out for delivery. Your own location is used only in this browser to
                          measure the distance — it is never sent anywhere.
                        </p>
                      </>
                    ) : (
                      <p className="muted small">
                        When your rider shares their location, their approach will appear here live.
                      </p>
                    )}
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
                    <p><strong>Delivery:</strong> {order.deliveryMethod === 'DELIVERY' ? `Home Delivery — ${order.deliveryZone || ''}${order.deliveryAddress ? ', ' + order.deliveryAddress : ''}` : `Pickup from ${order.pickupLocation || 'our shop'} — ${pickupAddress}${branchHours ? ` (${branchHours})` : ''}`}</p>
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
                      <p className="item-line"><strong>{i.name}</strong> × {i.quantity}</p>
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
