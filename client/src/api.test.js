import { describe, it, expect, vi, beforeEach } from 'vitest';
import { api, setToken, getToken } from './api.js';

/**
 * The API wrapper is where every failure message a customer sees is born, and where the
 * CSRF header that makes cookie sessions safe is attached. Both are worth pinning down.
 */

const jsonResponse = (body, { ok = true, status = 200 } = {}) => ({
  ok,
  status,
  json: async () => body,
});

beforeEach(() => {
  document.cookie = 'ht_csrf=; expires=Thu, 01 Jan 1970 00:00:00 GMT';
  setToken(null);
});

describe('request basics', () => {
  it('prefixes the API base path and sends cookies', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ products: [] }));
    global.fetch = fetchMock;

    await api.get('/products');

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/products');
    expect(options.credentials).toBe('include');
  });

  it('returns the parsed body', async () => {
    global.fetch = vi.fn().mockResolvedValue(jsonResponse({ products: [{ id: 'p1' }] }));
    await expect(api.get('/products')).resolves.toEqual({ products: [{ id: 'p1' }] });
  });

  it('attaches a bearer token only when asked (and one is held)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ ok: true }));
    global.fetch = fetchMock;

    await api.get('/wishlist');
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBeUndefined();

    setToken('tok-123');
    expect(getToken()).toBe('tok-123');
    await api.get('/wishlist', { auth: true });
    expect(fetchMock.mock.calls[1][1].headers.Authorization).toBe('Bearer tok-123');
  });

  it('does not set a JSON content-type for FormData uploads', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ url: '/uploads/a.jpg' }));
    global.fetch = fetchMock;

    // api.upload wraps the file in its own FormData — the browser must set the multipart
    // boundary, so the wrapper must not stamp a JSON content-type on it.
    const file = new File([new Blob(['x'], { type: 'image/jpeg' })], 'a.jpg', { type: 'image/jpeg' });
    await api.upload(file, { auth: true });

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/uploads');
    expect(options.headers['Content-Type']).toBeUndefined();
    expect(options.body).toBeInstanceOf(FormData);
    expect(options.body.get('file')).toBe(file);
  });
});

describe('CSRF protection on state-changing calls', () => {
  it('copies the CSRF cookie into a header on POST', async () => {
    document.cookie = 'ht_csrf=abc123';
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ ok: true }));
    global.fetch = fetchMock;

    await api.post('/orders', { items: [] });

    const [, options] = fetchMock.mock.calls[0];
    expect(options.headers['X-CSRF-Token']).toBe('abc123');
    expect(options.method).toBe('POST');
    expect(options.body).toBe(JSON.stringify({ items: [] }));
  });

  it('sends no CSRF header on reads, and none when the cookie is absent', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ ok: true }));
    global.fetch = fetchMock;

    await api.get('/products');
    expect(fetchMock.mock.calls[0][1].headers['X-CSRF-Token']).toBeUndefined();

    await api.del('/wishlist/p1');
    expect(fetchMock.mock.calls[1][1].headers['X-CSRF-Token']).toBeUndefined();
  });
});

describe('errors', () => {
  it('turns a refusal into an Error carrying the server message', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      jsonResponse({ error: 'That basket is below the zone minimum' }, { ok: false, status: 400 })
    );

    await expect(api.post('/orders', {})).rejects.toMatchObject({
      message: 'That basket is below the zone minimum',
      status: 400,
    });
  });

  it('carries the code and email a locked or unverified account needs', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      jsonResponse(
        { error: 'Confirm your email first', code: 'EMAIL_NOT_VERIFIED', email: 'ama@example.com' },
        { ok: false, status: 403 }
      )
    );

    await expect(api.post('/auth/login', {})).rejects.toMatchObject({
      status: 403,
      code: 'EMAIL_NOT_VERIFIED',
      email: 'ama@example.com',
    });
  });

  it('falls back to a readable message when the server sends no body', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 502,
      json: async () => {
        throw new Error('not json');
      },
    });

    await expect(api.get('/products')).rejects.toMatchObject({
      message: 'Request failed (502)',
      status: 502,
    });
  });
});
