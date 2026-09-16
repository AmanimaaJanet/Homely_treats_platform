import React, { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { ProductIcon } from './ProductIcon.jsx';

/**
 * Product photo gallery.
 *
 * - One photo simply renders large.
 * - Several photos render as a swipeable strip with thumbnails; arrow buttons are
 *   shown for keyboard and desktop users, and the strip scrolls with touch.
 * - No photos falls back to the Lucide icon so the page never looks broken.
 */
export default function ProductGallery({ product }) {
  const images = product?.images || [];
  const [index, setIndex] = useState(0);

  // Reset when the customer switches product.
  useEffect(() => setIndex(0), [product?.id]);

  if (images.length === 0) {
    return (
      <div className="gallery gallery-fallback">
        <ProductIcon name={product?.icon || product?.emoji} size={96} strokeWidth={1.2} />
      </div>
    );
  }

  const alt = (i) => product.imageAlt || `${product.name}${images.length > 1 ? ` — photo ${i + 1}` : ''}`;
  const go = (next) => setIndex((next + images.length) % images.length);

  return (
    <div className="gallery">
      <div className="gallery-stage">
        <img src={images[index]} alt={alt(index)} decoding="async" />
        {images.length > 1 && (
          <>
            <button
              type="button"
              className="gallery-nav gallery-prev"
              onClick={() => go(index - 1)}
              aria-label="Previous photo"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              type="button"
              className="gallery-nav gallery-next"
              onClick={() => go(index + 1)}
              aria-label="Next photo"
            >
              <ChevronRight size={20} />
            </button>
            <span className="gallery-counter" aria-hidden="true">
              {index + 1} / {images.length}
            </span>
          </>
        )}
      </div>

      {images.length > 1 && (
        <div className="gallery-thumbs" role="tablist" aria-label="Product photos">
          {images.map((src, i) => (
            <button
              key={src}
              type="button"
              role="tab"
              aria-selected={i === index}
              className={`gallery-thumb ${i === index ? 'active' : ''}`}
              onClick={() => setIndex(i)}
            >
              <img src={src} alt="" decoding="async" loading="lazy" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
