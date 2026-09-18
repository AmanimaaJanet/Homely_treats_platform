import React from 'react';

/**
 * What a customer sees for the moment a page's code is still arriving.
 *
 * Routes are split into separate files (see App.jsx), so tapping "Menu" on a slow
 * connection downloads a ~10 kB chunk before the page appears. A blank screen during
 * that gap reads as "the site is broken"; this skeleton reads as "it's coming". It is
 * deliberately tiny — it ships in the main bundle, so every byte here is on the critical
 * path.
 */
export default function RouteFallback({ label = 'Loading', variant = 'page' }) {
  if (variant === 'admin') {
    return (
      <div className="route-fallback route-fallback-admin" role="status" aria-live="polite">
        <span className="route-spinner" aria-hidden="true" />
        <p className="muted small">{label}…</p>
      </div>
    );
  }

  return (
    <div className="page route-fallback" role="status" aria-live="polite">
      <div className="skeleton-stack" aria-hidden="true">
        <span className="skeleton skeleton-title" />
        <span className="skeleton skeleton-line" />
        <span className="skeleton skeleton-line short" />
        <div className="skeleton-grid">
          <span className="skeleton skeleton-card" />
          <span className="skeleton skeleton-card" />
          <span className="skeleton skeleton-card" />
        </div>
      </div>
      <p className="sr-only">{label}…</p>
    </div>
  );
}
