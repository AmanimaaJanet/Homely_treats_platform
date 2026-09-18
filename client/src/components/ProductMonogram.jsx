import React from 'react';

/**
 * A product's initial set in the brand serif — the stand-in used wherever a product
 * has no photo yet.
 *
 * A generic pictogram (a cake outline, a cookie) reads as "placeholder template";
 * a typographic monogram reads as a deliberate choice while real photography is
 * still to come. It also stays correct for every product the shop will ever add,
 * because it is derived from the product's own name.
 *
 * `ring` draws the fine circle used on cream tiles (menu cards, the product page).
 * Set it to false inside a coloured tile that already frames the letter.
 */
export default function ProductMonogram({ name, size = 76, ring = true, className = '' }) {
  const letter = (name || '?').trim().charAt(0).toUpperCase() || '?';
  return (
    <span
      className={`product-mono ${ring ? '' : 'product-mono-plain'} ${className}`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.52) }}
      aria-hidden="true"
    >
      {letter}
    </span>
  );
}
