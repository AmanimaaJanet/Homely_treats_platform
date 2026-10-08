import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from './App.jsx';
import { AppProvider } from './store.jsx';

/**
 * Routing guards.
 *
 * Admin pages are lazy-loaded, which means the guard for them lives in the layout those
 * routes are nested under (AdminLayout) rather than in the route definitions. That makes
 * it possible to move a route out from under the guard during a refactor and never
 * notice — a page that still works when you are signed in, and quietly does not protect
 * anything when you are not. These tests hold that line.
 */

const ADMIN = { id: 'u1', name: 'Bakery Admin', email: 'admin@homelytreats.gh', role: 'ADMIN', points: 0 };
const CUSTOMER = { id: 'u2', name: 'Ama', email: 'ama@example.com', role: 'CUSTOMER', points: 40 };

function mockApi({ user, extra = {} } = {}) {
  const calls = [];
  global.fetch = async (url, options = {}) => {
    const path = String(url).replace('/api', '');
    calls.push({ path, method: options.method || 'GET' });
    if (extra[path]) return extra[path]();
    if (path === '/auth/me') {
      if (!user) return { ok: false, status: 401, json: async () => ({ error: 'Not signed in' }) };
      return { ok: true, status: 200, json: async () => ({ user }) };
    }
    // Anything else answers with an empty success so a page can finish rendering.
    return JSON.parse(JSON.stringify({ ok: true, status: 200, json: async () => ({}) }));
  };
  return calls;
}

function renderAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppProvider>
        <App />
      </AppProvider>
    </MemoryRouter>
  );
}

beforeEach(() => {
  localStorage.clear();
  document.cookie = 'ht_csrf=; expires=Thu, 01 Jan 1970 00:00:00 GMT';
});

describe('storefront routes', () => {
  it('renders the homepage with its navigation', async () => {
    mockApi();
    renderAt('/');
    expect(await screen.findByText(/Every Bite Made/i)).toBeInTheDocument();
  });

  it('loads the menu page, which arrives as a separate file', async () => {
    mockApi();
    renderAt('/menu');
    // The lazy chunk resolves inside the test, so this proves the split route mounts.
    await waitFor(() => expect(screen.queryByText(/Every Bite Made/i)).not.toBeInTheDocument());
    expect(await screen.findByRole('main')).toBeInTheDocument();
  });

  it('falls back to the homepage for an unknown address instead of a blank page', async () => {
    mockApi();
    renderAt('/no-such-page');
    expect(await screen.findByText(/Every Bite Made/i)).toBeInTheDocument();
  });
});

describe('admin routes are guarded', () => {
  it('sends a signed-out visitor to sign in rather than showing the panel', async () => {
    mockApi({ user: null });
    renderAt('/admin/orders');
    expect(await screen.findByRole('heading', { name: /welcome back/i })).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText('Admin Portal')).not.toBeInTheDocument());
  });

  it('keeps the print view — which is nested in the admin layout — behind the guard too', async () => {
    mockApi({ user: null });
    renderAt('/admin/print/HT-2026-0001');
    expect(await screen.findByRole('heading', { name: /welcome back/i })).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText('Admin Portal')).not.toBeInTheDocument());
  });

  it('does not treat a customer as an admin', async () => {
    mockApi({ user: CUSTOMER });
    renderAt('/admin/reports');
    expect(await screen.findByRole('heading', { name: /welcome back/i })).toBeInTheDocument();
  });

  it('shows the panel to an admin, inside the admin shell', async () => {
    mockApi({
      user: ADMIN,
      extra: {
        '/admin/reviews?status=PENDING&take=1': () => ({ ok: true, status: 200, json: async () => ({ summary: { PENDING: 0 } }) }),
      },
    });
    renderAt('/admin/orders');
    expect(await screen.findByText('Admin Portal')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /diagnostics/i })).toHaveAttribute('href', '/admin/diagnostics');
  });
});
