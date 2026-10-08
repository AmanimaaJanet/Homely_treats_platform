import React, { useEffect, useRef, useState } from 'react';

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Ambient background video, built mobile-first.
 *
 * Playback is deliberately slowed (see PLAYBACK_RATE below): background video at full
 * speed reads as urgent and busy behind the shop's calm serif headline — the moving
 * part should feel like ambience, not a countdown.
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
  // The hero video is above the fold but heavy (700 kB for the full-size file). Starting
  // it immediately makes it race the stylesheet, the fonts and the JavaScript — on a
  // phone on mobile data that is exactly the wrong order. So the still poster paints
  // first and the video element is mounted once the page has settled.
  const [settled, setSettled] = useState(!eager);

  useEffect(() => {
    if (settled) return;
    const go = () => setSettled(true);
    const timer = window.setTimeout(go, 1500);
    const onLoad = () => {
      if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(go, { timeout: 1000 });
      else go();
    };
    if (document.readyState === 'complete') onLoad();
    else window.addEventListener('load', onLoad, { once: true });
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('load', onLoad);
    };
  }, [settled]);

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

  // Slow, calm playback — ambience rather than motion. Set once the video element
  // exists (browsers reset the rate if it is set before the metadata arrives).
  useEffect(() => {
    const v = videoRef.current;
    if (!v || reduced) return;
    const apply = () => { try { v.playbackRate = 0.6; } catch { /* unsupported codec/rate */ } };
    apply();
    v.addEventListener('loadedmetadata', apply);
    return () => v.removeEventListener('loadedmetadata', apply);
  }, [active, settled, reduced]);

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
      {active && settled && !reduced ? (
        <video
          ref={videoRef}
          className="video-el"
          poster={poster}
          autoPlay
          muted
          loop
          playsInline
          // 'metadata' rather than 'auto': the poster is already on screen and the video
          // streams as it plays, so there is no reason to fetch the whole file up front.
          preload="metadata"
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
