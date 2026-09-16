import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, Star } from 'lucide-react';
import { ghs } from '../lib/format.js';
import { api } from '../api.js';
import { useApp } from '../store.jsx';
import ProductPhoto from './ProductPhoto.jsx';

/**
 * Storefront product card.
 *
 * Two things here do the quiet work: the star line (real ratings, from approved
 * reviews only — hidden entirely when nobody has reviewed yet) and the heart, which
 * is how a sold-out product keeps its customer.
 */
export default function ProductCard({ product }) {
  const navigate = useNavigate();
  const { user, toast } = useApp();
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  // The wishlist is kept per-account; the card asks once and remembers.
  useEffect(() => {
    if (!user) return setSaved(false);
    api
      .get('/wishlist/ids', { auth: true })
      .then((d) => setSaved((d.productIds || []).includes(product.id)))
      .catch(() => {});
  }, [user, product.id]);

  const toggle = async (e) => {
    e.stopPropagation();
    if (!user) {
      toast('Sign in to save items and get restock alerts.', 'error');
      return navigate('/signin');
    }
    setBusy(true);
    try {
      if (saved) {
        await api.del(`/wishlist/${product.id}`, { auth: true });
        setSaved(false);
        toast(`Removed ${product.name} from your list.`, 'success');
      } else {
        const res = await api.post('/wishlist', { productId: product.id }, { auth: true });
        setSaved(true);
        toast(res.message || `Saved ${product.name}.`, 'success');
      }
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const soldOut = !product.inStock;
  const rating = product.rating || { average: 0, count: 0 };

  return (
    <div className={`product-card ${soldOut ? 'sold-out' : ''}`}>
      {product.badge && <span className="product-badge">{product.badge}</span>}

      <button
        type="button"
        className={`wish-heart ${saved ? 'saved' : ''}`}
        onClick={toggle}
        disabled={busy}
        title={saved ? 'Remove from your list' : soldOut ? 'Tell me when it is back' : 'Save for later'}
        aria-label={saved ? 'Remove from your list' : 'Save to your list'}
      >
        <Heart size={16} fill={saved ? 'currentColor' : 'none'} />
      </button>

      <ProductPhoto product={product} iconSize={52} onClick={() => navigate(`/menu/${product.id}`)} />

      <div className="product-info">
        <div className="product-name" onClick={() => navigate(`/menu/${product.id}`)}>{product.name}</div>

        {rating.count > 0 ? (
          <div className="product-rating">
            <Star size={13} className="star-fill-inline" />
            <strong>{rating.average}</strong>
            <span className="muted">({rating.count})</span>
          </div>
        ) : (
          <div className="product-rating muted small">No reviews yet</div>
        )}

        <div className="product-price">{ghs(product.basePrice)}</div>
        {product.description && <p className="product-desc">{product.description}</p>}

        <div className="product-actions">
          <button
            className="btn btn-primary btn-block"
            onClick={() => navigate(`/custom-order?product=${product.id}`)}
            disabled={soldOut}
          >
            {soldOut ? 'Sold out' : 'Customise & Order'}
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/menu/${product.id}`)}>
            Details
          </button>
        </div>

        {soldOut && (
          <p className="muted small">
            {saved ? "We'll email you the moment it's back." : 'Tap the heart to be told when it returns.'}
          </p>
        )}
      </div>
    </div>
  );
}
