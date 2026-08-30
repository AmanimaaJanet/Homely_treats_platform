import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Upload, Lock } from 'lucide-react';
import { api } from '../api.js';
import { useApp } from '../store.jsx';
import { ghs, minDate } from '../lib/format.js';

const DEFAULT_FLAVORS = ['Vanilla', 'French Vanilla', 'Chocolate', 'Red Velvet', 'Lemon', 'Matcha'];
const ICINGS = ['Buttercream', 'Fondant', 'Whipped Cream', 'Ganache', 'Naked (No Icing)'];

export default function CustomOrder() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { addToCart, toast } = useApp();
  const fileInput = useRef(null);

  const [products, setProducts] = useState([]);
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [flavor, setFlavor] = useState('');
  const [size, setSize] = useState('');
  const [icing, setIcing] = useState('');
  const [date, setDate] = useState('');
  const [inscription, setInscription] = useState('');
  const [notes, setNotes] = useState('');
  const [photos, setPhotos] = useState([]); // uploaded design reference urls
  const [uploading, setUploading] = useState(false);
  const [minLead, setMinLead] = useState(2);

  useEffect(() => {
    api.get('/products').then((d) => {
      setProducts(d.products);
      const preselect = params.get('product');
      if (preselect && d.products.find((p) => p.id === preselect)) setProductId(preselect);
    });
    api.get('/settings/public').then((d) => setMinLead(d.settings.minLeadDays || 2)).catch(() => {});
  }, [params]);

  const product = useMemo(() => products.find((p) => p.id === productId), [products, productId]);
  const flavors = product?.flavors?.length ? product.flavors : DEFAULT_FLAVORS;
  const sizeOptions = product?.sizeOptions?.length
    ? product.sizeOptions
    : [{ id: 'std', label: 'Standard', serves: 1, price: product?.basePrice || 0 }];

  // Size-based pricing: unit price = selected size price (falls back to base)
  const unitPrice = useMemo(() => {
    if (!product) return 0;
    const sel = sizeOptions.find((s) => s.label === size);
    return sel ? sel.price : product.basePrice;
  }, [product, size, sizeOptions]);

  const estimated = unitPrice * Math.max(1, quantity || 1);

  const handleFiles = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true);
    try {
      const urls = [];
      for (const f of files) {
        const { url } = await api.upload(f);
        urls.push(url);
      }
      setPhotos((p) => [...p, ...urls].slice(0, 4));
      toast('Photo uploaded', 'success');
    } catch (err) {
      toast(`Photo upload failed: ${err.message}`, 'error');
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!product) return;
    if (!date) return;
    addToCart({
      key: `${product.id}-${flavor}-${size}-${icing}-${date}-${inscription}-${Date.now()}`,
      productId: product.id,
      name: product.name,
      icon: product.icon || product.emoji,
      price: unitPrice,
      quantity: Math.max(1, parseInt(quantity, 10)),
      flavor: flavor || null,
      size: size || null,
      icing: icing || null,
      inscription: inscription || null,
      readyDate: date,
      photos,
    });
    navigate('/cart');
  };

  return (
    <div className="page">
      <div className="container">
        <div className="section">
          <h2 className="section-title">Build Your Perfect Order</h2>
          <p className="centered muted">Tell us exactly what you want — we'll bake it fresh, just for you.</p>

          <div className="steps" style={{ margin: '1.5rem 0' }}>
            <div className="step"><div className="step-number">1</div><h3>Choose your product</h3></div>
            <div className="step"><div className="step-number">2</div><h3>Configure your order</h3></div>
            <div className="step"><div className="step-number">3</div><h3>Pay securely</h3></div>
            <div className="step"><div className="step-number">4</div><h3>Track & collect</h3></div>
          </div>

          <div className="centered muted" style={{ marginBottom: '2rem' }}>
            <strong>Accepted payments:</strong> MTN MoMo · AirtelTigo · Visa/MC · Pay on Delivery
          </div>

          <form onSubmit={handleSubmit}>
            <h3 className="form-heading">Configure Your Order</h3>

            <div className="form-group">
              <label className="form-label">Product Type *</label>
              <select
                className="form-select"
                required
                value={productId}
                onChange={(e) => { setProductId(e.target.value); setSize(''); }}
              >
                <option value="">Select a product…</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — from {ghs(p.basePrice)}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Quantity</label>
                <input
                  type="number"
                  className="form-input"
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Size *</label>
                <select className="form-select" value={size} onChange={(e) => setSize(e.target.value)} required>
                  <option value="">— choose size —</option>
                  {sizeOptions.map((s) => (
                    <option key={s.id} value={s.label}>
                      {s.label} {s.serves > 1 ? `· serves ${s.serves}` : ''} — {ghs(s.price)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Flavour</label>
                <select className="form-select" value={flavor} onChange={(e) => setFlavor(e.target.value)}>
                  <option value="">— choose —</option>
                  {flavors.map((f) => <option key={f}>{f}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Icing Type</label>
                <select className="form-select" value={icing} onChange={(e) => setIcing(e.target.value)}>
                  <option value="">— choose —</option>
                  {ICINGS.map((i) => <option key={i}>{i}</option>)}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Delivery / Pickup Date *</label>
              <input
                type="date"
                className="form-input"
                min={minDate(minLead)}
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
              <p className="muted small">Minimum {minLead} days advance notice required.</p>
            </div>

            <div className="form-group">
              <label className="form-label">Inscription / Message (optional)</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g., Happy Birthday, Kwame!"
                value={inscription}
                onChange={(e) => setInscription(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Design Reference Photos (optional)</label>
              <div className="upload-zone">
                <button type="button" className="btn btn-secondary" onClick={() => fileInput.current?.click()} disabled={uploading || photos.length >= 4}>
                  <Upload size={16} /> {uploading ? 'Uploading…' : 'Upload design inspiration'}
                </button>
                <input ref={fileInput} type="file" accept="image/*" multiple hidden onChange={handleFiles} />
                <p className="muted small">Show us a cake design you love — our decorators will match the style (max 4 photos).</p>
                {photos.length > 0 && (
                  <div className="thumb-row">
                    {photos.map((url, i) => (
                      <div className="thumb" key={url}>
                        <img src={url} alt={`Design ${i + 1}`} />
                        <button type="button" className="thumb-remove" onClick={() => setPhotos(photos.filter((_, j) => j !== i))}>×</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Special Notes / Allergies (optional)</label>
              <textarea
                className="form-textarea"
                placeholder="Any special requests or dietary requirements…"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            <div className="price-box">
              <p>
                <strong>Estimated price:</strong>{' '}
                <span className="price-amount">{ghs(estimated)}</span>
                {size && product?.sizeOptions?.length > 0 && (
                  <span className="muted small"> ({unitPrice > product.basePrice ? '↑' : unitPrice < product.basePrice ? '↓' : ''} {ghs(unitPrice)} per unit)</span>
                )}
              </p>
              <p className="muted small">Final price shown at checkout. Size affects price — bigger tiers cost more.</p>
            </div>

            <button type="submit" className="btn btn-primary btn-block">
              Add to Cart & Review Order →
            </button>

            <div className="centered secure-note" style={{ marginTop: '1.5rem' }}>
              <p className="secure-line"><Lock size={14} /> Secured by Paystack</p>
              <p className="muted small">MTN MoMo · AirtelTigo · Visa/Mastercard</p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
