import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardList, UserCircle, Lock, LogOut, Gem, Star, Cake, ShoppingBag, Heart, Bell } from 'lucide-react';
import { api } from '../api.js';
import { useApp } from '../store.jsx';
import PushToggle from '../components/PushToggle.jsx';
import SavedItems from '../components/SavedItems.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import { ghs, fmtDate, initials } from '../lib/format.js';
import { useEscape } from '../lib/a11y.js';
import Seo from '../components/Seo.jsx';

function Stars({ value, onChange }) {
  return (
    <div className="stars-input">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          size={26}
          className={n <= value ? 'star star-on' : 'star'}
          onClick={() => onChange?.(n)}
          role="button"
        />
      ))}
    </div>
  );
}

export default function Account() {
  const navigate = useNavigate();
  const { user, setUser, logout, addToCart, toast } = useApp();
  const [tab, setTab] = useState('orders');
  const [orders, setOrders] = useState([]);
  const [profile, setProfile] = useState({ fullName: '', phone: '' });
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });
  const [reviewing, setReviewing] = useState(null);

  // Escape closes the review dialog (a keyboard user's only way back out), and focus is
  // moved into it so the next Tab goes to the dialog's own controls, not the page behind.
  const dialogRef = useRef(null);
  useEscape(!!reviewing, () => setReviewing(null));
  useEffect(() => {
    if (reviewing) dialogRef.current?.focus();
  }, [reviewing]);
  const [reviewForm, setReviewForm] = useState({ rating: 5, comment: '' });

  useEffect(() => {
    if (!user) return;
    setProfile({ fullName: user.fullName, phone: user.phone });
    api.get('/orders/my', { auth: true }).then((d) => setOrders(d.orders)).catch(() => {});
  }, [user]);

  if (!user) {
    return (
      <div className="page">
        <div className="container">
          <div className="section empty-state">
            <div className="empty-state-icon"><Lock size={52} strokeWidth={1.2} /></div>
            <p className="empty-state-text">Please sign in to view your account</p>
            <button className="btn btn-primary" onClick={() => navigate('/signin')}>Sign In</button>
          </div>
        </div>
      </div>
    );
  }

  const saveProfile = async (e) => {
    e.preventDefault();
    try {
      const { user: updated } = await api.put('/auth/profile', profile, { auth: true });
      setUser(updated);
      toast('Profile updated', 'success');
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const changePassword = async (e) => {
    e.preventDefault();
    if (pw.next !== pw.confirm) return toast('Passwords do not match', 'error');
    try {
      await api.put('/auth/password', { currentPassword: pw.current, newPassword: pw.next }, { auth: true });
      setPw({ current: '', next: '', confirm: '' });
      toast('Password changed', 'success');
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const resendVerify = async () => {
    try {
      await api.post('/auth/resend-verification', {}, { auth: true });
      toast('Verification email sent', 'success');
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const orderAgain = (order) => {
    order.items.forEach((i) =>
      addToCart({
        key: `${i.productId}-${i.flavor}-${i.size}-${i.icing}-${Date.now()}`,
        productId: i.productId,
        name: i.name,
        icon: i.emoji,
        price: i.price,
        quantity: i.quantity,
        flavor: i.flavor,
        size: i.size,
        icing: i.icing,
        inscription: i.inscription,
        readyDate: null,
      })
    );
    navigate('/cart');
  };

  const submitReview = async (e) => {
    e.preventDefault();
    try {
      const { bonusPoints, awaitingApproval } = await api.post(
        '/reviews',
        { orderId: reviewing.id, rating: reviewForm.rating, comment: reviewForm.comment },
        { auth: true }
      );
      toast(
        awaitingApproval
          ? `Thank you! +${bonusPoints} points. Your review will appear once the bakery approves it.`
          : `Review submitted! +${bonusPoints} bonus points`,
        'success'
      );
      setReviewing(null);
      setReviewForm({ rating: 5, comment: '' });
      const d = await api.get('/orders/my', { auth: true });
      setOrders(d.orders);
      const me = await api.get('/auth/me', { auth: true });
      setUser(me.user);
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const totalSpent = orders.filter((o) => ['PAID', 'SIMULATED'].includes(o.paymentStatus)).reduce((s, o) => s + o.total, 0);

  return (
    <div className="page">
    <Seo title="Your Account" description="Your orders, loyalty points and saved items." noindex />
      <div className="container">
        <div className="account-layout">
          <div className="section account-side">
            <div className="centered" style={{ marginBottom: '1.5rem' }}>
              <div className="avatar">{initials(user.fullName)}</div>
              <h3>{user.fullName}</h3>
              <p className="muted small">{user.email}</p>
              <span className="points-pill"><Gem size={13} /> {user.loyaltyPoints} pts</span>
            </div>
            {/* Real buttons inside the list items: focusable, announced as buttons, and
                the current tab is marked with aria-current so it is not colour-only. */}
            <ul className="account-menu">
              <li className={tab === 'orders' ? 'active' : ''}>
                <button type="button" onClick={() => setTab('orders')} aria-current={tab === 'orders' ? 'true' : undefined}>
                  <ClipboardList size={16} aria-hidden="true" /> My Orders
                </button>
              </li>
              <li className={tab === 'profile' ? 'active' : ''}>
                <button type="button" onClick={() => setTab('profile')} aria-current={tab === 'profile' ? 'true' : undefined}>
                  <UserCircle size={16} aria-hidden="true" /> Edit Profile
                </button>
              </li>
              <li className={tab === 'saved' ? 'active' : ''}>
                <button type="button" onClick={() => setTab('saved')} aria-current={tab === 'saved' ? 'true' : undefined}>
                  <Heart size={16} aria-hidden="true" /> Saved &amp; Alerts
                </button>
              </li>
              <li className={tab === 'password' ? 'active' : ''}>
                <button type="button" onClick={() => setTab('password')} aria-current={tab === 'password' ? 'true' : undefined}>
                  <Lock size={16} aria-hidden="true" /> Change Password
                </button>
              </li>
              <li className="danger">
                <button type="button" onClick={() => { logout(); navigate('/'); }}>
                  <LogOut size={16} aria-hidden="true" /> Sign Out
                </button>
              </li>
            </ul>
          </div>

          <div>
            {!user.emailVerified && (
              <div className="alert warn">
                Your email is not verified yet. <button className="btn-link" onClick={resendVerify}>Resend verification email</button>
              </div>
            )}

            {tab === 'orders' && (
              <div className="section">
                <h2 className="form-heading">My Orders</h2>
                <div className="mini-stats">
                  <div className="mini-stat"><div className="mini-stat-value">{orders.length}</div><div className="muted">Total Orders</div></div>
                  <div className="mini-stat"><div className="mini-stat-value">{ghs(totalSpent)}</div><div className="muted">Total Spent</div></div>
                  <div className="mini-stat"><div className="mini-stat-value"><Gem size={15} /> {user.loyaltyPoints}</div><div className="muted">Loyalty Points</div></div>
                </div>

                {orders.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-state-icon"><Cake size={52} strokeWidth={1.2} /></div>
                    <p className="empty-state-text">No orders yet</p>
                    <button className="btn btn-primary" onClick={() => navigate('/custom-order')}>Place your first order</button>
                  </div>
                ) : (
                  <table className="table">
                    <thead>
                      <tr><th scope="col">Order ID</th><th scope="col">Date</th><th scope="col">Items</th><th scope="col">Total</th><th scope="col">Status</th><th scope="col"></th></tr>
                    </thead>
                    <tbody>
                      {orders.map((o) => (
                        <tr key={o.id}>
                          <td>{o.id}</td>
                          <td>{fmtDate(o.createdAt)}</td>
                          <td>{o.items.map((i) => i.name).join(', ')}</td>
                          <td>{ghs(o.total)}</td>
                          <td><StatusBadge status={o.status} /></td>
                          <td className="row-actions">
                            <button className="btn-link" onClick={() => navigate(`/track?ref=${o.id}`)}>Track</button>
                            <button className="btn-link" onClick={() => orderAgain(o)}>Order again</button>
                            {o.status === 'DELIVERED' && !o.review && (
                              <button className="btn-link" onClick={() => setReviewing(o)}>Review</button>
                            )}
                            {o.review && (
                              <span className="small">
                                <Star size={13} className="star-fill-inline" /> {o.review.rating}/5
                                {o.review.status === 'PENDING' && <span className="muted"> · awaiting approval</span>}
                                {o.review.status === 'HIDDEN' && <span className="muted"> · not published</span>}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {tab === 'profile' && (
              <div className="section">
                <h2 className="form-heading">Edit Profile</h2>
                <form onSubmit={saveProfile}>
                  <div className="form-group">
                    <label className="form-label">
                      <span className="form-label-text">Full Name</span>
                      <input className="form-input" value={profile.fullName} onChange={(e) => setProfile({ ...profile, fullName: e.target.value })} required />
                    </label>
                  </div>
                  <div className="form-group">
                    <label className="form-label">
                      <span className="form-label-text">Phone Number</span>
                      <input className="form-input" value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} required />
                    </label>
                  </div>
                  <div className="form-group">
                    <label className="form-label">
                      <span className="form-label-text">Email Address</span>
                      <input className="form-input" value={user.email} disabled />
                    </label>
                    <p className="muted small">Email cannot be changed</p>
                  </div>
                  <button className="btn btn-primary">Save Changes</button>
                </form>
              </div>
            )}

            {tab === 'saved' && (
              <div className="section">
                <h2 className="form-heading"><Heart size={16} /> Saved items</h2>
                <SavedItems />
                <h2 className="form-heading" style={{ marginTop: '1.75rem' }}>
                  <Bell size={16} /> Order alerts
                </h2>
                <PushToggle />
              </div>
            )}

            {tab === 'password' && (
              <div className="section">
                <h2 className="form-heading">Change Password</h2>
                <form onSubmit={changePassword}>
                  <div className="form-group">
                    <label className="form-label">
                      <span className="form-label-text">Current Password</span>
                      <input type="password" className="form-input" required value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} />
                    </label>
                  </div>
                  <div className="form-group">
                    <label className="form-label">
                      <span className="form-label-text">New Password</span>
                      <input type="password" className="form-input" required minLength={8} value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} />
                    </label>
                  </div>
                  <div className="form-group">
                    <label className="form-label">
                      <span className="form-label-text">Confirm New Password</span>
                      <input type="password" className="form-input" required minLength={8} value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} />
                    </label>
                  </div>
                  <button className="btn btn-primary">Change Password</button>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>

      {reviewing && (
        <div className="modal active" onClick={(e) => e.target === e.currentTarget && setReviewing(null)}>
          <div ref={dialogRef} tabIndex={-1} className="modal-content" role="dialog" aria-modal="true" aria-labelledby="review-dialog-title">
            <div className="modal-header">
              <h3 id="review-dialog-title">Review order {reviewing.id}</h3>
              <button className="close-btn" onClick={() => setReviewing(null)}>×</button>
            </div>
            <form onSubmit={submitReview}>
              <div className="form-group centered">
                <label className="form-label">Your rating</label>
                <Stars value={reviewForm.rating} onChange={(r) => setReviewForm({ ...reviewForm, rating: r })} />
              </div>
              <div className="form-group">
                <label className="form-label">
                  <span className="form-label-text">Comment</span>
                  <textarea className="form-textarea" value={reviewForm.comment} onChange={(e) => setReviewForm({ ...reviewForm, comment: e.target.value })} placeholder="How was your order?" />
                </label>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setReviewing(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Submit Review (+5 pts)</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
