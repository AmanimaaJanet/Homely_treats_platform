import React, { useEffect, useRef, useState } from 'react';

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Ambient background video, built mobile-first.
 *
 * - Lazy: only starts loading/playing once scrolled near the viewport
 *   (pass `eager` for the hero, which is above the fold).
 * - Data-friendly: serves the smaller `srcSm` file on phones via
 *   <source media="…">, and pauses itself when the tab is hidden.
 * - Accessible: shows the still poster image instead of video for people who
 *   set "reduce motion", so nothing animates unexpectedly.
 * - Always muted + playsInline so mobile browsers allow autoplay.
 */
export default function VideoBlock({
  src,
  srcSm,
  poster,
  className = '',
  eager = false,
  caption,
  overlay = true,
  children,
}) {
  const wrapRef = useRef(null);
  const videoRef = useRef(null);
  const [reduced] = useState(prefersReducedMotion);
  const [active, setActive] = useState(eager || reduced);

  // Start loading only when the block approaches the viewport.
  useEffect(() => {
    if (active) return;
    const el = wrapRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setActive(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setActive(true);
          io.disconnect();
        }
      },
      { rootMargin: '250px 0px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [active]);

  // Don't waste battery or data playing video in a hidden tab.
  useEffect(() => {
    if (!active || reduced) return;
    const onVisibility = () => {
      const v = videoRef.current;
      if (!v) return;
      if (document.hidden) v.pause();
      else v.play().catch(() => {});
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [active, reduced]);

  return (
    <div ref={wrapRef} className={`video-block ${className}`}>
      {active && !reduced ? (
        <video
          ref={videoRef}
          className="video-el"
          poster={poster}
          autoPlay
          muted
          loop
          playsInline
          preload={eager ? 'auto' : 'metadata'}
          disablePictureInPicture
          aria-hidden="true"
          tabIndex={-1}
        >
          {srcSm && <source src={srcSm} media="(max-width: 640px)" type="video/mp4" />}
          <source src={src} type="video/mp4" />
        </video>
      ) : (
        <img
          className="video-el"
          src={poster}
          alt=""
          aria-hidden="true"
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
        />
      )}
      {overlay && <div className="video-scrim" aria-hidden="true" />}
      {children}
      {caption && <p className="video-caption">{caption}</p>}
    </div>
  );
}
