import React, { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import ProductMonogram from './ProductMonogram.jsx';

/**
 * Product photo gallery.
 *
 * - One photo simply renders large.
 * - Several photos render as a swipeable strip with thumbnails; arrow buttons are
 *   shown for keyboard and desktop users, and the strip scrolls with touch.
 * - No photos falls back to a typographic monogram so the page never looks broken.
 */
export default function ProductGallery({ product }) {
  const images = product?.images || [];
  const [index, setIndex] = useState(0);
  // A photo that fails to load (file lost to a server rebuild, flaky connection) is
  // skipped rather than shown as a broken-image icon.
  const [broken, setBroken] = useState(new Set());
  const good = images.filter((src) => !broken.has(src));

  // Reset when the customer switches product.
  useEffect(() => { setIndex(0); setBroken(new Set()); }, [product?.id]);

  if (good.length === 0) {
    return (
      <div className="gallery gallery-fallback">
        <ProductMonogram name={product?.name} size={140} />
      </div>
    );
  }

  const alt = (i) => product.imageAlt || `${product.name}${good.length > 1 ? ` — photo ${i + 1}` : ''}`;
  const go = (next) => setIndex((next + good.length) % good.length);

  return (
    <div className="gallery">
      <div className="gallery-stage">
        <img src={good[index]} alt={alt(index)} decoding="async" onError={() => setBroken((b) => new Set(b).add(images[index]))} />
        {good.length > 1 && (
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
              {index + 1} / {good.length}
            </span>
          </>
        )}
      </div>

      {good.length > 1 && (
        <div className="gallery-thumbs" role="tablist" aria-label="Product photos">
          {good.map((src, i) => (
            <button
              key={src}
              type="button"
              role="tab"
              aria-selected={i === index}
              className={`gallery-thumb ${i === index ? 'active' : ''}`}
              onClick={() => setIndex(i)}
            >
              <img src={src} alt="" decoding="async" loading="lazy" onError={() => setBroken((b) => new Set(b).add(src))} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
