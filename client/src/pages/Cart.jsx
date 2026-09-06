import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Truck, Store, Smartphone, CreditCard, Banknote, Gem, Lock, User, ShoppingCart, Check } from 'lucide-react';
import { useApp } from '../store.jsx';
import { api, pointsValue, maxRedeemablePoints } from '../api.js';
import { ghs } from '../lib/format.js';
import { ProductIcon } from '../components/ProductIcon.jsx';

const PAYMENT_METHODS = [
  { id: 'MOMO', icon: Smartphone, label: 'MTN Mobile Money', note: 'Instant · Recommended' },
  { id: 'ATL', icon: Smartphone, label: 'AirtelTigo Money', note: 'Instant' },
  { id: 'CARD', icon: CreditCard, label: 'Debit / Credit Card', note: 'Visa · Mastercard' },
  { id: 'COD', icon: Banknote, label: 'Pay on Delivery / Pickup', note: 'Cash' },
];

export default function Cart() {
  const navigate = useNavigate();
  const { cart, setQty, removeFromCart, clearCart, subtotal, user, toast } = useApp();

  const [zones, setZones] = useState([]);
  const [deliveryMethod, setDeliveryMethod] = useState('DELIVERY');
  const [deliveryZone, setDeliveryZone] = useState('');
  const [address, setAddress] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('MOMO');
  const [payOptions, setPayOptions] = useState(PAYMENT_METHODS);
  const [allowPickup, setAllowPickup] = useState(true);
  const [pickupAddress, setPickupAddress] = useState('Airport Residential, Accra');
  const [promoCode, setPromoCode] = useState('');
  const [promo, setPromo] = useState(null);
  const [promoError, setPromoError] = useState('');
  const [usePoints, setUsePoints] = useState(false);
  const [pointsToUse, setPointsToUse] = useState(0);
  const [placing, setPlacing] = useState(false);

  // Guest info
  const [guest, setGuest] = useState({ name: '', email: '', phone: '' });

  useEffect(() => {
    api.get('/zones').then((d) => {
      setZones(d.zones);
      if (d.zones.length && !deliveryZone) setDeliveryZone(d.zones[0].id);
    }).catch(() => {});
    // Respect admin-configured payment methods / pickup availability
    api.get('/settings/public').then((d) => {
      const s = d.settings;
      const opts = PAYMENT_METHODS.filter((m) => {
        if (m.id === 'MOMO') return s.enableMomo !== false;
        if (m.id === 'ATL') return s.enableAtl !== false;
        if (m.id === 'CARD') return s.enableCard !== false;
        if (m.id === 'COD') return s.enableCod !== false;
        return true;
      });
      setPayOptions(opts.length ? opts : PAYMENT_METHODS);
      setAllowPickup(s.allowPickup !== false);
      setPickupAddress(s.businessAddress || pickupAddress);
      if (s.allowPickup === false && deliveryMethod === 'PICKUP') setDeliveryMethod('DELIVERY');
      setPaymentMethod((pm) => (opts.some((o) => o.id === pm) ? pm : opts[0]?.id || 'COD'));
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const zone = zones.find((z) => z.id === deliveryZone);
  const deliveryFee = deliveryMethod === 'DELIVERY' ? Number(zone?.fee || 0) : 0;
  const discount = promo ? promo.discount : 0;
  const baseAfterPromo = Math.max(0, subtotal - discount);
  const loyaltyDiscount = usePoints ? pointsValue(pointsToUse) : 0;
  const total = Math.max(0, subtotal - discount - loyaltyDiscount + deliveryFee);

  const maxPoints = user ? maxRedeemablePoints(user.loyaltyPoints, baseAfterPromo) : 0;

  const applyPromo = async () => {
    setPromoError('');
    setPromo(null);
    if (!promoCode.trim()) return;
    try {
      const res = await api.post('/promos/validate', { code: promoCode.trim(), subtotal });
      setPromo({ code: promoCode.trim().toUpperCase(), ...res });
      toast(`Promo applied: ${res.promo.code}`, 'success');
    } catch (err) {
      setPromoError(err.message);
    }
  };

  const togglePoints = (on) => {
    setUsePoints(on);
    setPointsToUse(on ? maxPoints : 0);
  };

  const placeOrder = async () => {
    if (cart.length === 0) return;
    if (!user && (!guest.name || !guest.email || !guest.phone)) {
      toast('Please fill in your name, email and phone (or sign in).', 'error');
      return;
    }
    if (deliveryMethod === 'DELIVERY' && !deliveryZone) {
      toast('Please select your delivery zone.', 'error');
      return;
    }
    setPlacing(true);
    try {
      const payload = {
        items: cart.map((i) => ({
          productId: i.productId,
          quantity: i.quantity,
          flavor: i.flavor,
          size: i.size,
          icing: i.icing,
          inscription: i.inscription,
        })),
        deliveryMethod,
        deliveryAddress: deliveryMethod === 'DELIVERY' ? address : undefined,
        deliveryZone: deliveryMethod === 'DELIVERY' ? deliveryZone : undefined,
        readyDate: cart[0]?.readyDate || undefined,
        notes: cart.map((i) => i.notes).filter(Boolean).join(' | ') || undefined,
        paymentMethod,
        promoCode: promo?.code,
        pointsToRedeem: usePoints ? pointsToUse : 0,
        photos: cart.flatMap((i) => i.photos || []),
        guest: user ? undefined : guest,
      };
      const res = await api.post('/orders', payload, { auth: !!user });
      clearCart();
      const orderId = res.order.id;

      if (paymentMethod === 'COD') {
        toast(`Order ${orderId} placed! Pay cash on ${deliveryMethod === 'DELIVERY' ? 'delivery' : 'pickup'}.`, 'success');
        navigate(`/track?ref=${orderId}`);
        return;
      }
      if (res.authorizationUrl) {
        if (res.authorizationUrl.startsWith('/')) navigate(res.authorizationUrl);
        else window.location.href = res.authorizationUrl;
      }
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setPlacing(false);
    }
  };

  if (cart.length === 0) {
    return (
      <div className="page">
        <div className="container">
          <div className="section empty-state">
            <div className="empty-state-icon"><ShoppingCart size={56} strokeWidth={1.2} /></div>
            <p className="empty-state-text">Your cart is empty</p>
            <p className="muted">Add some delicious treats to get started!</p>
            <button className="btn btn-primary" onClick={() => navigate('/menu')}>Browse Products</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="container">
        <div className="section">
          <h2 className="section-title">Cart & Checkout</h2>

          <div className="cart-layout">
            <div>
              {!user && (
                <div className="guest-box">
                  <h3><User size={18} /> Your Details</h3>
                  <p className="muted small">
                    Checking out as a guest, or <Link to="/signin" className="link">sign in</Link> to save your order & earn loyalty points.
                  </p>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Full Name *</label>
                      <input className="form-input" value={guest.name} onChange={(e) => setGuest({ ...guest, name: e.target.value })} placeholder="Your name" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Phone *</label>
                      <input className="form-input" value={guest.phone} onChange={(e) => setGuest({ ...guest, phone: e.target.value })} placeholder="055 123 4567" />
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Email *</label>
                    <input className="form-input" type="email" value={guest.email} onChange={(e) => setGuest({ ...guest, email: e.target.value })} placeholder="you@example.com" />
                  </div>
                </div>
              )}

              <h3 className="form-heading">Order Items</h3>
              <div className="cart-items">
                {cart.map((item) => (
                  <div className="cart-item" key={item.key}>
                    <div className="cart-item-icon"><ProductIcon name={item.icon || item.emoji} size={30} /></div>
                    <div className="cart-item-body">
                      <strong>{item.name}</strong>
                      <p className="muted small">
                        {[item.size, item.flavor, item.icing].filter(Boolean).join(' · ') || 'Standard'}
                        {item.inscription && <> · "{item.inscription}"</>}
                      </p>
                      {item.notes && <p className="muted small">Notes: {item.notes}</p>}
                      {item.readyDate && <p className="muted small">Needed by: {item.readyDate}</p>}
                      {item.photos?.length > 0 && (
                        <div className="thumb-row">
                          {item.photos.map((url, i) => <img key={i} className="thumb-img" src={url} alt={`ref ${i + 1}`} />)}
                        </div>
                      )}
                      <div className="qty-control">
                        <button onClick={() => setQty(item.key, item.quantity - 1)}>−</button>
                        <span>{item.quantity}</span>
                        <button onClick={() => setQty(item.key, item.quantity + 1)}>+</button>
                      </div>
                    </div>
                    <div className="cart-item-right">
                      <p className="cart-item-price">{ghs(item.price * item.quantity)}</p>
                      <button className="btn-link danger" onClick={() => removeFromCart(item.key)}>Remove</button>
                    </div>
                  </div>
                ))}
              </div>

              <h3 className="form-heading">Delivery Method</h3>
              <div className="delivery-options">
                <div
                  className={`delivery-option ${deliveryMethod === 'DELIVERY' ? 'selected' : ''}`}
                  onClick={() => setDeliveryMethod('DELIVERY')}
                >
                  <strong><Truck size={18} /> Home Delivery</strong>
                  <p>Fee by zone · Greater Accra</p>
                </div>
                {allowPickup && (
                  <div
                    className={`delivery-option ${deliveryMethod === 'PICKUP' ? 'selected' : ''}`}
                    onClick={() => setDeliveryMethod('PICKUP')}
                  >
                    <strong><Store size={18} /> Pickup</strong>
                    <p>Free · {pickupAddress}</p>
                  </div>
                )}
              </div>

              {deliveryMethod === 'DELIVERY' && (
                <>
                  <div className="form-group" style={{ marginTop: '1.25rem' }}>
                    <label className="form-label">Delivery Zone *</label>
                    <select className="form-select" value={deliveryZone} onChange={(e) => setDeliveryZone(e.target.value)}>
                      <option value="">Select your neighbourhood…</option>
                      {zones.map((z) => (
                        <option key={z.id} value={z.id}>{z.name} — {ghs(z.fee)}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Street Address / Landmark</label>
                    <textarea className="form-textarea" placeholder="House no, street, landmark…" value={address} onChange={(e) => setAddress(e.target.value)} />
                  </div>
                </>
              )}
            </div>

            <div>
              <div className="cart-summary">
                <h3>Order Summary</h3>
                <div className="summary-row"><span>Subtotal</span><span>{ghs(subtotal)}</span></div>
                <div className="summary-row"><span>Delivery fee</span><span>{ghs(deliveryFee)}</span></div>
                <div className="summary-row"><span>Discount</span><span>{ghs(discount)}</span></div>
                {usePoints && loyaltyDiscount > 0 && (
                  <div className="summary-row"><span>Loyalty points</span><span>−{ghs(loyaltyDiscount)}</span></div>
                )}
                <div className="summary-row summary-total"><span>Total</span><span>{ghs(total)}</span></div>

                <div className="form-group" style={{ marginTop: '1.5rem' }}>
                  <label className="form-label">Promo Code</label>
                  <div className="promo-row">
                    <input className="form-input" placeholder="e.g. HOMELY10" value={promoCode} onChange={(e) => setPromoCode(e.target.value)} />
                    <button type="button" className="btn btn-secondary" onClick={applyPromo}>Apply</button>
                  </div>
                  {promo && <p className="small success"><Check size={13} /> {promo.promo.code} — {promo.promo.type === 'PERCENT' ? `${promo.promo.value}% off` : `${ghs(promo.promo.value)} off`}</p>}
                  {promoError && <p className="small danger">{promoError}</p>}
                </div>

                {user && maxPoints > 0 && (
                  <div className="loyalty-box">
                    <label className="check-row toggle">
                      <input type="checkbox" checked={usePoints} onChange={(e) => togglePoints(e.target.checked)} />
                      <span><Gem size={15} /> Use my loyalty points</span>
                    </label>
                    <p className="muted small">
                      You have <strong>{user.loyaltyPoints} pts</strong> · {maxPoints} usable = <strong>−{ghs(pointsValue(maxPoints))}</strong>
                    </p>
                    {usePoints && (
                      <input
                        type="range"
                        min={0}
                        max={maxPoints}
                        value={pointsToUse}
                        onChange={(e) => setPointsToUse(Number(e.target.value))}
                        style={{ width: '100%' }}
                      />
                    )}
                    {usePoints && <p className="small">Using {pointsToUse} pts (−{ghs(pointsValue(pointsToUse))})</p>}
                  </div>
                )}
                {user && maxPoints === 0 && (
                  <p className="muted small"><Gem size={14} /> You have {user.loyaltyPoints} loyalty pts. Earn more with every paid order.</p>
                )}

                <h4 className="form-heading">Payment Method</h4>
                <div className="payment-methods">
                  {payOptions.map((m) => (
                    <div
                      key={m.id}
                      className={`payment-method ${paymentMethod === m.id ? 'selected' : ''}`}
                      onClick={() => setPaymentMethod(m.id)}
                    >
                      <div className="pay-icon"><m.icon size={22} /></div>
                      <strong>{m.label}</strong>
                      <p className="small">{m.note}</p>
                    </div>
                  ))}
                </div>

                <button className="btn btn-primary btn-block" style={{ marginTop: '1.5rem' }} onClick={placeOrder} disabled={placing}>
                  {placing ? 'Placing order…' : paymentMethod === 'COD' ? 'Place Order →' : 'Place Order & Pay →'}
                </button>

                <p className="centered muted small secure-line" style={{ marginTop: '1rem' }}>
                  <Lock size={13} /> Secured by Paystack · SSL Encrypted
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
