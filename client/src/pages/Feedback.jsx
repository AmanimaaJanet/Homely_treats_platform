import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Star, MessageSquareHeart, Check } from 'lucide-react';
import { api } from '../api.js';
import { useApp } from '../store.jsx';
import Seo from '../components/Seo.jsx';

/**
 * Public feedback — "what did you think of the shop?"
 *
 * Anyone can leave a note (no account, no order needed). Nothing is published
 * automatically: the bakery reads every note and chooses which ones appear on the
 * homepage, which is what the customer is told here — no promise the page cannot keep.
 */
export default function Feedback() {
  const { toast } = useApp();
  const [name, setName] = useState('');
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!rating) return toast('Please choose a star rating first.', 'error');
    setBusy(true);
    try {
      const res = await api.post('/feedback', { name, rating, message });
      setSent(true);
      toast(res.message || 'Thank you!', 'success');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <div className="page">
        <Seo title="Feedback" description="Tell Homely Treats what you thought." noindex />
        <div className="container">
          <div className="section" style={{ maxWidth: 520, margin: '3rem auto', textAlign: 'center' }}>
            <div className="empty-state-icon"><Check size={44} strokeWidth={1.4} /></div>
            <h2 className="section-title">Thank you</h2>
            <p className="muted" style={{ marginBottom: '1.5rem' }}>
              Your feedback has reached the bakery — we read every note. If it is shared on
              the homepage, it will appear under “What Our Customers Say”.
            </p>
            <Link className="btn btn-primary" to="/">Back to the shop</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <Seo title="Feedback" description="Tell Homely Treats what you thought — every note reaches the bakery." noindex />
      <div className="container">
        <div className="section" style={{ maxWidth: 520, margin: '2.5rem auto' }}>
          <h2 className="section-title">Share your feedback</h2>
          <p className="muted" style={{ marginBottom: '1.5rem' }}>
            What did you think of your treat, the delivery, the packaging — anything. Every
            note reaches the bakery, and the best ones are shared on the homepage.
          </p>

          <form onSubmit={submit}>
            <div className="form-group">
              <label className="form-label">
                <span className="form-label-text">Your name (as you would like it shown)</span>
                <input
                  className="form-input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Ama K."
                  maxLength={80}
                />
              </label>
            </div>

            <div className="form-group">
              <span className="form-label-text" id="rating-label" style={{ display: 'block', marginBottom: 8 }}>Your rating</span>
              <div className="feedback-stars" role="radiogroup" aria-labelledby="rating-label" onMouseLeave={() => setHover(0)}>
                {[1, 2, 3, 4, 5].map((i) => (
                  <button
                    key={i}
                    type="button"
                    role="radio"
                    aria-checked={rating === i}
                    aria-label={`${i} star${i === 1 ? '' : 's'}`}
                    className="feedback-star-btn"
                    onClick={() => setRating(i)}
                    onMouseEnter={() => setHover(i)}
                  >
                    <Star
                      size={30}
                      className={(hover || rating) >= i ? 'star-fill' : 'star-empty'}
                    />
                  </button>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">
                <span className="form-label-text">Your feedback</span>
                <textarea
                  className="form-input"
                  rows={5}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Tell us what you loved, or what we could do better…"
                  maxLength={600}
                  required
                />
              </label>
            </div>

            <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
              <MessageSquareHeart size={16} /> {busy ? 'Sending…' : 'Send feedback'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
