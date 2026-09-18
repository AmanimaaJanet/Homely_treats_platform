import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// Rendering to a detached container is right for tests but must be torn down between
// them, or the next test sees the previous one's DOM.
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// jsdom has no matchMedia; the app asks for it when it checks a dark-mode preference.
if (!window.matchMedia) {
  window.matchMedia = (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  });
}

// The store reads these on boot; jsdom provides localStorage but not scrollTo.
if (!window.scrollTo) window.scrollTo = () => {};
