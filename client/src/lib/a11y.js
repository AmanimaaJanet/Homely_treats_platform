import { useEffect } from 'react';

/**
 * Small helpers for making a tappable element a real, keyboard-operable control.
 *
 * Throughout the app there are cards, rows and tiles that respond to a tap. As plain
 * `<div onClick>` they are invisible to a keyboard: no focus, no Enter, no Space. Where
 * converting the element to a `<button>` would fight the layout, `tappable()` gives it
 * the three things it is missing — a role, a place in the tab order, and key handling —
 * without changing a single pixel.
 *
 * Prefer a real `<button>` where the styling allows it; this is for the cases where the
 * element has to stay a `<div>` (a table row, a tile that contains its own buttons).
 */
export function onActivate(handler) {
  return (event) => {
    // Enter and Space are what a button responds to; Space also causes a scroll, so it is
    // cancelled only while the element is genuinely activated.
    if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar') {
      event.preventDefault();
      handler(event);
    }
  };
}

/**
 * Spread onto the element: `<div {...tappable(() => open(item), 'Open order HT-1')}>`.
 * Always pass a label when the element has no visible text — "Open order HT-1" is what a
 * screen reader announces instead of "button".
 */
export function tappable(handler, label) {
  return {
    role: 'button',
    tabIndex: 0,
    'aria-label': label,
    onClick: handler,
    onKeyDown: onActivate(handler),
  };
}

/**
 * Closing a dialog with Escape is expected behaviour, and a keyboard user has no other
 * way to back out of one. Pass the open state and what to do on Escape.
 */
export function useEscape(active, onEscape) {
  useEffect(() => {
    if (!active) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') onEscape(event);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, onEscape]);
}
