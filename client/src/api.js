const BASE = '/api';

/**
 * The session lives in an httpOnly cookie set by the server, so JavaScript
 * cannot read the token (that is the point — an XSS bug can't steal it).
 *
 * `auth` is kept on the call sites for clarity and to mean "this request expects
 * a signed-in user"; the cookie travels automatically on same-origin requests.
 * API clients that hold a Bearer token can still pass one, which is how the
 * E2E suite and the rider tooling authenticate.
 */
let bearerToken = null;
export function setToken(t) {
  bearerToken = t || null;
}
export function getToken() {
  return bearerToken;
}

/** Read a cookie by name (only the non-httpOnly CSRF cookie is readable). */
function readCookie(name) {
  return document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${name}=`))
    ?.split('=')[1] || null;
}

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

async function request(path, { method = 'GET', body, auth = false } = {}) {
  const headers = {};
  if (!(body instanceof FormData)) headers['Content-Type'] = 'application/json';
  if (auth && bearerToken) headers.Authorization = `Bearer ${bearerToken}`;

  // Double-submit CSRF token: the server compares this header with the cookie.
  if (MUTATING.has(method)) {
    const csrf = readCookie('ht_csrf');
    if (csrf) headers['X-CSRF-Token'] = csrf;
  }

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    // Send cookies on same-origin (and cross-origin in dev, where the allowlist
    // is explicit) so the session cookie reaches the API.
    credentials: 'include',
    body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
  });

  let data = null;
  try {
    data = await res.json();
  } catch {
    /* empty response */
  }
  if (!res.ok) {
    const err = new Error(data?.error || `Request failed (${res.status})`);
    err.status = res.status;
    err.code = data?.code;
    err.email = data?.email;
    throw err;
  }
  return data;
}

export const api = {
  get: (path, opts) => request(path, { ...opts, method: 'GET' }),
  post: (path, body, opts) => request(path, { ...opts, method: 'POST', body }),
  put: (path, body, opts) => request(path, { ...opts, method: 'PUT', body }),
  patch: (path, body, opts) => request(path, { ...opts, method: 'PATCH', body }),
  del: (path, opts) => request(path, { ...opts, method: 'DELETE' }),
  upload: (file, opts) => {
    const fd = new FormData();
    fd.append('file', file);
    return request('/uploads', { ...opts, method: 'POST', body: fd });
  },
};

// Loyalty constants (mirrors server/src/config.js)
export const LOYALTY = { pointsToGhs: 20, maxRedeemRatio: 0.5 };
export function pointsValue(points) {
  return points / LOYALTY.pointsToGhs;
}
export function maxRedeemablePoints(userPoints, orderValue) {
  const cap = orderValue * LOYALTY.maxRedeemRatio;
  const cappedPoints = Math.floor(cap * LOYALTY.pointsToGhs);
  return Math.max(0, Math.min(userPoints, cappedPoints));
}
