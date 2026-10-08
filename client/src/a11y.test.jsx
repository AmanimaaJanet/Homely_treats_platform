import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SignIn from './pages/SignIn.jsx';
import Register from './pages/Register.jsx';
import { AppProvider } from './store.jsx';
import { LanguageProvider } from './lib/i18n.jsx';
import Toasts from './components/Toasts.jsx';
import { onActivate } from './lib/a11y.js';

/**
 * Accessibility checks that a machine can hold you to.
 *
 * These are the failures nobody notices from the outside: a field whose label is only
 * *next* to it (looks right, is announced as blank), a control only a mouse can press, a
 * message that appears and vanishes without being announced. Each test here fails if a
 * later refactor quietly undoes the fix.
 */

beforeEach(() => {
  global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });
});

const wrap = (ui) =>
  render(
    <MemoryRouter>
      <LanguageProvider>
    <LanguageProvider><AppProvider>{ui}  </AppProvider></LanguageProvider>
    </LanguageProvider>
    </MemoryRouter>
  );

describe('form fields have accessible names', () => {
  it('finds the sign-in fields by their visible labels', () => {
    wrap(<SignIn />);
    // getByLabelText only matches a real association — a label element sitting beside the
    // input is not enough, which is exactly the bug this guards.
    expect(screen.getByLabelText(/email address/i)).toHaveAttribute('type', 'email');
    expect(screen.getByLabelText(/^password/i)).toHaveAttribute('type', 'password');
  });

  it('labels every field on the registration form', () => {
    wrap(<Register />);
    for (const name of [/full name/i, /email address/i, /phone/i, /^password/i]) {
      expect(screen.getByLabelText(name)).toBeInTheDocument();
    }
  });

  it('does not let the label styling leak into what the customer types', () => {
    // The visible label is small-caps via a span; if the input were inside the styled
    // element instead, typed text would render in capitals.
    wrap(<SignIn />);
    const email = screen.getByLabelText(/email address/i);
    expect(email.closest('.form-label-text')).toBeNull();
    expect(email.closest('.form-label')).not.toBeNull();
  });
});

describe('keyboard operability', () => {
  it('activates on Enter and on Space', () => {
    const handler = vi.fn();
    const { getByRole } = render(
      <div role="button" tabIndex={0} aria-label="Open order" onKeyDown={onActivate(handler)} />
    );
    const el = getByRole('button', { name: /open order/i });

    fireEvent.keyDown(el, { key: 'Enter' });
    fireEvent.keyDown(el, { key: ' ' });
    expect(handler).toHaveBeenCalledTimes(2);

    // ...and not on an unrelated key.
    fireEvent.keyDown(el, { key: 'a' });
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it('makes the cart a real button, not a clickable picture', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ user: null }) });
    const { default: Navbar } = await import('./components/Navbar.jsx');
    wrap(<Navbar />);

    const cart = screen.getByRole('button', { name: /cart/i });
    // A native <button> is focusable and pressable with Enter and Space for free; the
    // div-with-role it replaced was neither.
    expect(cart.tagName).toBe('BUTTON');
    expect(cart.getAttribute('aria-label')).toMatch(/cart, \d+ item/i);
  });
});

describe('status messages are announced', () => {
  it('marks the toast area as a polite live region', async () => {
    const { container } = render(
      <MemoryRouter>
        <LanguageProvider><AppProvider>
          <Toasts />
        </AppProvider></LanguageProvider>
      </MemoryRouter>
    );
    const stack = container.querySelector('.toast-stack');
    expect(stack).toHaveAttribute('role', 'status');
    expect(stack).toHaveAttribute('aria-live', 'polite');
  });
});

describe('page structure', () => {
  it('offers a skip link to the main content', async () => {
    const { default: App } = await import('./App.jsx');
    render(
      <MemoryRouter initialEntries={['/signin']}>
        <LanguageProvider><AppProvider>
          <App />
        </AppProvider></LanguageProvider>
      </MemoryRouter>
    );
    const skip = await screen.findByRole('link', { name: /skip to main content/i });
    expect(skip).toHaveAttribute('href', '#main');
    expect(document.querySelector('main#main')).toBeInTheDocument();
  });
});
