import { api } from '../api.js';

/**
 * Browser push helpers.
 *
 * A push subscription is per browser, not per person, so the flow is: ask permission →
 * subscribe → hand the endpoint to the server (tied to the account when signed in).
 * Everything degrades quietly: unsupported browsers, a denied permission, or a server
 * without VAPID keys simply means "no push", never a broken page.
 */

export function pushSupported() {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window;
}

/** Base64url VAPID key → the Uint8Array the Push API wants. */
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export async function pushState() {
  if (!pushSupported()) return { supported: false, subscribed: false };
  try {
    const { enabled, publicKey } = await api.get('/push/public-key');
    if (!enabled) return { supported: true, configured: false, subscribed: false };
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    return {
      supported: true,
      configured: true,
      publicKey,
      subscribed: !!sub,
      permission: typeof Notification !== 'undefined' ? Notification.permission : 'default',
    };
  } catch {
    return { supported: pushSupported(), configured: false, subscribed: false };
  }
}

export async function enablePush() {
  if (!pushSupported()) throw new Error('This browser cannot show push notifications.');
  const { enabled, publicKey } = await api.get('/push/public-key');
  if (!enabled) throw new Error('Push notifications are not switched on for this shop yet.');

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Notifications are blocked in your browser settings.');

  const reg = await navigator.serviceWorker.ready;
  const existing = await reg.pushManager.getSubscription();
  const sub =
    existing ||
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    }));

  const json = sub.toJSON();
  await api.post(
    '/push/subscribe',
    { endpoint: json.endpoint, keys: { p256dh: json.keys?.p256dh, auth: json.keys?.auth } },
    { auth: true }
  );
  return { ok: true };
}

export async function disablePush() {
  if (!pushSupported()) return { ok: true };
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return { ok: true };
  const endpoint = sub.endpoint;
  await sub.unsubscribe().catch(() => {});
  await api.post('/push/unsubscribe', { endpoint }).catch(() => {});
  return { ok: true };
}
