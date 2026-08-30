const BASE = '/api';

let token = localStorage.getItem('ht_token') || null;
export function setToken(t) {
  token = t;
  if (t) localStorage.setItem('ht_token', t);
  else localStorage.removeItem('ht_token');
}
export function getToken() {
  return token;
}

async function request(path, { method = 'GET', body, auth = false } = {}) {
  const headers = {};
  if (!(body instanceof FormData)) headers['Content-Type'] = 'application/json';
  if (auth && token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
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
