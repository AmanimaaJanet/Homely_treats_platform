import webpush from 'web-push';
import { prisma } from '../prisma.js';
import { config } from '../config.js';

/**
 * Web push (PWA) notifications.
 *
 * Why this channel exists: SMS costs money per message and Textbelt's free tier is
 * blocked for Ghana; WhatsApp needs Meta-approved templates. Web push is free,
 * unlimited, instant and arrives on the phone's lock screen like an app notification
 * — so it is the cheapest way to tell a customer "your cake is ready".
 *
 * Keys: generate once with `npm run push:keys` (or `npx web-push generate-vapid-keys`)
 * and set VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY. The public key is exposed to the
 * browser through /api/push/public-key; the private key never leaves the server.
 */

let configured = false;

function configure() {
  if (configured) return true;
  if (!config.push.enabled) return false;
  webpush.setVapidDetails(config.push.subject, config.push.publicKey, config.push.privateKey);
  configured = true;
  return true;
}

export function pushEnabled() {
  return config.push.enabled;
}

export function publicKey() {
  return config.push.publicKey || null;
}

/** Store (or refresh) a browser subscription for a customer. */
export async function saveSubscription({ userId = null, endpoint, keys, userAgent = null }) {
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    throw Object.assign(new Error('That push subscription is incomplete'), { status: 400 });
  }
  return prisma.pushSubscription.upsert({
    where: { endpoint },
    update: { userId, p256dh: keys.p256dh, auth: keys.auth, userAgent, failures: 0 },
    create: { userId, endpoint, p256dh: keys.p256dh, auth: keys.auth, userAgent },
  });
}

export async function removeSubscription(endpoint) {
  if (!endpoint) return { count: 0 };
  return prisma.pushSubscription.deleteMany({ where: { endpoint } });
}

/**
 * Send one notification to every device a customer has subscribed.
 * Returns { sent, pruned } — expired subscriptions (404/410) are deleted so the table
 * doesn't grow forever with dead phones.
 */
export async function sendPushToUser(userId, payload) {
  if (!userId) return { sent: 0, pruned: 0 };
  const subs = await prisma.pushSubscription.findMany({ where: { userId } });
  return sendToSubscriptions(subs, payload);
}

/** Same, for every subscriber the bakery has (used for announcements). */
export async function sendPushToAll(payload) {
  const subs = await prisma.pushSubscription.findMany();
  return sendToSubscriptions(subs, payload);
}

async function sendToSubscriptions(subs, payload) {
  if (!configure()) {
    console.log(
      `\n[SIMULATED PUSH] ${payload.title}\n   ${payload.body}\n   → ${subs.length} device(s) would be notified\n`
    );
    return { sent: 0, pruned: 0, simulated: true, devices: subs.length };
  }

  const body = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url || '/',
    tag: payload.tag || undefined,
  });

  let sent = 0;
  let pruned = 0;
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        body
      );
      sent++;
      await prisma.pushSubscription.update({
        where: { id: sub.id },
        data: { lastUsedAt: new Date(), failures: 0 },
      });
    } catch (err) {
      // 404/410 mean the subscription is gone for good (app uninstalled, browser
      // data cleared) — delete it. Anything else is transient: count and move on.
      if (err.statusCode === 404 || err.statusCode === 410) {
        await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
        pruned++;
      } else {
        console.warn('[push] send failed:', err.statusCode || err.message);
        await prisma.pushSubscription
          .update({ where: { id: sub.id }, data: { failures: { increment: 1 } } })
          .catch(() => {});
      }
    }
  }
  return { sent, pruned };
}
