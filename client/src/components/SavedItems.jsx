import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, Trash2, ShoppingBag, MailCheck } from 'lucide-react';
import { api } from '../api.js';
import { useApp } from '../store.jsx';
import { ghs } from '../lib/format.js';
import ProductPhoto from './ProductPhoto.jsx';

/**
 * "Saved items" — the wishlist, and the promise attached to it: if something is sold
 * out when you save it, we email you the moment it is back.
 */
export default function SavedItems() {
  const navigate = useNavigate();
  const { toast } = useApp();
  const [items, setItems] = useState(null);

  const load = () =>
    api
      .get('/wishlist', { auth: true })
      .then((d) => setItems(d.items))
      .catch(() => setItems([]));

  useEffect(() => {
    load();
  }, []);

  const remove = async (productId, name) => {
    try {
      await api.del(`/wishlist/${productId}`, { auth: true });
      setItems((list) => list.filter((i) => i.productId !== productId));
      toast(`Removed ${name}.`, 'success');
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  if (items === null) return <p className="muted small">Loading…</p>;

  if (items.length === 0) {
    return (
      <div className="empty-state">
        <Heart size={28} />
        <p>Nothing saved yet.</p>
        <p className="muted small">
          Tap the heart on any product to keep it here — and to be emailed if it sells out
          and comes back.
        </p>
        <button className="btn btn-secondary btn-sm" onClick={() => navigate('/menu')}>
          Browse the menu
        </button>
      </div>
    );
  }

  const waiting = items.filter((i) => !i.product?.inStock || (i.product?.stock ?? 0) <= 0).length;

  return (
    <>
      {waiting > 0 && (
        <p className="muted small">
          <MailCheck size={14} /> {waiting} item{waiting === 1 ? '' : 's'} here {waiting === 1 ? 'is' : 'are'}{' '}
          sold out — we'll email you the moment {waiting === 1 ? 'it is' : 'they are'} back.
        </p>
      )}

      <div className="saved-grid">
        {items.map(({ product, id, notifiedAt }) => (
          <div className="saved-item" key={id}>
            <ProductPhoto product={product} iconSize={34} onClick={() => navigate(`/menu/${product.id}`)} />
            <div className="saved-info">
              <strong>{product.name}</strong>
              <span className="muted small">{ghs(product.basePrice)}</span>
              {product.inStock ? (
                <span className="muted small">{product.stock} in stock</span>
              ) : (
                <span className="status-pill pending">Sold out{notifiedAt ? ' · you were emailed' : ''}</span>
              )}
            </div>
            <div className="row-actions">
              <button
                className="btn btn-secondary btn-sm"
                disabled={!product.inStock}
                onClick={() => navigate(`/custom-order?product=${product.id}`)}
              >
                <ShoppingBag size={14} /> {product.inStock ? 'Order' : 'Sold out'}
              </button>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => remove(product.id, product.name)}
                title="Remove from saved items"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
