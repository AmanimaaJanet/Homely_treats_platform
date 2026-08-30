import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Star, Store } from 'lucide-react';
import { api } from '../api.js';
import ProductCard from '../components/ProductCard.jsx';
import { fmtDate } from '../lib/format.js';

function StarRow({ n }) {
  return (
    <div className="stars">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} size={16} className={i <= n ? 'star-fill' : 'star-empty'} />
      ))}
    </div>
  );
}

export default function Home() {
  const navigate = useNavigate();
  const [featured, setFeatured] = useState([]);
  const [reviews, setReviews] = useState(null);

  useEffect(() => {
    api.get('/products?featured=true').then((d) => setFeatured(d.products.slice(0, 4))).catch(() => {});
    api.get('/reviews/recent').then((d) => setReviews(d.reviews)).catch(() => setReviews([]));
  }, []);

  return (
    <div className="page">
      <div className="hero">
        <img src="/brand.png" alt="Homely Treats" className="hero-logo" />
        <h1>Accra's Favourite Artisan Bakery</h1>
        <p className="hero-tag">Every Bite Made Just for You</p>
        <p className="hero-sub">
          Custom cakes, pastries, and confectioneries baked with love. Order online, pick up or get
          delivered — seamlessly.
        </p>
        <button className="btn btn-primary" onClick={() => navigate('/custom-order')}>Order Now →</button>
        <button className="btn btn-secondary" onClick={() => navigate('/menu')}>Explore Menu</button>
      </div>

      <div className="container">
        <div className="section">
          <h2 className="section-title">Custom Cakes · Personalised for You</h2>
          {featured.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon"><Store size={48} strokeWidth={1.4} /></div>
              <p className="empty-state-text">Our menu is being freshly prepared</p>
              <p className="muted" style={{ marginBottom: '1.5rem' }}>Check back soon, or place a custom order and tell us exactly what you'd like.</p>
              <button className="btn btn-primary" onClick={() => navigate('/custom-order')}>Place a Custom Order</button>
            </div>
          ) : (
            <>
              <div className="products-grid">
                {featured.map((p) => <ProductCard key={p.id} product={p} />)}
              </div>
              <div style={{ textAlign: 'center', marginTop: '2rem' }}>
                <button className="btn btn-secondary" onClick={() => navigate('/menu')}>View All Products →</button>
              </div>
            </>
          )}
        </div>

        <div className="section">
          <h2 className="section-title">How It Works</h2>
          <div className="steps">
            <div className="step"><div className="step-number">1</div><h3>Choose Your Product</h3><p>Browse cakes, cupcakes, pastries & more</p></div>
            <div className="step"><div className="step-number">2</div><h3>Configure Your Order</h3><p>Size, flavour, icing, inscription & date</p></div>
            <div className="step"><div className="step-number">3</div><h3>Pay Securely</h3><p>MTN MoMo, AirtelTigo, card — or pay on delivery</p></div>
            <div className="step"><div className="step-number">4</div><h3>Track & Collect</h3><p>Live tracking + SMS, WhatsApp & email updates</p></div>
          </div>
          <div style={{ textAlign: 'center', marginTop: '2rem' }}>
            <button className="btn btn-primary" onClick={() => navigate('/custom-order')}>Place Your Order Now</button>
          </div>
        </div>

        {reviews && reviews.length > 0 && (
          <div className="section">
            <h2 className="section-title">What Our Customers Say</h2>
            <div className="testimonials">
              {reviews.slice(0, 3).map((r) => (
                <div className="testimonial" key={r.id}>
                  <StarRow n={r.rating} />
                  <p className="testimonial-text">"{r.comment}"</p>
                  <p className="testimonial-author">{r.user?.fullName || 'Customer'}{r.createdAt ? ` · ${fmtDate(r.createdAt)}` : ''}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="section cta-band">
          <h2>Ready to place your custom order?</h2>
          <p style={{ margin: '1rem 0' }}>Minimum 2 days advance notice required. Delivery across Accra by zone.</p>
          <button className="btn btn-secondary" onClick={() => navigate('/custom-order')}>Order Now →</button>
        </div>
      </div>
    </div>
  );
}
