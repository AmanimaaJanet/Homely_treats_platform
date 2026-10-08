// Homely Treats — service worker (PWA)
// Bump this when the precache list or asset strategy changes, so clients pick it up.
const CACHE = 'homely-treats-v6';
const PRECACHE = ['/', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE).catch(() => {})).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Network-first for navigation & API, cache-first for static assets.
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET') return;

  // Never cache API / websocket / uploads
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/ws') || url.pathname.startsWith('/uploads/')) {
    return;
  }

  // Static assets and product photography: cache-first, then network. Caching
  // images means a returning customer sees the menu instantly (and offline)
  // instead of re-downloading every photo over mobile data.
  const isCacheableAsset =
    url.pathname.startsWith('/assets/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname.startsWith('/media/') ||
    url.pathname === '/manifest.webmanifest' ||
    /\.(png|jpe?g|webp|avif|svg|gif|woff2?)$/i.test(url.pathname);

  if (isCacheableAsset) {
    event.respondWith(
      caches.match(event.request).then(
        (cached) =>
          cached ||
          fetch(event.request).then((res) => {
            // Only a genuine 2xx is cached. Caching a failure would pin it: the
            // next visits would serve the broken entry from cache forever, which is
            // exactly how one device can show broken photos while every other
            // device is fine.
            if (res.ok) {
              const copy = res.clone();
              caches.open(CACHE).then((cache) => cache.put(event.request, copy));
            }
            return res;
          })
      )
    );
    return;
  }

  // Navigations: network-first, fall back to cached shell
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put('/', copy));
          return res;
        })
        .catch(() => caches.match('/'))
    );
  }
});

// ---------------------------------------------------------------------------
// Push notifications
// ---------------------------------------------------------------------------
// Web push is the free channel: no per-message cost and no phone number needed, so
// "your cake is ready" can reach a customer who installed the app.
self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: 'Homely Treats', body: event.data ? event.data.text() : '' };
  }

  const title = payload.title || 'Homely Treats';
  const options = {
    body: payload.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    // Same tag replaces an older notification for the same order instead of stacking.
    tag: payload.tag || undefined,
    renotify: Boolean(payload.tag),
    data: { url: payload.url || '/' },
    vibrate: [80, 40, 80],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Tapping the notification focuses the app if it is already open, otherwise opens it.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          client.navigate(target).catch(() => {});
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    })
  );
});
