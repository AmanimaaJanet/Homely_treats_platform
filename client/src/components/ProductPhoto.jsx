import React from 'react';
import { ProductIcon } from './ProductIcon.jsx';

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
}) {
  const photo = product?.images?.[0];
  if (!photo) {
    return (
      <div className={`product-image ${className}`}>
        <ProductIcon name={product?.icon || product?.emoji} size={iconSize} />
      </div>
    );
  }
  return (
    <div className={`product-image has-photo ${className}`}>
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
