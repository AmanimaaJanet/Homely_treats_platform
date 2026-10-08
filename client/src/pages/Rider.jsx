import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Bike,
  RefreshCw,
  MapPin,
  User,
  ShieldCheck,
  LogOut,
  Package,
  CheckCircle2,
  Lock,
  Phone,
  TrendingUp,
  LocateFixed,
} from 'lucide-react';
import { api } from '../api.js';
import { useApp } from '../store.jsx';
import { ghs, fmtDateTime } from '../lib/format.js';
import Seo from '../components/Seo.jsx';

/**
 * Rider app — /rider
 *
 * Riders sign in with an account created for them by the bakery admin (there is
 * no rider self-signup). The API only returns:
 *   available → unclaimed READY deliveries, with the customer's address and phone
 *               withheld until a rider accepts,
 *   mine      → jobs this rider has claimed (full delivery details),
 *   completed → their recent deliveries, plus their delivery-fee history
 *               (what the shop charges customers; actual pay is between rider and shop).
 *
 * While riding, the rider can share live GPS so the customer's tracking page shows
 * the approach. Positions live only while the delivery is out for delivery.
 */
export default function Rider() {
  const navigate = useNavigate();
  const { user, login, logout, toast } = useApp();

  const isRider = user?.role === 'RIDER';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [signingIn, setSigningIn] = useState(false);

  const [data, setData] = useState({ available: [], mine: [], completed: [] });
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [earnings, setEarnings] = useState(null);

  // Live location sharing. States: 'idle' (off), 'asking' (browser prompt showing),
  // 'on', 'denied' (customer said no), 'unsupported' (no GPS on this device).
  const [locStatus, setLocStatus] = useState('idle');
  const watchRef = useRef(null);
  const lastSentRef = useRef(0);
  const mineRef = useRef([]);
  mineRef.current = data.mine;

  const load = useCallback(() => {
    if (!isRider) return;
    api.get('/rider/orders', { auth: true })
      .then(setData)
    api.get('/rider/earnings', { auth: true }).then(setEarnings).catch(() => {})
      .catch((err) => {
        if (err.status === 401 || err.status === 403) {
          toast('Your rider session has ended — please sign in again', 'error');
          logout();
        }
      })
      .finally(() => setLoading(false));
  }, [isRider, logout, toast]);

  useEffect(() => {
    if (!isRider) {
      setLoading(false);
      return;
    }
    load();
    const t = setInterval(load, 15000); // keep the job list fresh
    return () => clearInterval(t);
  }, [isRider, load]);

  // Stop watching when the last active delivery ends — no reason to keep the GPS on.
  useEffect(() => {
    if (data.mine.length === 0 && locStatus === 'on') stopSharing();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.mine.length]);

  // Always let go of the GPS on unmount.
  useEffect(() => () => {
    if (watchRef.current) navigator.geolocation.clearWatch(watchRef.current);
  }, []);

  const sendPosition = (pos) => {
    const body = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy };
    // At most one send per 10 seconds: the customer wants to see the rider moving,
    // not a per-second trace, and the battery cares.
    const now = Date.now();
    if (now - lastSentRef.current < 10000) return;
    lastSentRef.current = now;
    mineRef.current.forEach((o) => {
      api.post(`/rider/${o.id}/location`, body, { auth: true }).catch(() => {});
    });
  };

  const startSharing = () => {
    if (!('geolocation' in navigator)) {
      setLocStatus('unsupported');
      toast('This device cannot share location', 'error');
      return;
    }
    setLocStatus('asking');
    watchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setLocStatus('on');
        sendPosition(pos);
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setLocStatus('denied');
          toast('Location permission refused — the customer will not see your approach', 'error');
        } else {
          setLocStatus('unsupported');
          toast('Could not get a GPS fix on this device', 'error');
        }
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 },
    );
  };

  const stopSharing = () => {
    if (watchRef.current) navigator.geolocation.clearWatch(watchRef.current);
    watchRef.current = null;
    setLocStatus('idle');
    lastSentRef.current = 0;
  };

  const signIn = async (e) => {
    e.preventDefault();
    setSigningIn(true);
    try {
      const res = await api.post('/auth/login', { email: email.trim().toLowerCase(), password });
      if (res.user.role !== 'RIDER') {
        toast('That account is not a rider account', 'error');
        return;
      }
      login(res.token, res.user);
      toast(`Welcome, ${res.user.fullName.split(' ')[0]}`, 'success');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSigningIn(false);
    }
  };

  const accept = async (order) => {
    setBusyId(order.id);
    try {
      await api.post(`/rider/${order.id}/accept`, {}, { auth: true });
      toast(`Accepted ${order.id} — out for delivery`, 'success');
      load();
    } catch (err) {
      toast(err.message, 'error');
      load(); // someone else may have taken it
    } finally {
      setBusyId(null);
    }
  };

  const deliver = async (order) => {
    setBusyId(order.id);
    try {
      await api.post(`/rider/${order.id}/deliver`, {}, { auth: true });
      toast(`${order.id} delivered — nice work`, 'success');
      load();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusyId(null);
    }
  };

  // ---------------------------------------------------------------- sign-in gate
  if (!isRider) {
    return (
      <div className="page rider-page">
        <div className="rider-signin">
          <div className="rider-signin-card">
            <div className="rider-signin-logo"><Bike size={38} strokeWidth={1.6} /></div>
            <h1>Rider sign in</h1>
            <p className="muted">
              Use the rider account the bakery created for you. Deliveries you accept will appear
              here with the customer&apos;s address and phone number.
            </p>

            <form onSubmit={signIn}>
              <div className="form-group">
                <label className="form-label">
                  <span className="form-label-text">Email</span>
                  <input
                    type="email"
                    className="form-input"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    required
                  />
                </label>
              </div>
              <div className="form-group">
                <label className="form-label">
                  <span className="form-label-text">Password</span>
                  <input
                    type="password"
                    className="form-input"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    required
                  />
                </label>
              </div>
              <button className="btn btn-primary btn-block" disabled={signingIn}>
                {signingIn ? 'Signing in…' : 'Sign in'}
              </button>
            </form>

            <div className="rider-signin-note">
              <Lock size={14} /> Riders can only see deliveries they have accepted.
            </div>
            <p className="muted small" style={{ textAlign: 'center', marginTop: '1rem' }}>
              Don&apos;t have rider access? Ask the bakery to set up your account.
            </p>
            <p className="muted small" style={{ textAlign: 'center' }}>
              <Link to="/" className="btn-link">Back to the store</Link>
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------- rider board
  const { available = [], mine = [], completed = [] } = data;

  return (
    <div className="page rider-page">
    <Seo title="Rider Dashboard" description="Rider delivery dashboard." noindex />
      <div className="rider-header">
        <div>
          <h1><Bike size={22} /> Rider app</h1>
          <p className="rider-header-sub">
            Signed in as {user.fullName} · {user.phone}
          </p>
        </div>
        <div className="rider-header-actions">
          <button className="btn btn-secondary btn-sm" onClick={() => { setLoading(true); load(); }}>
            <RefreshCw size={14} /> Refresh
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => { logout(); navigate('/'); }}>
            <LogOut size={14} /> Sign out
          </button>
        </div>
      </div>

      <div className="container">
        {/* Stats strip */}
        <div className="rider-stats">
          <div className="rider-stat">
            <Package size={18} />
            <div>
              <strong>{available.length}</strong>
              <span>Available</span>
            </div>
          </div>
          <div className="rider-stat">
            <Bike size={18} />
            <div>
              <strong>{mine.length}</strong>
              <span>On the road</span>
            </div>
          </div>
          <div className="rider-stat">
            <CheckCircle2 size={18} />
            <div>
              <strong>{completed.length}</strong>
              <span>Recent deliveries</span>
            </div>
          </div>
          <div className="rider-stat">
            <TrendingUp size={18} />
            <div>
              <strong>{earnings ? ghs(earnings.thisWeek.deliveryFees) : '—'}</strong>
              <span>Fees this week{earnings ? ` · ${earnings.allTime.deliveries} all-time` : ''}</span>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="empty-state"><p>Loading deliveries…</p></div>
        ) : (
          <>
            <div className="rider-road-head">
              <h2 className="section-title">On the road ({mine.length})</h2>
              {mine.length > 0 && (
                <button
                  className={`btn btn-sm ${locStatus === 'on' ? 'btn-secondary' : 'btn-primary'}`}
                  onClick={locStatus === 'on' ? stopSharing : startSharing}
                  disabled={locStatus === 'asking'}
                >
                  <LocateFixed size={14} />
                  {locStatus === 'on' ? 'Stop sharing' : locStatus === 'asking' ? 'Asking…' : 'Share live location'}
                </button>
              )}
            </div>
            {mine.length > 0 && locStatus !== 'on' && (
              <p className="muted small rider-share-hint">
                {locStatus === 'denied'
                  ? 'Location is off for this site — the customer sees your status but not your approach. Allow it in the browser to share.'
                  : locStatus === 'unsupported'
                    ? 'This device cannot share GPS — the customer sees your status but not your approach.'
                    : 'Share your location while riding so the customer can see you approaching (uses GPS; nothing is kept after delivery).'}
              </p>
            )}
            <div className="rider-list">
              {mine.map((o) => (
                <div className="rider-card rider-card-active" key={o.id}>
                  <div className="rider-card-head">
                    <strong>{o.id}</strong>
                    <span className="status-badge status-progress">OUT FOR DELIVERY</span>
                  </div>
                  <p className="rider-items">{o.items.map((i) => `${i.name} ×${i.quantity}`).join(', ')}</p>
                  <div className="rider-detail">
                    <MapPin size={14} />
                    <span><strong>{o.deliveryZone}</strong>{o.deliveryAddress ? ` — ${o.deliveryAddress}` : ''}</span>
                  </div>
                  <div className="rider-detail">
                    <User size={14} />
                    <span>{o.user?.fullName || o.guestName || 'Customer'}</span>
                  </div>
                  {(o.user?.phone || o.guestPhone) && (
                    <div className="rider-detail">
                      <Phone size={14} />
                      <a href={`tel:${(o.user?.phone || o.guestPhone).replace(/\s/g, '')}`}>
                        {o.user?.phone || o.guestPhone}
                      </a>
                    </div>
                  )}
                  <p className="muted small">
                    {ghs(o.total)} · {o.paymentStatus === 'COD' ? 'Collect cash on delivery' : 'Paid'}
                    {o.notes ? ` · Note: ${o.notes}` : ''}
                  </p>
                  <button
                    className="btn btn-primary btn-block"
                    onClick={() => deliver(o)}
                    disabled={busyId === o.id}
                  >
                    {busyId === o.id ? 'Saving…' : 'Mark as Delivered'}
                  </button>
                </div>
              ))}
              {mine.length === 0 && <p className="muted centered">No active deliveries.</p>}
            </div>

            <h2 className="section-title">Available deliveries ({available.length})</h2>
            <div className="rider-list">
              {available.map((o) => (
                <div className="rider-card" key={o.id}>
                  <div className="rider-card-head">
                    <strong>{o.id}</strong>
                    <span className="status-badge status-ready">READY</span>
                  </div>
                  <p className="rider-items">{o.items.map((i) => `${i.name} ×${i.quantity}`).join(', ')}</p>
                  <div className="rider-detail">
                    <MapPin size={14} />
                    <span><strong>{o.deliveryZone}</strong></span>
                  </div>
                  <p className="muted small">
                    {ghs(o.total)} · {o.paymentStatus === 'COD' ? 'Cash on delivery' : 'Paid'}
                    {o.readyDate ? ` · Ready ${fmtDateTime(o.readyDate)}` : ''}
                  </p>
                  <p className="rider-hint">
                    <Lock size={12} /> Customer details appear once you accept
                  </p>
                  <button
                    className="btn btn-primary btn-block"
                    onClick={() => accept(o)}
                    disabled={busyId === o.id}
                  >
                    {busyId === o.id ? 'Accepting…' : 'Accept & Start Delivery'}
                  </button>
                </div>
              ))}
              {available.length === 0 && <p className="muted centered">No deliveries awaiting pickup</p>}
            </div>

            {completed.length > 0 && (
              <>
                <h2 className="section-title">Recently delivered</h2>
                <div className="rider-completed">
                  {completed.map((o) => (
                    <div className="rider-completed-row" key={o.id}>
                      <span><ShieldCheck size={15} /> {o.id}</span>
                      <span className="muted small">{o.deliveryZone} · fee {ghs(o.deliveryFee)}</span>
                      <span className="muted small">{fmtDateTime(o.updatedAt)}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
