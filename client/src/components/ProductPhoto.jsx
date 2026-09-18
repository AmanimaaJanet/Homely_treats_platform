import React from 'react';
import { ProductIcon } from './ProductIcon.jsx';
import { onActivate } from '../lib/a11y.js';

/**
 * Displays a product photo, falling back to its Lucide icon when no photo has
 * been uploaded yet — so the menu looks intentional before real photography
 * exists rather than showing broken images.
 *
 * Loading is lazy by default (a menu of photos should not block first paint) and
 * images are decoded asynchronously so scrolling stays smooth on phones.
 */
export default function ProductPhoto({
  product,
  className = '',
  iconSize = 52,
  eager = false,
  onClick,
}) {
  const photo = product?.images?.[0];
  const clickable = typeof onClick === 'function';
  if (!photo) {
    return (
      <div
        className={`product-image ${className} ${clickable ? 'clickable' : ''}`}
        onClick={onClick}
        // A photo that opens the product must be reachable and pressable from a keyboard,
        // and must say what it does — the image alone would be announced as "button".
        role={clickable ? 'button' : undefined}
        tabIndex={clickable ? 0 : undefined}
        aria-label={clickable ? `View ${product?.name || 'this product'}` : undefined}
        onKeyDown={clickable ? onActivate(onClick) : undefined}
      >
        <ProductIcon name={product?.icon || product?.emoji} size={iconSize} />
      </div>
    );
  }
  return (
    <div
      className={`product-image has-photo ${className} ${clickable ? 'clickable' : ''}`}
      onClick={onClick}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      aria-label={clickable ? `View ${product?.name || 'this product'}` : undefined}
      onKeyDown={clickable ? onActivate(onClick) : undefined}
    >
      <img
        src={photo}
        // Alt text describes the product for screen readers; admins can override it.
        alt={product.imageAlt || product.name || 'Product photo'}
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
      />
    </div>
  );
}
