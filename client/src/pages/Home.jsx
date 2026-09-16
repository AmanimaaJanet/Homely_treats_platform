import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Star, Store, ArrowRight, MapPin, CreditCard, Truck } from 'lucide-react';
import { api } from '../api.js';
import ProductCard from '../components/ProductCard.jsx';
import VideoBlock from '../components/VideoBlock.jsx';
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
  const [minLead, setMinLead] = useState(2);

  useEffect(() => {
    api.get('/products?featured=true').then((d) => setFeatured(d.products.slice(0, 4))).catch(() => {});
    api.get('/reviews/recent').then((d) => setReviews(d.reviews)).catch(() => setReviews([]));
    api.get('/settings/public').then((d) => setMinLead(d.settings.minLeadDays || 2)).catch(() => {});
  }, []);

  return (
    <div className="page">
      {/* Hero — ambient video of fresh pastries, mobile-first */}
      <section className="hero hero-video">
        <VideoBlock
          eager
          className="hero-bg"
          src="/media/hero-tarts.mp4"
          srcSm="/media/hero-tarts-sm.mp4"
          poster="/media/hero-tarts-poster.jpg"
        />
        <div className="hero-inner">
          <div className="hero-text">
            <span className="hero-chip">Baked fresh · Handcrafted in Accra</span>
            <h1>
              Every Bite Made
              <br />
              Just for <span className="accent">You</span>
            </h1>
            <p className="hero-sub">
              Custom cakes, pastries, and confectioneries baked to order. Tell us the occasion,
              we&apos;ll bake it — then track it live from our kitchen to your door.
            </p>
            <div className="hero-cta">
              <button className="btn btn-primary" onClick={() => navigate('/custom-order')}>
                Order Now <ArrowRight size={18} />
              </button>
              <button className="btn btn-ghost hero-ghost" onClick={() => navigate('/menu')}>
                Explore Menu
              </button>
            </div>
            <ul className="hero-trust">
              <li><CreditCard size={15} /> MoMo, card &amp; pay on delivery</li>
              <li><Truck size={15} /> Delivery across Accra by zone</li>
              <li><MapPin size={15} /> Live order tracking</li>
            </ul>
          </div>
        </div>
      </section>

      <div className="container">
        {/* Featured products */}
        <div className="section">
          <h2 className="section-title">Featured Products</h2>
          {featured.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon"><Store size={48} strokeWidth={1.4} /></div>
              <p className="empty-state-text">Our menu is being freshly prepared</p>
              <p className="muted" style={{ marginBottom: '1.5rem' }}>
                Check back soon, or place a custom order and tell us exactly what you&apos;d like.
              </p>
              <button className="btn btn-primary" onClick={() => navigate('/custom-order')}>
                Place a Custom Order
              </button>
            </div>
          ) : (
            <>
              <div className="products-grid">
                {featured.map((p) => <ProductCard key={p.id} product={p} />)}
              </div>
              <div style={{ textAlign: 'center', marginTop: '2rem' }}>
                <button className="btn btn-outline" onClick={() => navigate('/menu')}>
                  View All Products <ArrowRight size={16} />
                </button>
              </div>
            </>
          )}
        </div>

        {/* From our kitchen — real footage of the work */}
        <div className="section kitchen-section">
          <h2 className="section-title">From Our Kitchen</h2>
          <p className="section-lead">
            Small batches, slow proofing, and pastry finished by hand — this is what goes into
            every order.
          </p>
          <div className="kitchen-grid">
            <figure className="kitchen-card">
              <VideoBlock
                className="kitchen-media"
                src="/media/hands-dough.mp4"
                poster="/media/hands-dough-poster.jpg"
              />
              <figcaption>
                <h3>Made from scratch</h3>
                <p>Dough is mixed, rested and shaped by hand each morning — never pre-made.</p>
              </figcaption>
            </figure>
            <figure className="kitchen-card">
              <VideoBlock
                className="kitchen-media"
                src="/media/craft-croissants.mp4"
                poster="/media/craft-croissants-poster.jpg"
              />
              <figcaption>
                <h3>Baked in small batches</h3>
                <p>Laminated pastries, tarts and macarons finished the same day you collect.</p>
              </figcaption>
            </figure>
          </div>
          <div className="kitchen-seal">
            <img src="/brand.png" alt="Homely Treats" className="kitchen-seal-img" />
            <div>
              <p className="kitchen-seal-title">Order ahead with confidence</p>
              <p className="muted small">
                Minimum {minLead} {minLead === 1 ? 'day' : 'days'} notice for custom cakes. Every
                order is confirmed with you before we bake.
              </p>
            </div>
          </div>
        </div>

        {/* How it works */}
        <div className="section band-dark">
          <h2 className="section-title">How It Works</h2>
          <div className="steps">
            <div className="step"><div className="step-number">1</div><h3>Choose Your Product</h3><p>Browse cakes, cupcakes, pastries & more</p></div>
            <div className="step"><div className="step-number">2</div><h3>Configure Your Order</h3><p>Size, flavour, icing, inscription & date</p></div>
            <div className="step"><div className="step-number">3</div><h3>Pay Securely</h3><p>MTN MoMo, AirtelTigo, Vodafone or card via Paystack</p></div>
            <div className="step"><div className="step-number">4</div><h3>Track & Collect</h3><p>Live status updates and delivery to your zone</p></div>
          </div>
          <div style={{ textAlign: 'center', marginTop: '2rem' }}>
            <button className="btn btn-primary" onClick={() => navigate('/custom-order')}>
              Place Your Order Now
            </button>
          </div>
        </div>

        {/* Reviews — real data only */}
        {reviews && reviews.length > 0 && (
          <div className="section band-light">
            <h2 className="section-title">What Our Customers Say</h2>
            <div className="testimonials">
              {reviews.slice(0, 3).map((r) => (
                <div className="testimonial" key={r.id}>
                  <StarRow n={r.rating} />
                  <p className="testimonial-text">&ldquo;{r.comment}&rdquo;</p>
                  <p className="testimonial-author">
                    {r.user?.fullName || 'Customer'}{r.createdAt ? ` · ${fmtDate(r.createdAt)}` : ''}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* CTA banner */}
        <div className="section cta-band">
          <h2>Ready to place your custom order?</h2>
          <p style={{ margin: '1rem 0' }}>
            Minimum {minLead} days advance notice required. Delivery across Accra by zone.
          </p>
          <button className="btn btn-secondary" onClick={() => navigate('/custom-order')}>
            Order Now <ArrowRight size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
