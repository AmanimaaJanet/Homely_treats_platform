// Homely Treats — end-to-end feature test (self-contained)
//
// Run: node test-e2e.mjs   (from the server/ directory, server must be running)
//
// This suite works against a clean database (admin account only). It builds its
// own fixtures — products, zones, promo and a test customer — through the admin
// API and Prisma, runs every feature flow, then cleans up after itself so the
// database is left exactly as it found it (no fake/demo content).
import { WebSocket } from 'ws';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();
const BASE = process.env.API_URL || 'http://localhost:5000';
const WS_URL = BASE.replace(/^http/, 'ws');

const rnd = Math.random().toString(36).slice(2, 8).toUpperCase();
const CUST_EMAIL = `e2e.customer.${rnd.toLowerCase()}@test.com`;
const CUST_PASS = 'password123';
const PROD_VANILLA = `E2E Vanilla ${rnd}`;
const PROD_CHOC = `E2E Chocolate Fudge ${rnd}`;
const ZONE_NAME = `E2E East Legon ${rnd}`;
const PROMO_CODE = `E2E${rnd}`;

const results = [];
let passed = 0;
let failed = 0;
let adminToken = null;
let janetToken = null;

const created = { productIds: [], zoneIds: [], promoIds: [], orderIds: [], userId: null, photoFiles: [] };

function check(name, ok, extra = '') {
  if (ok) {
    passed++;
    results.push(`  ✅ ${name}${extra ? ' — ' + extra : ''}`);
  } else {
    failed++;
    results.push(`  ❌ ${name}${extra ? ' — ' + extra : ''}`);
  }
}

