import React from 'react';
import { useApp } from '../store.jsx';

/**
 * Transient messages ("Added to basket", "Order placed", "That promo code has expired").
 *
 * These appear and disappear on their own, which makes them invisible to anyone using a
 * screen reader: the message is never in the document long enough to be found by
 * browsing. The container is therefore a live region — `polite` so confirmations wait
 * their turn, and each error gets `assertive` through role="alert" so a failure is not
 * missed while something else is being read out.
 */
export default function Toasts() {
  const { toasts } = useApp();
  return (
    <div className="toast-stack" role="status" aria-live="polite" aria-atomic="false">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`toast toast-${t.type}`}
          role={t.type === 'error' ? 'alert' : undefined}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}
