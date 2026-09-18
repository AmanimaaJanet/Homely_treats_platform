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
  // Delivery rules: counters to collect from, collection/delivery windows with live
  // capacity for the chosen day, and closed days the bakery has declared.
  const [pickupLocations, setPickupLocations] = useState([]);
  const [pickupLocationId, setPickupLocationId] = useState('');
  const [slots, setSlots] = useState([]);
  const [timeSlot, setTimeSlot] = useState('');
  const [blackout, setBlackout] = useState(null);
  const [promoCode, setPromoCode] = useState('');
  const [promo, setPromo] = useState(null);
  const [promoError, setPromoError] = useState('');
  const [usePoints, setUsePoints] = useState(false);
  const [pointsToUse, setPointsToUse] = useState(0);
  const [placing, setPlacing] = useState(false);

  // Guest info
  const [guest, setGuest] = useState({ name: '', email: '', phone: '' });

  const readyDate = cart[0]?.readyDate || '';

  // Rules are re-read per date: a window that filled up a minute ago, or a day the
  // bakery has since closed, can no longer be chosen.
  useEffect(() => {
    const q = readyDate ? `?date=${encodeURIComponent(readyDate)}` : '';
    api
      .get(`/delivery/options${q}`)
      .then((d) => {
        setZones(d.zones || []);
        setDeliveryZone((z) => z || d.zones?.[0]?.id || '');
        setPickupLocations(d.pickupLocations || []);
        setPickupLocationId((p) => p || d.pickupLocations?.find((l) => l.isDefault)?.id || d.pickupLocations?.[0]?.id || '');
        // A slot that is full (or a day that closed) must not stay selected.
        setSlots(d.slots || []);
        setTimeSlot((t) => {
          const still = (d.slots || []).find((sl) => sl.label === t && sl.remaining > 0);
          return still ? t : '';
        });
        setBlackout(d.blackout || null);
      })
      .catch(() => {});
    // Re-runs when the customer changes the date so the remaining capacity per window
    // is the live one; the loader is defined inline for that reason.
  }, [readyDate]);

  useEffect(() => {
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
    // Deliberately once, on mount: the shop's own settings do not change mid-checkout.
  }, []);

  const zone = zones.find((z) => z.id === deliveryZone) || zones.find((z) => z.name === deliveryZone);
  // A zone can refuse small baskets and waive the fee for large ones.
  const ruleIssue =
    deliveryMethod === 'DELIVERY' && zone?.minOrder && subtotal < zone.minOrder
      ? `We deliver to ${zone.name} from ${ghs(zone.minOrder)} — your basket is ${ghs(subtotal)}. Add something else or choose pickup.`
      : '';
  const feeWaived =
    deliveryMethod === 'DELIVERY' && zone?.freeOver && subtotal >= zone.freeOver && !ruleIssue;
  const deliveryFee = deliveryMethod === 'DELIVERY' && !ruleIssue ? (feeWaived ? 0 : Number(zone?.fee || 0)) : 0;
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
    if (ruleIssue) return toast(ruleIssue, 'error');
    if (blackout) return toast(`We're closed on that date${blackout.reason ? ` (${blackout.reason})` : ''}. Please pick another day.`, 'error');
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
        timeSlot: timeSlot || undefined,
        pickupLocation: deliveryMethod === 'PICKUP' ? pickupLocationId || undefined : undefined,
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
                      <label className="form-label">
                        <span className="form-label-text">Full Name *</span>
                        <input className="form-input" value={guest.name} onChange={(e) => setGuest({ ...guest, name: e.target.value })} placeholder="Your name" />
                      </label>
                    </div>
                    <div className="form-group">
                      <label className="form-label">
                        <span className="form-label-text">Phone *</span>
                        <input className="form-input" value={guest.phone} onChange={(e) => setGuest({ ...guest, phone: e.target.value })} placeholder="055 123 4567" />
                      </label>
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">
                      <span className="form-label-text">Email *</span>
                      <input className="form-input" type="email" value={guest.email} onChange={(e) => setGuest({ ...guest, email: e.target.value })} placeholder="you@example.com" />
                    </label>
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
                <button
                  type="button"
                  className={`delivery-option ${deliveryMethod === 'DELIVERY' ? 'selected' : ''}`}
                  onClick={() => setDeliveryMethod('DELIVERY')}
                  aria-pressed={deliveryMethod === 'DELIVERY'}
                >
                  <strong><Truck size={18} aria-hidden="true" /> Home Delivery</strong>
                  <p>Fee by zone · Greater Accra</p>
                </button>
                {allowPickup && (
                  <button
                    type="button"
                    className={`delivery-option ${deliveryMethod === 'PICKUP' ? 'selected' : ''}`}
                    onClick={() => setDeliveryMethod('PICKUP')}
                    aria-pressed={deliveryMethod === 'PICKUP'}
                  >
                    <strong><Store size={18} aria-hidden="true" /> Pickup</strong>
                    <p>Free · {pickupLocations.find((l) => l.id === pickupLocationId)?.address || pickupAddress}</p>
                  </button>
                )}
              </div>

              {blackout && (
                <p className="checkout-warning">
                  We're closed on {readyDate}
                  {blackout.reason ? ` (${blackout.reason})` : ''} — please pick another date on the product page.
                </p>
              )}

              {deliveryMethod === 'DELIVERY' && (
                <>
                  <div className="form-group" style={{ marginTop: '1.25rem' }}>
                    <label className="form-label">
                      <span className="form-label-text">Delivery Zone *</span>
                      <select className="form-select" value={deliveryZone} onChange={(e) => setDeliveryZone(e.target.value)}>
                        <option value="">Select your neighbourhood…</option>
                        {zones.map((z) => (
                          <option key={z.id} value={z.id}>{z.name} — {ghs(z.fee)}</option>
                        ))}
                </select>
                      </label>
                  </div>
                  {zone?.etaNote && <p className="muted small">{zone.etaNote}</p>}
                  {zone?.minOrder ? (
                    <p className={`muted small ${ruleIssue ? 'checkout-warning' : ''}`}>
                      Minimum basket for {zone.name}: {ghs(zone.minOrder)}
                      {zone.freeOver ? ` · free delivery over ${ghs(zone.freeOver)}` : ''}
                    </p>
                  ) : null}
                  <div className="form-group">
                    <label className="form-label">
                      <span className="form-label-text">Street Address / Landmark</span>
                      <textarea className="form-textarea" placeholder="House no, street, landmark…" value={address} onChange={(e) => setAddress(e.target.value)} />
                    </label>
                  </div>
                </>
              )}

              {deliveryMethod === 'PICKUP' && pickupLocations.length > 1 && (
                <div className="form-group">
                  <label className="form-label">
                    <span className="form-label-text">Collect from *</span>
                    <select
                      className="form-select"
                      value={pickupLocationId}
                      onChange={(e) => setPickupLocationId(e.target.value)}
                    >

                      {pickupLocations.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.name} — {l.address}
                        </option>
                      ))}
                </select>
                    </label>
                </div>
              )}

              {deliveryMethod === 'PICKUP' && pickupLocations.length === 1 && (
                <p className="muted small">
                  Collect from <strong>{pickupLocations[0].name}</strong> — {pickupLocations[0].address}
                  {pickupLocations[0].hours ? ` · ${pickupLocations[0].hours}` : ''}
                </p>
              )}

              {readyDate && slots.length > 0 && !blackout && (
                <div className="form-group">
                  <label className="form-label">
                    {deliveryMethod === 'DELIVERY' ? 'Delivery window' : 'Collection window'} for {readyDate}
                  </label>
                  <div className="slot-grid">
                    <button
                      type="button"
                      className={`slot-chip ${!timeSlot ? 'selected' : ''}`}
                      onClick={() => setTimeSlot('')}
                    >
                      <strong>Anytime</strong>
                      <span className="muted small">We'll confirm when ready</span>
                    </button>
                    {slots.map((sl) => {
                      const full = sl.remaining <= 0;
                      return (
                        <button
                          key={sl.id}
                          type="button"
                          className={`slot-chip ${timeSlot === sl.label ? 'selected' : ''} ${full ? 'full' : ''}`}
                          disabled={full}
                          onClick={() => setTimeSlot(sl.label)}
                        >
                          <strong>{sl.label}</strong>
                          <span className="muted small">
                            {full ? 'Fully booked' : `${sl.remaining} of ${sl.capacity} left`}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div>
              <div className="cart-summary">
                <h3>Order Summary</h3>
                <div className="summary-row"><span>Subtotal</span><span>{ghs(subtotal)}</span></div>
                <div className="summary-row">
                  <span>Delivery fee</span>
                  <span>
                    {feeWaived ? (
                      <>
                        <s className="muted">{ghs(zone?.fee || 0)}</s> Free
                      </>
                    ) : (
                      ghs(deliveryFee)
                    )}
                  </span>
                </div>
                <div className="summary-row"><span>Discount</span><span>{ghs(discount)}</span></div>
                {usePoints && loyaltyDiscount > 0 && (
                  <div className="summary-row"><span>Loyalty points</span><span>−{ghs(loyaltyDiscount)}</span></div>
                )}
                <div className="summary-row summary-total"><span>Total</span><span>{ghs(total)}</span></div>

                <div className="form-group" style={{ marginTop: '1.5rem' }}>
                  <label className="form-label">Promo Code</label>
                  <div className="promo-row">
                    <input aria-label="Promo code" className="form-input" placeholder="e.g. HOMELY10" value={promoCode} onChange={(e) => setPromoCode(e.target.value)} />
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
                    <button
                      type="button"
                      key={m.id}
                      className={`payment-method ${paymentMethod === m.id ? 'selected' : ''}`}
                      onClick={() => setPaymentMethod(m.id)}
                      aria-pressed={paymentMethod === m.id}
                    >
                      <div className="pay-icon"><m.icon size={22} aria-hidden="true" /></div>
                      <strong>{m.label}</strong>
                      <p className="small">{m.note}</p>
                    </button>
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
