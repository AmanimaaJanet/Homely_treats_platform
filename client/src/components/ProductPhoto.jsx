import React, { useState } from 'react';
import ProductMonogram from './ProductMonogram.jsx';
import { onActivate } from '../lib/a11y.js';

/**
 * Displays a product photo, falling back to a typographic monogram of the
 * product's initial when no photo has been uploaded yet — so the menu looks
 * intentional before real photography exists rather than showing broken images.
 *
 * The same fallback covers a photo that fails to load (a file lost to a server
 * rebuild, a flaky connection): the card keeps its shape and shows the monogram
 * instead of the browser's broken-image icon. Nobody outside the admin panel can
 * tell the difference between "no photo yet" and "photo unavailable right now".
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
  const [broken, setBroken] = useState(false);
  const showPhoto = photo && !broken;
  const clickable = typeof onClick === 'function';

  const frameProps = {
    className: `product-image ${showPhoto ? 'has-photo' : ''} ${className} ${clickable ? 'clickable' : ''}`,
    onClick,
    // A photo that opens the product must be reachable and pressable from a keyboard,
    // and must say what it does — the image alone would be announced as "button".
    role: clickable ? 'button' : undefined,
    tabIndex: clickable ? 0 : undefined,
    'aria-label': clickable ? `View ${product?.name || 'this product'}` : undefined,
    onKeyDown: clickable ? onActivate(onClick) : undefined,
  };

  if (!showPhoto) {
    return (
      <div {...frameProps}>
        <ProductMonogram name={product?.name} size={Math.round(iconSize * 1.5)} />
      </div>
    );
  }
  return (
    <div {...frameProps}>
      <img
        key={photo}
        src={photo}
        // Alt text describes the product for screen readers; admins can override it.
        alt={product.imageAlt || product.name || 'Product photo'}
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        onError={() => setBroken(true)}
      />
    </div>
  );
}
