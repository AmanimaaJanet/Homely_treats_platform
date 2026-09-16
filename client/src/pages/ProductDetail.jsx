import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Star, Heart, ArrowLeft, Truck, Store, Clock, ShieldCheck, MessageSquareQuote,
} from 'lucide-react';
import { api } from '../api.js';
import { useApp } from '../store.jsx';
import { ghs, fmtDate } from '../lib/format.js';
import ProductGallery from '../components/ProductGallery.jsx';

/**
 * Product page: the photos, what it costs in each size, what customers said about it,
 * and the two ways to get it (order for delivery, or collect).
 *
 * Ratings and reviews are real — taken from approved reviews of delivered orders that
 * contained this product, so an order can only ever count once and no review can be
 * invented. A product nobody has reviewed yet says so, rather than showing a hollow
 * five stars.
 */
export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, toast } = useApp();
  const [product, setProduct] = useState(null);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .get(`/products/${id}`)
      .then((d) => setProduct(d.product))
      .catch((err) => setError(err.message));
  }, [id]);

  useEffect(() => {
    if (!user) return setSaved(false);
    api
      .get('/wishlist/ids', { auth: true })
      .then((d) => setSaved((d.productIds || []).includes(id)))
      .catch(() => {});
  }, [user, id]);

  const toggleWish = async () => {
    if (!user) {
      toast('Sign in to save items and get restock alerts.', 'error');
      return navigate('/signin');
    }
    setBusy(true);
    try {
      if (saved) {
        await api.del(`/wishlist/${id}`, { auth: true });
        setSaved(false);
        toast('Removed from your list.', 'success');
      } else {
        const res = await api.post('/wishlist', { productId: id }, { auth: true });
        setSaved(true);
        toast(res.message || 'Saved to your list.', 'success');
      }
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  if (error) {
    return (
      <div className="page">
        <div className="empty-state">
          <p>{error}</p>
          <Link className="btn btn-secondary" to="/menu">Back to the menu</Link>
        </div>
      </div>
    );
  }
  if (!product) return <div className="page"><div className="empty-state"><p>Loading…</p></div></div>;

  const rating = product.rating || { average: 0, count: 0 };
  const reviews = product.reviews || [];
  const sizes = product.sizeOptions?.length ? product.sizeOptions : [];
  const soldOut = !product.inStock;
  const maxHist = Math.max(1, ...(product.histogram || []).map((h) => h.count));

  return (
    <div className="page">
      <button className="btn btn-ghost btn-sm" onClick={() => navigate(-1)}>
        <ArrowLeft size={15} /> Back
      </button>

      <div className="product-detail section">
        <div>
          {/* The gallery falls back to the product icon on its own when there are no photos. */}
          <ProductGallery product={product} />
        </div>

        <div>
          {product.badge && <span className="product-badge inline">{product.badge}</span>}
          <h1>{product.name}</h1>

          {rating.count > 0 ? (
            <div className="product-rating">
              {[1, 2, 3, 4, 5].map((i) => (
                <Star key={i} size={15} className={i <= Math.round(rating.average) ? 'star-fill-inline' : 'star-empty-inline'} />
              ))}
              <strong>{rating.average}</strong>
              <a href="#reviews" className="muted small">{rating.count} review{rating.count === 1 ? '' : 's'}</a>
            </div>
          ) : (
            <p className="muted small">No reviews yet — order it and be the first to say.</p>
          )}

          <p className="detail-price">{ghs(product.basePrice)}</p>
          {product.description && <p>{product.description}</p>}

          {sizes.length > 0 && (
            <>
              <h3 className="form-heading">Choose a size</h3>
              <div className="stock-list">
                {sizes.map((s) => (
                  <span className="stock-chip" key={s.id}>
                    {s.label}
                    {s.serves > 1 ? <span className="muted"> serves {s.serves}</span> : null}
                    <strong>{ghs(s.price)}</strong>
                  </span>
                ))}
              </div>
            </>
          )}

          <div className="list-row" style={{ marginTop: '14px' }}>
            <span className="muted small"><Truck size={14} /> Delivery across Greater Accra</span>
            <span className="muted small"><Store size={14} /> Collect from the shop</span>
            {product.leadDays ? (
              <span className="muted small"><Clock size={14} /> {product.leadDays} days notice</span>
            ) : null}
          </div>

          <div className="detail-actions">
            <button
              className="btn btn-primary"
              onClick={() => navigate(`/custom-order?product=${product.id}`)}
              disabled={soldOut}
            >
              {soldOut ? 'Sold out' : 'Customise & order'}
            </button>
            <button className="btn btn-secondary" onClick={toggleWish} disabled={busy}>
              <Heart size={15} fill={saved ? 'currentColor' : 'none'} />
              {saved ? 'Saved' : soldOut ? 'Tell me when it’s back' : 'Save for later'}
            </button>
          </div>

          {soldOut && (
            <p className="muted small" style={{ marginTop: '10px' }}>
              {saved
                ? "You're on the list — we'll email you the moment it's back."
                : 'Tap “Tell me when it’s back” and we’ll email you on the next batch.'}
            </p>
          )}
        </div>
      </div>

      <div className="section" id="reviews">
        <h2 className="section-title">
          <MessageSquareQuote size={20} /> What customers say
        </h2>

        {rating.count === 0 ? (
          <p className="muted">
            Nothing yet. Reviews appear here once customers have received an order containing
            {' '}{product.name}.
          </p>
        ) : (
          <>
            <div className="review-summary">
              <div>
                <div className="review-score">{rating.average}</div>
                <div className="product-rating">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Star key={i} size={14} className={i <= Math.round(rating.average) ? 'star-fill-inline' : 'star-empty-inline'} />
                  ))}
                </div>
                <p className="muted small">{rating.count} review{rating.count === 1 ? '' : 's'}</p>
              </div>
              <div className="review-histogram">
                {(product.histogram || []).map((h) => (
                  <div className="hist-row" key={h.stars}>
                    <span>{h.stars}★</span>
                    <span className="hist-bar">
                      <span className="hist-fill" style={{ width: `${(h.count / maxHist) * 100}%` }} />
                    </span>
                    <span>{h.count}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="review-list">
              {reviews.map((r) => (
                <div className="review-item" key={r.id}>
                  <div className="review-author">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Star key={i} size={13} className={i <= r.rating ? 'star-fill-inline' : 'star-empty-inline'} />
                    ))}
                    <strong>{r.author}</strong>
                    {r.verified && (
                      <span className="verified-pill">
                        <ShieldCheck size={11} /> Verified purchase
                      </span>
                    )}
                    <span className="muted small">{fmtDate(r.createdAt)}</span>
                  </div>
                  {r.comment && <p style={{ margin: '8px 0 0' }}>“{r.comment}”</p>}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