async function req(pathname, { method = 'GET', body, token, raw = false } = {}) {
  const headers = {};
  if (body !== undefined && !(body instanceof FormData)) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${pathname}`, {
    method,
    headers,
    body: body instanceof FormData ? body : body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (raw) return res;
  let data = null;
  try { data = await res.json(); } catch { /* empty */ }
  return { status: res.status, data };
}

async function teardown() {
  try {
    if (created.userId) await prisma.review.deleteMany({ where: { userId: created.userId } });
    if (created.orderIds.length) await prisma.order.deleteMany({ where: { id: { in: created.orderIds } } });
    if (created.productIds.length) {
      await prisma.productSize.deleteMany({ where: { productId: { in: created.productIds } } });
      await prisma.product.deleteMany({ where: { id: { in: created.productIds } } });
    }
    if (created.zoneIds.length) await prisma.deliveryZone.deleteMany({ where: { id: { in: created.zoneIds } } });
    if (created.promoIds.length) await prisma.promo.deleteMany({ where: { id: { in: created.promoIds } } });
    if (created.userId) await prisma.user.deleteMany({ where: { id: created.userId } });
    for (const f of created.photoFiles) await fs.promises.unlink(f).catch(() => {});
  } catch (err) {
    console.error('⚠ teardown error:', err.message);
  }
}

async function main() {
  console.log('\n🧪 Homely Treats — E2E feature test\n');

  // -------------------------------------------------- 0. Fixtures (admin builds from scratch)
  {
    const adminHash = await bcrypt.hash('admin123', 10);
    await prisma.user.upsert({
      where: { email: 'admin@homelytreats.gh' },
      update: { role: 'ADMIN' },
      create: {
        fullName: 'Store Admin', email: 'admin@homelytreats.gh', phone: '055 123 4567',
        passwordHash: adminHash, role: 'ADMIN', emailVerified: true,
      },
    });
    const cust = await prisma.user.create({
      data: {
        fullName: 'E2E Customer', email: CUST_EMAIL, phone: '055 000 0000',
        passwordHash: await bcrypt.hash(CUST_PASS, 10), role: 'CUSTOMER',
        emailVerified: true, loyaltyPoints: 120,
      },
    });
    created.userId = cust.id;
  }

  const admin = await req('/api/auth/login', { method: 'POST', body: { email: 'admin@homelytreats.gh', password: 'admin123' } });
  adminToken = admin.data?.token;
  check('Admin login', admin.status === 200 && !!adminToken);

  const custLogin = await req('/api/auth/login', { method: 'POST', body: { email: CUST_EMAIL, password: CUST_PASS } });
  janetToken = custLogin.data?.token;
  check('Customer login', custLogin.status === 200 && !!janetToken);

  // ---------------------------------------------------------------- 1. Health
  {
    const { data } = await req('/api/health');
    check('Health endpoint', data?.ok === true, `sms=${data?.smsProvider}`);
  }

  // ---------------------------------------------------------------- 2. Admin creates products (size-based pricing)
  let vanillaId = null;
  let chocId = null;
  {
    const mk = (name, base, sizes, badge) => req('/api/admin/products', {
      method: 'POST', token: adminToken,
      body: { name, category: 'CAKE', basePrice: base, icon: 'Cake', badge, featured: true, inStock: true, stock: 50, flavors: ['Vanilla', 'Chocolate'], sizeOptions: sizes },
    });
    const v = await mk(PROD_VANILLA, 280, [
      { label: '6 inch (serves 8)', serves: 8, price: 220 },
      { label: '8 inch (serves 14)', serves: 14, price: 280 },
      { label: '10 inch (serves 20)', serves: 20, price: 360 },
      { label: '12 inch (serves 28)', serves: 28, price: 440 },
    ], 'Featured');
    check('Admin creates product (vanilla)', v.status === 201 && !!v.data?.product?.id, v.data?.product?.id);
    vanillaId = v.data?.product?.id;
    created.productIds.push(vanillaId);

    const c = await mk(PROD_CHOC, 320, [
      { label: '6 inch (serves 8)', serves: 8, price: 260 },
      { label: '8 inch (serves 14)', serves: 14, price: 320 },
      { label: '10 inch (serves 20)', serves: 20, price: 400 },
      { label: '12 inch (serves 28)', serves: 28, price: 480 },
    ], 'Best Seller');
    check('Admin creates product (chocolate)', c.status === 201 && !!c.data?.product?.id, c.data?.product?.id);
    chocId = c.data?.product?.id;
    created.productIds.push(chocId);

    const { data } = await req('/api/products');
    const vanilla = data.products.find((p) => p.name === PROD_VANILLA);
    check('Products list returns created item', Array.isArray(data?.products) && !!vanilla, `${data.products.length} products`);
    check('Size options returned', vanilla?.sizeOptions?.length === 4, vanilla?.sizeOptions?.map((s) => `${s.label}=${s.price}`).join(', '));
    const six = vanilla?.sizeOptions?.find((s) => s.label.startsWith('6 inch'));
    check('Size price differs from base (6"=220 vs base 280)', six?.price === 220);
  }

  // ---------------------------------------------------------------- 3. Admin creates delivery zone
  let zoneId = null;
  {
    const { status, data } = await req('/api/admin/zones', {
      method: 'POST', token: adminToken, body: { name: ZONE_NAME, fee: 30, active: true },
    });
    zoneId = data?.zone?.id;
    created.zoneIds.push(zoneId);
    check('Admin creates delivery zone', status === 201 && !!zoneId);

    const zones = await req('/api/zones');
    const z = zones.data?.zones?.find((x) => x.name === ZONE_NAME);
    check('Zone listed publicly with fee 30', z?.fee === 30);
  }

  // ---------------------------------------------------------------- 4. Admin creates promo
  {
    const { status, data } = await req('/api/admin/promos', {
      method: 'POST', token: adminToken, body: { code: PROMO_CODE, type: 'PERCENT', value: 10, active: true },
    });
    created.promoIds.push(data?.promo?.id);
    check('Admin creates promo code', status === 201 && data?.promo?.code === PROMO_CODE);
  }

  // ---------------------------------------------------------------- 5. PWA + brand assets
  {
    const manifest = await req('/manifest.webmanifest', { raw: true });
    check('PWA manifest served', manifest.status === 200);
    const icon = await req('/icons/icon-192.png', { raw: true });
    check('PWA icon served', icon.status === 200 && icon.headers.get('content-type')?.includes('png'));
    const favicon = await req('/favicon.ico', { raw: true });
    check('Favicon served', favicon.status === 200);
    const brand = await req('/brand.png', { raw: true });
    check('Brand image served', brand.status === 200 && brand.headers.get('content-type')?.includes('png'));
    const sw = await req('/sw.js', { raw: true });
    check('Service worker served', sw.status === 200);
  }

  // ---------------------------------------------------------------- 6. Photo upload
  let photoUrl = null;
  {
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
      'base64'
    );
    const fd = new FormData();
    fd.append('file', new Blob([png], { type: 'image/png' }), 'design.png');
    const { status, data } = await req('/api/uploads', { method: 'POST', body: fd });
    photoUrl = data?.url;
    check('Photo upload', status === 201 && typeof photoUrl === 'string' && photoUrl.startsWith('/uploads/'), photoUrl);
    if (photoUrl) created.photoFiles.push(path.join(process.cwd(), 'uploads', photoUrl.split('/').pop()));
    const img = await req(photoUrl, { raw: true });
    check('Uploaded photo retrievable', img.status === 200);
  }

  // ---------------------------------------------------------------- 7. Order: size pricing + zone + promo + photo (guest)
  let guestOrderId = null;
  {
    const { status, data } = await req('/api/orders', {
      method: 'POST',
      body: {
        items: [{ productId: vanillaId, quantity: 1, size: '6 inch (serves 8)', flavor: 'Vanilla', icing: 'Buttercream' }],
        deliveryMethod: 'DELIVERY',
        deliveryZone: zoneId,
        deliveryAddress: 'House 5, East Legon',
        readyDate: '2026-09-05',
        paymentMethod: 'MOMO',
        promoCode: PROMO_CODE,
        photos: [photoUrl],
        guest: { name: 'Test Guest', email: `guest-${rnd.toLowerCase()}@test.com`, phone: '0550001111' },
      },
    });
    const o = data?.order;
    guestOrderId = o?.id;
    if (guestOrderId) created.orderIds.push(guestOrderId);
    check('Order created', status === 201 && !!guestOrderId, guestOrderId);
    check('Size-based unit price = 220 (not base 280)', o?.items?.[0]?.price === 220, `price=${o?.items?.[0]?.price}`);
    check('Subtotal 220', o?.subtotal === 220);
    check('Promo 10% = 22', o?.discount === 22);
    check('Zone fee 30 applied', o?.deliveryFee === 30 && o?.deliveryZone === ZONE_NAME);
    check('Total = 220-22+30 = 228', o?.total === 228, `total=${o?.total}`);
    check('Photo linked to order', o?.photos?.length === 1);
  }

  // ---------------------------------------------------------------- 8. Loyalty redemption
  let loyaltyOrderId = null;
  {
    const before = (await req('/api/auth/me', { token: janetToken })).data?.user?.loyaltyPoints;
    check('Customer has 120 pts', before === 120, `${before} pts`);

    const { status, data } = await req('/api/orders', {
      method: 'POST',
      token: janetToken,
      body: {
        items: [{ productId: vanillaId, quantity: 1, size: '6 inch (serves 8)' }],
        deliveryMethod: 'PICKUP', readyDate: '2026-09-05', paymentMethod: 'MOMO', pointsToRedeem: 100,
      },
    });
    loyaltyOrderId = data?.order?.id;
    if (loyaltyOrderId) created.orderIds.push(loyaltyOrderId);
    check('Loyalty order created', status === 201 && !!loyaltyOrderId, loyaltyOrderId);
    check('Redeemed 100 pts → GH₵ 5', data?.order?.pointsRedeemed === 100 && data?.order?.loyaltyDiscount === 5, `discount=${data?.order?.loyaltyDiscount}`);
    check('Total = 220 - 5 = 215', data?.order?.total === 215, `total=${data?.order?.total}`);

    const afterRedeem = (await req('/api/auth/me', { token: janetToken })).data?.user?.loyaltyPoints;
    check('Points deducted: 120 - 100 = 20', afterRedeem === 20, `${afterRedeem} pts`);
  }

  // ---------------------------------------------------------------- 9. Loyalty earning on payment
  {
    const { status, data } = await req(`/api/payments/${loyaltyOrderId}/simulate`, { method: 'POST' });
    check('Simulated payment', status === 200 && data?.ok === true);
    const me = (await req('/api/auth/me', { token: janetToken })).data?.user;
    check('Points earned on payment (20 + 215 = 235)', me?.loyaltyPoints === 235, `${me?.loyaltyPoints} pts`);
  }

  // ---------------------------------------------------------------- 10. Review flow
  {
    await req(`/api/admin/orders/${loyaltyOrderId}/status`, { method: 'PATCH', token: adminToken, body: { status: 'DELIVERED' } });

    const ptsBefore = (await req('/api/auth/me', { token: janetToken })).data?.user?.loyaltyPoints;
    const { status, data } = await req('/api/reviews', {
      method: 'POST', token: janetToken,
      body: { orderId: loyaltyOrderId, rating: 5, comment: 'E2E test review — delicious!' },
    });
    check('Review created', status === 201, data?.review?.id);
    check('Bonus +5 pts awarded', (await req('/api/auth/me', { token: janetToken })).data?.user?.loyaltyPoints === ptsBefore + 5);

    const dup = await req('/api/reviews', { method: 'POST', token: janetToken, body: { orderId: loyaltyOrderId, rating: 4, comment: 'again' } });
    check('Duplicate review rejected (409)', dup.status === 409);

    const notDelivered = await req('/api/orders', {
      method: 'POST', token: janetToken,
      body: { items: [{ productId: chocId, quantity: 1, size: '6 inch (serves 8)' }], deliveryMethod: 'PICKUP', readyDate: '2026-09-05', paymentMethod: 'MOMO' },
    });
    if (notDelivered.data?.order?.id) created.orderIds.push(notDelivered.data.order.id);
    const earlyReview = await req('/api/reviews', { method: 'POST', token: janetToken, body: { orderId: notDelivered.data.order.id, rating: 5 } });
    check('Review on non-delivered order rejected (400)', earlyReview.status === 400);

    const { data: recent } = await req('/api/reviews/recent');
    check('Review appears in /reviews/recent', recent?.reviews?.some((r) => r.rating === 5));
    const { data: stats } = await req('/api/reviews/stats');
    check('Review stats computed', stats?.count >= 1 && stats?.average > 0, `avg ${stats?.average} from ${stats?.count}`);
  }

  // ---------------------------------------------------------------- 11. WebSocket real-time updates
  {
    const { data } = await req('/api/orders', {
      method: 'POST',
      body: {
        items: [{ productId: chocId, quantity: 1, size: '6 inch (serves 8)' }],
        deliveryMethod: 'PICKUP', readyDate: '2026-09-05', paymentMethod: 'MOMO',
        guest: { name: 'WS Test', email: `ws-${rnd.toLowerCase()}@test.com`, phone: '0550002222' },
      },
    });
    const wsOrderId = data.order.id;
    created.orderIds.push(wsOrderId);

    const received = await new Promise((resolve) => {
      const ws = new WebSocket(`${WS_URL}/ws?order=${wsOrderId}`);
      const timer = setTimeout(() => { try { ws.close(); } catch {} resolve(null); }, 4000);
      ws.on('open', () => {
        setTimeout(() => {
          req(`/api/admin/orders/${wsOrderId}/status`, { method: 'PATCH', token: adminToken, body: { status: 'IN_PROGRESS' } });
        }, 300);
      });
      ws.on('message', (m) => {
        try {
          const msg = JSON.parse(m.toString());
          if (msg.type === 'ORDER_UPDATED') {
            clearTimeout(timer);
            try { ws.close(); } catch {}
            resolve(msg);
          }
        } catch {}
      });
      ws.on('error', () => { clearTimeout(timer); resolve(null); });
    });
    check('WebSocket broadcast on status change', received?.orderId === wsOrderId && received?.status === 'IN_PROGRESS', JSON.stringify(received));
  }

  // ---------------------------------------------------------------- 12. Rider app
  {
    const { data } = await req('/api/orders', {
      method: 'POST',
      body: {
        items: [{ productId: chocId, quantity: 1, size: '6 inch (serves 8)' }],
        deliveryMethod: 'DELIVERY', deliveryZone: zoneId, deliveryAddress: 'House 7, E2E',
        readyDate: '2026-09-06', paymentMethod: 'MOMO',
        guest: { name: 'Rider Test', email: `rider-${rnd.toLowerCase()}@test.com`, phone: '0550003333' },
      },
    });
    const riderOrderId = data.order.id;
    created.orderIds.push(riderOrderId);

    const setReady = await req(`/api/admin/orders/${riderOrderId}/status`, { method: 'PATCH', token: adminToken, body: { status: 'READY' } });
    check('Admin sets order READY', setReady.data?.order?.status === 'READY');

    const { data: rides } = await req('/api/rider/orders');
    const ready = rides?.orders?.find((o) => o.id === riderOrderId);
    check('Rider sees READY delivery', !!ready && ready.status === 'READY', riderOrderId);

    const accept = await req(`/api/rider/${riderOrderId}/accept`, { method: 'POST', body: { riderName: 'E2E Rider', riderPhone: '0240000000' } });
    check('Rider accepts → OUT_FOR_DELIVERY', accept.data?.order?.status === 'OUT_FOR_DELIVERY' && accept.data?.order?.riderName === 'E2E Rider');

    const track = await req(`/api/orders/track/${riderOrderId}`);
    check('Timeline includes out-for-delivery step', track.data?.timeline?.some((s) => s.key === 'OUT_FOR_DELIVERY' && s.done));

    const deliver = await req(`/api/rider/${riderOrderId}/deliver`, { method: 'POST' });
    check('Rider marks delivered', deliver.data?.order?.status === 'DELIVERED');
  }

  // ---------------------------------------------------------------- 13. Sales reports + CSV
  {
    const { status, data } = await req('/api/admin/reports?from=2026-08-01&to=2026-08-31', { token: adminToken });
    check('Reports generate', status === 200 && data?.orderCount >= 1, `${data?.orderCount} orders, revenue ${data?.revenue}`);
    check('Top products computed', Array.isArray(data?.topProducts) && data.topProducts.length >= 1);

    const csv = await req('/api/admin/reports/export?from=2026-08-01&to=2026-08-31', { token: adminToken, raw: true });
    const text = await csv.text();
    check('CSV export', csv.status === 200 && csv.headers.get('content-type')?.includes('text/csv'), `${text.split('\n').length} lines`);
    check('CSV has header row', text.includes('Order ID'));
    check('CSV contains an order created during this test', text.includes(guestOrderId));
  }

  // ---------------------------------------------------------------- 14. Cancel + point refund
  {
    const { data } = await req('/api/orders', {
      method: 'POST', token: janetToken,
      body: {
        items: [{ productId: vanillaId, quantity: 1, size: '6 inch (serves 8)' }],
        deliveryMethod: 'PICKUP', readyDate: '2026-09-06', paymentMethod: 'COD', pointsToRedeem: 40,
      },
    });
    const orderId = data.order.id;
    created.orderIds.push(orderId);
    const ptsAfterRedeem = (await req('/api/auth/me', { token: janetToken })).data?.user?.loyaltyPoints;
    const cancel = await req(`/api/orders/${orderId}/cancel`, { method: 'POST', token: janetToken });
    check('Order cancelled', cancel.status === 200 && cancel.data?.order?.status === 'CANCELLED');
    const ptsAfterCancel = (await req('/api/auth/me', { token: janetToken })).data?.user?.loyaltyPoints;
    check('Points refunded on cancel (+40)', ptsAfterCancel === ptsAfterRedeem + 40, `${ptsAfterRedeem} → ${ptsAfterCancel}`);
  }

  // ---------------------------------------------------------------- 15. Unauthorised guard
  {
    const r = await req('/api/admin/stats');
    check('Admin endpoints protected (401)', r.status === 401);
  }

  // ---------------------------------------------------------------- summary
  console.log('\n──────────────────────────────────────────');
  results.forEach((r) => console.log(r));
  console.log('──────────────────────────────────────────');
  console.log(`\n${passed} passed · ${failed} failed\n`);

  await teardown();
  const leftover = await prisma.product.count();
  const leftoverOrders = await prisma.order.count();
  console.log(`Teardown complete — DB now has ${leftover} products, ${leftoverOrders} orders (should be 0, 0).\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(async (err) => {
  console.error('Test crashed:', err);
  await teardown();
  await prisma.$disconnect();
  process.exit(1);
});
