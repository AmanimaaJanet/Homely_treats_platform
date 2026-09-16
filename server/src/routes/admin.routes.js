import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../prisma.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { applyStatus, refundOrder } from '../services/orderEvents.js';
import { getSettings, saveSettings } from '../services/settings.js';
import { audit } from '../services/audit.js';
import { lowStockProducts, sendLowStockDigest } from '../services/stockAlerts.js';
import { describeTemplates } from '../services/whatsappTemplates.js';
import { sendTemplateTest } from '../services/whatsapp.js';
import { config, ORDER_STATUSES } from '../config.js';

const router = Router();

router.use(requireAuth, requireAdmin);

/** Trim a user-supplied string and cap its length (defensive against junk payloads). */
function clean(value, maxLen = 200) {
  if (value === undefined || value === null) return '';
  return String(value).trim().slice(0, maxLen);
}

/**
 * Sanitise the product image list: keep only strings that look like image URLs we
 * produced (an /uploads/ path or an https URL from our storage), drop blanks and
 * duplicates, and cap the count. Order is preserved because images[0] is the cover.
 */
const MAX_PRODUCT_IMAGES = 8;

/**
 * Per-product notice, in days. Empty means "use the shop-wide lead time" (stored as
 * SQL NULL, not 0 — a cake needing *same-day* pickup and a cake with no opinion are
 * different things).
 */
function normalizeLeadDays(v) {
  if (v === '' || v === null || v === undefined) return null;
  const n = parseInt(v, 10);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.min(60, n);
}
function normalizeImages(input) {
  if (!Array.isArray(input)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of input) {
    const url = String(raw || '').trim();
    if (!url) continue;
    // Same-origin asset paths only (uploads, or the bundled image directory),
    // never a path that could climb out of the site root.
    const isLocal = /^\/(uploads|catalogue|media)\/[A-Za-z0-9._-]+$/.test(url);
    // Or a Cloudinary delivery URL, for products photographed in production.
    const isHttps = /^https:\/\/res\.cloudinary\.com\/[\w./-]+$/.test(url);
    if (!isLocal && !isHttps) continue; // reject anything else outright
    if (seen.has(url)) continue;
    seen.add(url);
    out.push(url);
    if (out.length >= MAX_PRODUCT_IMAGES) break;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Dashboard stats
// ---------------------------------------------------------------------------
router.get('/stats', async (req, res) => {
  try {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const [totalRevenue, ordersToday, activeOrders, totalCustomers, newCustomers, monthlyRevenue, pendingPayments] =
      await Promise.all([
        prisma.order.aggregate({
          _sum: { total: true },
          where: { paymentStatus: { in: ['PAID', 'SIMULATED'] }, status: { not: 'CANCELLED' } },
        }),
        prisma.order.count({ where: { createdAt: { gte: todayStart } } }),
        prisma.order.count({ where: { status: { in: ['CONFIRMED', 'IN_PROGRESS', 'READY', 'OUT_FOR_DELIVERY'] } } }),
        prisma.user.count({ where: { role: 'CUSTOMER' } }),
        prisma.user.count({ where: { role: 'CUSTOMER', createdAt: { gte: monthStart } } }),
        prisma.order.aggregate({
          _sum: { total: true },
          where: { createdAt: { gte: monthStart }, paymentStatus: { in: ['PAID', 'SIMULATED'] } },
        }),
        prisma.order.count({ where: { paymentStatus: 'PENDING', status: { not: 'CANCELLED' } } }),
      ]);

    const months = [];
    for (let i = 7; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const next = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      const agg = await prisma.order.aggregate({
        _sum: { total: true },
        where: { createdAt: { gte: d, lt: next }, paymentStatus: { in: ['PAID', 'SIMULATED'] } },
      });
      months.push({ label: d.toLocaleString('en', { month: 'short' }), value: Math.round(agg._sum.total || 0) });
    }

    const items = await prisma.orderItem.findMany({
      include: { product: true },
      where: { order: { paymentStatus: { in: ['PAID', 'SIMULATED'] } } },
    });
    const catMap = {};
    for (const it of items) {
      const cat = it.product?.category || 'OTHER';
      catMap[cat] = (catMap[cat] || 0) + it.price * it.quantity;
    }
    const categories = Object.entries(catMap).map(([name, value]) => ({ name, value: Math.round(value) }));

    res.json({
      totalRevenue: Math.round(totalRevenue._sum.total || 0),
      ordersToday,
      activeOrders,
      totalCustomers,
      newCustomers,
      monthlyRevenue: Math.round(monthlyRevenue._sum.total || 0),
      pendingPayments,
      months,
      categories,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load stats' });
  }
});

// ---------------------------------------------------------------------------
// Orders management
// ---------------------------------------------------------------------------
router.get('/orders', async (req, res) => {
  try {
    const { status, search } = req.query;
    const where = {};
    if (status && status !== 'ALL') where.status = status;
    if (search) {
      where.OR = [
        { id: { contains: search, mode: 'insensitive' } },
        { guestName: { contains: search, mode: 'insensitive' } },
        { user: { fullName: { contains: search, mode: 'insensitive' } } },
        { user: { email: { contains: search, mode: 'insensitive' } } },
      ];
    }
    const orders = await prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { items: true, user: true },
      take: 200,
    });
    res.json({ orders });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load orders' });
  }
});

router.get('/orders/:id', async (req, res) => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: {
        items: true,
        photos: true,
        review: true,
        events: { orderBy: { createdAt: 'asc' } },
        notifications: { orderBy: { createdAt: 'desc' } },
        user: true,
      },
    });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    res.json({ order });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load order' });
  }
});

router.patch('/orders/:id/status', async (req, res) => {
  try {
    const { status } = req.body || {};
    if (!ORDER_STATUSES.includes(status)) return res.status(400).json({ error: 'Invalid status' });
    const order = await applyStatus(req.params.id, status, `Status updated to ${status} by admin`);
    await audit(req, {
      action: 'ORDER_STATUS',
      entity: 'Order',
      entityId: req.params.id,
      detail: `Status set to ${status}`,
    });
    res.json({ order });
  } catch (err) {
    console.error(err);
    const code = err.status === 404 ? 404 : 500;
    res.status(code).json({ error: err.status === 404 ? 'Order not found' : 'Failed to update status' });
  }
});

// POST /api/admin/orders/:id/refund  { reason }
// Full refund only — see refundOrder() for why partial refunds stay in the
// Paystack dashboard. Refunds are recorded against the order and the customer is
// told by SMS, WhatsApp and email.
router.post('/orders/:id/refund', async (req, res) => {
  try {
    const { reason } = req.body || {};
    const order = await refundOrder(req.params.id, { reason });
    await audit(req, {
      action: 'ORDER_REFUND',
      entity: 'Order',
      entityId: req.params.id,
      detail: `Refunded GH₵ ${Number(order.refundAmount).toFixed(2)} via ${order.refundStatus}${reason ? ` — ${reason}` : ''}`,
    });
    res.json({ order });
  } catch (err) {
    console.error(err);
    res.status(err.status || 500).json({ error: err.message || 'Failed to refund this order' });
  }
});

// ---------------------------------------------------------------------------
// Customers
// ---------------------------------------------------------------------------
router.get('/customers', async (req, res) => {
  try {
    const customers = await prisma.user.findMany({
      where: { role: 'CUSTOMER' },
      orderBy: { createdAt: 'desc' },
      include: { orders: { select: { id: true, total: true, paymentStatus: true } } },
      take: 500,
    });
    const list = customers.map((c) => {
      const paid = c.orders.filter((o) => ['PAID', 'SIMULATED'].includes(o.paymentStatus));
      return {
        id: c.id,
        fullName: c.fullName,
        email: c.email,
        phone: c.phone,
        loyaltyPoints: c.loyaltyPoints,
        createdAt: c.createdAt,
        totalOrders: c.orders.length,
        totalSpent: Math.round(paid.reduce((s, o) => s + o.total, 0)),
      };
    });
    res.json({ customers: list });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load customers' });
  }
});

// ---------------------------------------------------------------------------
// Rider accounts — created here only; there is no rider self-signup
// ---------------------------------------------------------------------------
const RIDER_SELECT = {
  id: true,
  fullName: true,
  email: true,
  phone: true,
  active: true,
  createdAt: true,
};

router.get('/riders', async (req, res) => {
  try {
    const riders = await prisma.user.findMany({
      where: { role: 'RIDER' },
      orderBy: { createdAt: 'desc' },
      select: RIDER_SELECT,
    });
    // Live workload per rider, so the admin can see who is carrying what.
    const counts = await prisma.order.groupBy({
      by: ['riderId'],
      where: { status: 'OUT_FOR_DELIVERY', riderId: { not: null } },
      _count: { _all: true },
    });
    const activeMap = Object.fromEntries(counts.map((c) => [c.riderId, c._count._all]));
    res.json({ riders: riders.map((r) => ({ ...r, activeDeliveries: activeMap[r.id] || 0 })) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load riders' });
  }
});

router.post('/riders', async (req, res) => {
  try {
    const fullName = clean(req.body?.fullName, 80);
    const email = String(req.body?.email || '').toLowerCase().trim();
    const phone = clean(req.body?.phone, 30);
    const password = String(req.body?.password || '');

    if (!fullName || !email || !phone) {
      return res.status(400).json({ error: 'Name, email and phone are required' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      return res.status(400).json({ error: 'Please enter a valid email address' });
    }
    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
      return res.status(400).json({ error: 'Password must be at least 8 characters and include a letter and a number' });
    }
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(409).json({ error: 'An account with that email already exists' });

    const rider = await prisma.user.create({
      data: {
        fullName,
        email,
        phone,
        passwordHash: await bcrypt.hash(password, 12),
        role: 'RIDER',
        emailVerified: true, // created by an admin, so no verification email needed
      },
      select: RIDER_SELECT,
    });
    await audit(req, {
      action: 'RIDER_CREATE',
      entity: 'User',
      entityId: rider.id,
      detail: `Created rider ${rider.fullName} <${rider.email}>`,
    });
    res.status(201).json({ rider });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create rider' });
  }
});

// PATCH /api/admin/riders/:id  { active } — suspend or reinstate a rider
router.patch('/riders/:id', async (req, res) => {
  try {
    const active = req.body?.active === true || req.body?.active === 'true';
    const rider = await prisma.user.findFirst({ where: { id: req.params.id, role: 'RIDER' } });
    if (!rider) return res.status(404).json({ error: 'Rider not found' });
    const updated = await prisma.user.update({
      where: { id: rider.id },
      data: { active },
      select: RIDER_SELECT,
    });
    await audit(req, {
      action: active ? 'RIDER_REINSTATE' : 'RIDER_SUSPEND',
      entity: 'User',
      entityId: rider.id,
      detail: `${active ? 'Reinstated' : 'Suspended'} rider ${rider.fullName}`,
    });
    res.json({ rider: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update rider' });
  }
});

// ---------------------------------------------------------------------------
// Audit log — filterable record of privileged actions
// ---------------------------------------------------------------------------
router.get('/audit', async (req, res) => {
  try {
    const take = Math.min(200, Math.max(1, parseInt(req.query.limit || '100', 10)));
    const where = {};
    if (req.query.action) where.action = String(req.query.action);
    if (req.query.search) {
      const q = String(req.query.search).slice(0, 60);
      where.OR = [
        { actorEmail: { contains: q, mode: 'insensitive' } },
        { detail: { contains: q, mode: 'insensitive' } },
        { entityId: { contains: q, mode: 'insensitive' } },
      ];
    }
    const logs = await prisma.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, take });
    res.json({ logs });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load audit log' });
  }
});

// ---------------------------------------------------------------------------
// WhatsApp templates
// ---------------------------------------------------------------------------

// GET /api/admin/whatsapp/templates — the registry, with a rendered preview of each
// template so the bakery can see exactly what the customer receives.
router.get('/whatsapp/templates', async (req, res) => {
  try {
    const settings = await getSettings();
    res.json({
      ...describeTemplates({
        useTemplates: settings.whatsappTemplates !== false,
        language: settings.whatsappTemplateLanguage || 'en',
        enabled: config.whatsapp.enabled,
      }),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load WhatsApp templates' });
  }
});

// POST /api/admin/whatsapp/test  { phone, type }
// Proves a template is approved and the credentials work — before it matters.
router.post('/whatsapp/test', async (req, res) => {
  try {
    const { phone, type = 'ORDER_CONFIRMED' } = req.body || {};
    const result = await sendTemplateTest({ phone, type });
    if (result.ok) {
      await audit(req, {
        action: 'WHATSAPP_TEST',
        entity: 'Setting',
        detail: `Test template ${result.template} to ${result.to}${result.simulated ? ' (simulated)' : ''}`,
      });
    }
    res.status(result.ok ? 200 : 400).json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to send the test message' });
  }
});

// ---------------------------------------------------------------------------
// Review moderation
// ---------------------------------------------------------------------------
const REVIEW_STATUSES = ['PENDING', 'APPROVED', 'HIDDEN'];

// GET /api/admin/reviews?status=PENDING&search=&take=&skip=
router.get('/reviews', async (req, res) => {
  try {
    const { status = 'ALL', search = '', take = '50', skip = '0' } = req.query;
    const where = {};
    if (REVIEW_STATUSES.includes(status)) where.status = status;
    if (search.trim()) {
      const q = String(search).trim();
      where.OR = [
        { comment: { contains: q, mode: 'insensitive' } },
        { orderId: { contains: q, mode: 'insensitive' } },
        { user: { is: { fullName: { contains: q, mode: 'insensitive' } } } },
        { user: { is: { email: { contains: q, mode: 'insensitive' } } } },
      ];
    }

    const [reviews, counts] = await Promise.all([
      prisma.review.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: Math.min(parseInt(take, 10) || 50, 200),
        skip: parseInt(skip, 10) || 0,
        include: {
          user: { select: { id: true, fullName: true, email: true, phone: true } },
          order: { select: { id: true, total: true, createdAt: true } },
        },
      }),
      prisma.review.groupBy({ by: ['status'], _count: true }),
    ]);

    const summary = { PENDING: 0, APPROVED: 0, HIDDEN: 0, ALL: 0 };
    for (const row of counts) {
      summary[row.status] = row._count;
      summary.ALL += row._count;
    }

    // Anything waiting on the bakery floats to the top of the queue, newest first —
    // a review the customer is still excited about is best published while it's fresh.
    const order = { PENDING: 0, APPROVED: 1, HIDDEN: 2 };
    reviews.sort((a, b) => (order[a.status] ?? 3) - (order[b.status] ?? 3));
    res.json({ reviews, summary });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load reviews' });
  }
});

// PATCH /api/admin/reviews/:id  { status: PENDING | APPROVED | HIDDEN }
// Hiding keeps the row (and the customer's order history intact) while removing it
// from the storefront — that is the difference between moderating and deleting.
router.patch('/reviews/:id', async (req, res) => {
  try {
    const { status } = req.body || {};
    if (!REVIEW_STATUSES.includes(status)) {
      return res.status(400).json({ error: `Status must be one of ${REVIEW_STATUSES.join(', ')}` });
    }
    const existing = await prisma.review.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Review not found' });

    const review = await prisma.review.update({
      where: { id: req.params.id },
      data: {
        status,
        moderatedAt: new Date(),
        moderatedBy: req.user?.email || 'admin',
      },
      include: { user: { select: { fullName: true, email: true } } },
    });

    await audit(req, {
      action: 'REVIEW_MODERATE',
      entity: 'Review',
      entityId: review.id,
      detail: `${existing.status} → ${status} for order ${review.orderId}`,
    });
    res.json({ review });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update the review' });
  }
});

// ---------------------------------------------------------------------------
// Low-stock alerts
// ---------------------------------------------------------------------------
// GET /api/admin/alerts/low-stock — products at or below the reorder threshold
router.get('/alerts/low-stock', async (req, res) => {
  try {
    const settings = await getSettings();
    const products = await lowStockProducts(settings);
    res.json({ products, threshold: settings.lowStockThreshold ?? 5 });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to check stock' });
  }
});

// POST /api/admin/alerts/low-stock/send — email the digest now
router.post('/alerts/low-stock/send', async (req, res) => {
  try {
    const result = await sendLowStockDigest({ force: true });
    await audit(req, {
      action: 'STOCK_ALERT_SENT',
      entity: 'Product',
      detail: `Low-stock digest sent for ${result.count} product(s)`,
    });
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to send the stock digest' });
  }
});

// ---------------------------------------------------------------------------
// Printing — receipts (customer copy) and kitchen tickets
// ---------------------------------------------------------------------------

/**
 * GET /api/admin/orders/:id/print
 *
 * Gathers everything a printed document needs in one payload so the print view
 * doesn't fan out across several endpoints: the order with its items, design
 * photos, the customer, and the bakery's own details for the header.
 */
router.get('/orders/:id/print', async (req, res) => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: { items: true, photos: true, user: true },
    });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    const settings = await getSettings();
    res.json({
      order,
      business: {
        name: settings.businessName || 'Homely Treats',
        email: settings.businessEmail,
        phone: settings.businessPhone,
        address: settings.businessAddress,
      },
      printedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to prepare the printout' });
  }
});

// ---------------------------------------------------------------------------
// Products CRUD (+ size options)
// ---------------------------------------------------------------------------
const includeSizes = { include: { sizeOptions: { orderBy: { price: 'asc' } } } };

router.get('/products', async (req, res) => {
  const products = await prisma.product.findMany({ orderBy: { createdAt: 'asc' }, ...includeSizes });
  res.json({ products });
});

router.post('/products', async (req, res) => {
  try {
    const { name, description, category, basePrice, emoji, icon, badge, flavors, sizes, stock, inStock, featured, sizeOptions, images, imageAlt, leadDays } =
      req.body || {};
    if (!name || !category || basePrice === undefined) {
      return res.status(400).json({ error: 'Name, category and base price are required' });
    }
    const product = await prisma.product.create({
      data: {
        name: String(name).trim(),
        description: description || null,
        category,
        basePrice: Number(basePrice),
        emoji: icon || emoji || 'Cake',
        icon: icon || emoji || 'Cake',
        badge: badge || null,
        images: normalizeImages(images),
        imageAlt: imageAlt ? clean(imageAlt, 160) : null,
        flavors: Array.isArray(flavors) ? flavors : [],
        sizes: Array.isArray(sizes) ? sizes : [],
        stock: parseInt(stock || 0, 10),
        leadDays: normalizeLeadDays(leadDays),
        inStock: Boolean(inStock),
        featured: Boolean(featured),
        sizeOptions: {
          create: normalizeSizes(sizeOptions, Number(basePrice)),
        },
      },
      ...includeSizes,
    });
    await audit(req, {
      action: 'PRODUCT_CREATE',
      entity: 'Product',
      entityId: product.id,
      detail: `Created "${product.name}" at GH₵ ${product.basePrice}`,
    });
    res.status(201).json({ product });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create product' });
  }
});

router.put('/products/:id', async (req, res) => {
  try {
    const { name, description, category, basePrice, emoji, icon, badge, flavors, sizes, stock, inStock, featured, isActive, sizeOptions, images, imageAlt, leadDays } =
      req.body || {};
    const product = await prisma.product.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined && { name: String(name).trim() }),
        ...(description !== undefined && { description }),
        ...(category !== undefined && { category }),
        ...(basePrice !== undefined && { basePrice: Number(basePrice) }),
        ...((icon !== undefined || emoji !== undefined) && { icon: icon || emoji || 'Cake', emoji: icon || emoji || 'Cake' }),
        ...(images !== undefined && { images: normalizeImages(images) }),
        ...(imageAlt !== undefined && { imageAlt: imageAlt ? clean(imageAlt, 160) : null }),
        ...(badge !== undefined && { badge }),
        ...(flavors !== undefined && { flavors }),
        ...(sizes !== undefined && { sizes }),
        ...(stock !== undefined && { stock: parseInt(stock, 10) }),
        ...(leadDays !== undefined && { leadDays: normalizeLeadDays(leadDays) }),
        ...(inStock !== undefined && { inStock: Boolean(inStock) }),
        ...(featured !== undefined && { featured: Boolean(featured) }),
        ...(isActive !== undefined && { isActive: Boolean(isActive) }),
      },
      ...includeSizes,
    });
    if (sizeOptions !== undefined) {
      await prisma.productSize.deleteMany({ where: { productId: product.id } });
      await prisma.productSize.createMany({
        data: normalizeSizes(sizeOptions, product.basePrice).map((s) => ({ ...s, productId: product.id })),
      });
      const updated = await prisma.product.findUnique({ where: { id: product.id }, ...includeSizes });
      await audit(req, {
        action: 'PRODUCT_UPDATE',
        entity: 'Product',
        entityId: product.id,
        detail: `Updated "${product.name}" (price GH₵ ${product.basePrice}, stock ${product.stock})`,
      });
      return res.json({ product: updated });
    }
    await audit(req, {
      action: 'PRODUCT_UPDATE',
      entity: 'Product',
      entityId: product.id,
      detail: `Updated "${product.name}" (price GH₵ ${product.basePrice}, stock ${product.stock})`,
    });
    res.json({ product });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update product' });
  }
});

router.delete('/products/:id', async (req, res) => {
  try {
    const product = await prisma.product.update({
      where: { id: req.params.id },
      data: { isActive: false },
    });
    await audit(req, {
      action: 'PRODUCT_DELETE',
      entity: 'Product',
      entityId: product.id,
      detail: `De-listed "${product.name}"`,
    });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete product' });
  }
});

function normalizeSizes(sizeOptions, basePrice) {
  if (!Array.isArray(sizeOptions)) return [];
  return sizeOptions
    .filter((s) => s && s.label)
    .map((s) => ({
      label: String(s.label).trim(),
      serves: parseInt(s.serves || 1, 10),
      price: s.price !== undefined && s.price !== '' ? Number(s.price) : Number(basePrice),
    }));
}

// ---------------------------------------------------------------------------
// Promos CRUD
// ---------------------------------------------------------------------------
router.get('/promos', async (req, res) => {
  const promos = await prisma.promo.findMany({ orderBy: { createdAt: 'desc' } });
  res.json({ promos });
});

router.post('/promos', async (req, res) => {
  try {
    const {
      code,
      type = 'PERCENT',
      value,
      active = true,
      usageLimit,
      minSpend,
      perCustomerLimit,
      firstOrderOnly,
      expiresAt,
    } = req.body || {};
    if (!code || value === undefined) return res.status(400).json({ error: 'Code and value required' });
    if (!['PERCENT', 'FIXED'].includes(type)) return res.status(400).json({ error: 'Invalid discount type' });
    const num = Number(value);
    if (!Number.isFinite(num) || num <= 0) return res.status(400).json({ error: 'Discount value must be greater than zero' });
    if (type === 'PERCENT' && num > 100) return res.status(400).json({ error: 'Percentage discount cannot exceed 100%' });
    const promo = await prisma.promo.create({
      data: {
        code: String(code).toUpperCase().trim().slice(0, 32),
        type,
        value: num,
        active: Boolean(active),
        usageLimit: usageLimit ? parseInt(usageLimit, 10) : null,
        minSpend: minSpend ? Number(minSpend) : 0,
        perCustomerLimit: perCustomerLimit ? parseInt(perCustomerLimit, 10) : null,
        firstOrderOnly: Boolean(firstOrderOnly),
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      },
    });
    await audit(req, {
      action: 'PROMO_CREATE',
      entity: 'Promo',
      entityId: promo.id,
      detail: `Created promo ${promo.code} (${promo.type} ${promo.value})`,
    });
    res.status(201).json({ promo });
  } catch (err) {
    console.error(err);
    if (err.code === 'P2002') return res.status(409).json({ error: 'Promo code already exists' });
    res.status(500).json({ error: 'Failed to create promo' });
  }
});

router.delete('/promos/:id', async (req, res) => {
  try {
    const promo = await prisma.promo.delete({ where: { id: req.params.id } });
    await audit(req, {
      action: 'PROMO_DELETE',
      entity: 'Promo',
      entityId: promo.id,
      detail: `Deleted promo ${promo.code}`,
    });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(404).json({ error: 'Promo not found' });
  }
});

// ---------------------------------------------------------------------------
// Delivery zones CRUD
// ---------------------------------------------------------------------------
router.get('/zones', async (req, res) => {
  try {
    const zones = await prisma.deliveryZone.findMany({ orderBy: { name: 'asc' } });
    res.json({ zones });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load zones' });
  }
});

/** Numeric or null — an empty threshold field means "no rule", not zero. */
const optionalNumber = (v) => {
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

router.post('/zones', async (req, res) => {
  try {
    const { name, fee, minOrder, freeOver, etaNote } = req.body || {};
    if (!name || !String(name).trim()) return res.status(400).json({ error: 'Zone name is required' });
    const zone = await prisma.deliveryZone.create({
      data: {
        name: String(name).trim().slice(0, 60),
        fee: Number(fee) || 0,
        minOrder: optionalNumber(minOrder),
        freeOver: optionalNumber(freeOver),
        etaNote: etaNote ? String(etaNote).slice(0, 80) : null,
      },
    });
    await audit(req, { action: 'ZONE_CREATE', entity: 'DeliveryZone', entityId: zone.id, detail: zone.name });
    res.status(201).json({ zone });
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'A zone with that name already exists' });
    console.error(err);
    res.status(500).json({ error: 'Failed to create zone' });
  }
});

router.put('/zones/:id', async (req, res) => {
  try {
    const { name, fee, active, minOrder, freeOver, etaNote } = req.body || {};
    const zone = await prisma.deliveryZone.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined && { name: String(name).trim().slice(0, 60) }),
        ...(fee !== undefined && { fee: Number(fee) || 0 }),
        ...(active !== undefined && { active: !!active }),
        ...(minOrder !== undefined && { minOrder: optionalNumber(minOrder) }),
        ...(freeOver !== undefined && { freeOver: optionalNumber(freeOver) }),
        ...(etaNote !== undefined && { etaNote: etaNote ? String(etaNote).slice(0, 80) : null }),
      },
    });
    await audit(req, {
      action: 'ZONE_UPDATE',
      entity: 'DeliveryZone',
      entityId: zone.id,
      detail: `${zone.name} — fee ${zone.fee}${zone.minOrder != null ? `, min ${zone.minOrder}` : ''}${zone.freeOver != null ? `, free over ${zone.freeOver}` : ''}`,
    });
    res.json({ zone });
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'A zone with that name already exists' });
    console.error(err);
    res.status(500).json({ error: 'Failed to update zone' });
  }
});

router.delete('/zones/:id', async (req, res) => {
  try {
    const used = await prisma.order.count({ where: { deliveryZone: (await prisma.deliveryZone.findUnique({ where: { id: req.params.id } }))?.name || '__none__' } });
    // Deleting a zone that has delivered orders would orphan the history, so de-list it.
    if (used > 0) {
      const zone = await prisma.deliveryZone.update({ where: { id: req.params.id }, data: { active: false } });
      await audit(req, { action: 'ZONE_DEACTIVATE', entity: 'DeliveryZone', entityId: zone.id, detail: `${zone.name} (${used} past orders)` });
      return res.json({ ok: true, deactivated: true, zone, pastOrders: used });
    }
    await prisma.deliveryZone.delete({ where: { id: req.params.id } });
    await audit(req, { action: 'ZONE_DELETE', entity: 'DeliveryZone', entityId: req.params.id });
    res.json({ ok: true, deactivated: false });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to remove zone' });
  }
});

// ---------------------------------------------------------------------------
// Pickup counters
// ---------------------------------------------------------------------------
router.get('/pickup-locations', async (req, res) => {
  try {
    const locations = await prisma.pickupLocation.findMany({
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    });
    res.json({ locations });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load pickup locations' });
  }
});

router.post('/pickup-locations', async (req, res) => {
  try {
    const { name, address, phone, hours, isDefault } = req.body || {};
    if (!name || !address) return res.status(400).json({ error: 'Name and address are required' });
    // Only one counter can be the default; the checkout preselects it.
    if (isDefault) await prisma.pickupLocation.updateMany({ data: { isDefault: false } });
    const location = await prisma.pickupLocation.create({
      data: {
        name: String(name).trim().slice(0, 80),
        address: String(address).trim().slice(0, 200),
        phone: phone ? String(phone).slice(0, 30) : null,
        hours: hours ? String(hours).slice(0, 80) : null,
        isDefault: !!isDefault,
      },
    });
    await audit(req, { action: 'PICKUP_CREATE', entity: 'PickupLocation', entityId: location.id, detail: location.name });
    res.status(201).json({ location });
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'A counter with that name already exists' });
    console.error(err);
    res.status(500).json({ error: 'Failed to create the pickup location' });
  }
});

router.put('/pickup-locations/:id', async (req, res) => {
  try {
    const { name, address, phone, hours, active, isDefault } = req.body || {};
    if (isDefault) await prisma.pickupLocation.updateMany({ data: { isDefault: false } });
    const location = await prisma.pickupLocation.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined && { name: String(name).trim().slice(0, 80) }),
        ...(address !== undefined && { address: String(address).trim().slice(0, 200) }),
        ...(phone !== undefined && { phone: phone ? String(phone).slice(0, 30) : null }),
        ...(hours !== undefined && { hours: hours ? String(hours).slice(0, 80) : null }),
        ...(active !== undefined && { active: !!active }),
        ...(isDefault !== undefined && { isDefault: !!isDefault }),
      },
    });
    await audit(req, { action: 'PICKUP_UPDATE', entity: 'PickupLocation', entityId: location.id, detail: location.name });
    res.json({ location });
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'A counter with that name already exists' });
    console.error(err);
    res.status(500).json({ error: 'Failed to update the pickup location' });
  }
});

router.delete('/pickup-locations/:id', async (req, res) => {
  try {
    await prisma.pickupLocation.delete({ where: { id: req.params.id } });
    await audit(req, { action: 'PICKUP_DELETE', entity: 'PickupLocation', entityId: req.params.id });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to remove the pickup location' });
  }
});

// ---------------------------------------------------------------------------
// Collection / delivery windows
// ---------------------------------------------------------------------------
router.get('/time-slots', async (req, res) => {
  try {
    const slots = await prisma.timeSlot.findMany({ orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }] });
    res.json({ slots });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load time slots' });
  }
});

router.post('/time-slots', async (req, res) => {
  try {
    const { label, capacity = 6, sortOrder = 0 } = req.body || {};
    if (!label || !String(label).trim()) return res.status(400).json({ error: 'A slot label is required' });
    const slot = await prisma.timeSlot.create({
      data: {
        label: String(label).trim().slice(0, 40),
        capacity: Math.max(1, Math.min(200, parseInt(capacity, 10) || 6)),
        sortOrder: parseInt(sortOrder, 10) || 0,
      },
    });
    await audit(req, { action: 'SLOT_CREATE', entity: 'TimeSlot', entityId: slot.id, detail: `${slot.label} (${slot.capacity}/day)` });
    res.status(201).json({ slot });
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'A slot with that label already exists' });
    console.error(err);
    res.status(500).json({ error: 'Failed to create the time slot' });
  }
});

router.put('/time-slots/:id', async (req, res) => {
  try {
    const { label, capacity, active, sortOrder } = req.body || {};
    const slot = await prisma.timeSlot.update({
      where: { id: req.params.id },
      data: {
        ...(label !== undefined && { label: String(label).trim().slice(0, 40) }),
        ...(capacity !== undefined && { capacity: Math.max(1, Math.min(200, parseInt(capacity, 10) || 1)) }),
        ...(active !== undefined && { active: !!active }),
        ...(sortOrder !== undefined && { sortOrder: parseInt(sortOrder, 10) || 0 }),
      },
    });
    await audit(req, { action: 'SLOT_UPDATE', entity: 'TimeSlot', entityId: slot.id, detail: `${slot.label} (${slot.capacity}/day, ${slot.active ? 'active' : 'off'})` });
    res.json({ slot });
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'A slot with that label already exists' });
    console.error(err);
    res.status(500).json({ error: 'Failed to update the time slot' });
  }
});

router.delete('/time-slots/:id', async (req, res) => {
  try {
    await prisma.timeSlot.delete({ where: { id: req.params.id } });
    await audit(req, { action: 'SLOT_DELETE', entity: 'TimeSlot', entityId: req.params.id });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to remove the time slot' });
  }
});

// ---------------------------------------------------------------------------
// Closed days
// ---------------------------------------------------------------------------
router.get('/blackouts', async (req, res) => {
  try {
    const blackouts = await prisma.blackoutDate.findMany({ orderBy: { date: 'asc' } });
    res.json({ blackouts });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load closed days' });
  }
});

router.post('/blackouts', async (req, res) => {
  try {
    const { date, reason } = req.body || {};
    if (!date) return res.status(400).json({ error: 'A date is required' });
    const d = new Date(date);
    if (Number.isNaN(d.getTime())) return res.status(400).json({ error: 'That date could not be understood' });
    const key = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    const blackout = await prisma.blackoutDate.create({
      data: { date: key, reason: reason ? String(reason).slice(0, 120) : null },
    });
    await audit(req, { action: 'BLACKOUT_CREATE', entity: 'BlackoutDate', entityId: blackout.id, detail: `${BlackoutLabel(blackout)}` });
    res.status(201).json({ blackout });
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'That day is already closed' });
    console.error(err);
    res.status(500).json({ error: 'Failed to close that day' });
  }
});

router.delete('/blackouts/:id', async (req, res) => {
  try {
    await prisma.blackoutDate.delete({ where: { id: req.params.id } });
    await audit(req, { action: 'BLACKOUT_DELETE', entity: 'BlackoutDate', entityId: req.params.id });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to reopen that day' });
  }
});

function BlackoutLabel(b) {
  return `${new Date(b.date).toISOString().slice(0, 10)}${b.reason ? ` — ${b.reason}` : ''}`;
}

// ---------------------------------------------------------------------------
// Delivery calendar — what the kitchen has already promised
// ---------------------------------------------------------------------------
router.get('/delivery-calendar', async (req, res) => {
  try {
    const days = Math.max(1, Math.min(60, parseInt(req.query.days, 10) || 14));
    const from = new Date();
    from.setHours(0, 0, 0, 0);
    const to = new Date(from.getTime() + days * 86400000);
    const [slots, orders, blackouts] = await Promise.all([
      prisma.timeSlot.findMany({ where: { active: true }, orderBy: { sortOrder: 'asc' } }),
      prisma.order.findMany({
        where: { readyDate: { gte: from, lt: to }, status: { not: 'CANCELLED' } },
        select: { readyDate: true, timeSlot: true, total: true, status: true },
      }),
      prisma.blackoutDate.findMany({ where: { date: { gte: from, lt: to } } }),
    ]);

    const calendar = [];
    for (let i = 0; i < days; i++) {
      const day = new Date(from.getTime() + i * 86400000);
      const key = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate()));
      const dayOrders = orders.filter((o) => {
        if (!o.readyDate) return false;
        const d = new Date(o.readyDate);
        return (
          Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) === key.getTime()
        );
      });
      const closed = blackouts.find((b) => {
        const d = new Date(b.date);
        return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) === key.getTime();
      });
      calendar.push({
        date: key.toISOString().slice(0, 10),
        closed: !!closed,
        closedReason: closed?.reason || null,
        orders: dayOrders.length,
        value: Math.round(dayOrders.reduce((s, o) => s + o.total, 0) * 100) / 100,
        slots: slots.map((s) => {
          const booked = dayOrders.filter((o) => o.timeSlot === s.label).length;
          return { label: s.label, booked, capacity: s.capacity, remaining: Math.max(0, s.capacity - booked) };
        }),
      });
    }
    res.json({ calendar, days });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to build the delivery calendar' });
  }
});

// ---------------------------------------------------------------------------
function parseRange(query) {
  const from = query.from ? new Date(query.from) : null;
  const to = query.to ? new Date(query.to) : null;
  if (to) to.setHours(23, 59, 59, 999);
  return { from, to };
}

router.get('/reports', async (req, res) => {
  try {
    const { from, to } = parseRange(req.query);
    const where = {
      createdAt: {
        ...(from && { gte: from }),
        ...(to && { lte: to }),
      },
    };
    const orders = await prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { items: true, user: true },
    });
    const paid = orders.filter((o) => ['PAID', 'SIMULATED'].includes(o.paymentStatus));
    const revenue = Math.round(paid.reduce((s, o) => s + o.total, 0) * 100) / 100;
    // Refunded orders are excluded from `paid` above, so they never inflate revenue —
    // they are reported separately so the owner can see what was paid back.
    const refunded = orders.filter((o) => o.paymentStatus === 'REFUNDED');
    const refundTotal = Math.round(refunded.reduce((s, o) => s + (o.refundAmount || o.total), 0) * 100) / 100;
    const itemRows = await prisma.orderItem.findMany({
      where: { order: where },
      include: { product: true },
    });
    const topMap = {};
    for (const it of itemRows) {
      topMap[it.name] = topMap[it.name] || { name: it.name, qty: 0, revenue: 0 };
      topMap[it.name].qty += it.quantity;
      topMap[it.name].revenue += it.price * it.quantity;
    }
    const topProducts = Object.values(topMap).sort((a, b) => b.revenue - a.revenue).slice(0, 10);
    res.json({
      revenue,
      refunds: { count: refunded.length, total: refundTotal },
      orderCount: orders.length,
      avgOrderValue: orders.length ? Math.round((revenue / orders.length) * 100) / 100 : 0,
      topProducts: topProducts.map((t) => ({ ...t, revenue: Math.round(t.revenue * 100) / 100 })),
      orders,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to build report' });
  }
});

router.get('/reports/export', async (req, res) => {
  try {
    const { from, to } = parseRange(req.query);
    const orders = await prisma.order.findMany({
      where: {
        createdAt: {
          ...(from && { gte: from }),
          ...(to && { lte: to }),
        },
      },
      orderBy: { createdAt: 'asc' },
      include: { items: true, user: true },
    });

    const esc = (v) => {
      const s = v === null || v === undefined ? '' : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const header = [
      'Order ID', 'Date', 'Customer', 'Email', 'Phone', 'Items', 'Delivery Method',
      'Zone', 'Rider', 'Status', 'Payment Status', 'Payment Method', 'Subtotal',
      'Discount', 'Loyalty Discount', 'Delivery Fee', 'Total',
    ];
    const lines = [header.join(',')];
    for (const o of orders) {
      lines.push(
        [
          o.id,
          o.createdAt.toISOString(),
          o.user?.fullName || o.guestName || 'Guest',
          o.user?.email || o.guestEmail || '',
          o.user?.phone || o.guestPhone || '',
          o.items.map((i) => `${i.name} x${i.quantity}`).join(' | '),
          o.deliveryMethod,
          o.deliveryZone || '',
          o.riderName || '',
          o.status,
          o.paymentStatus,
          o.paymentMethod,
          o.subtotal,
          o.discount,
          o.loyaltyDiscount,
          o.deliveryFee,
          o.total,
        ].map(esc).join(',')
      );
    }
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="homely-treats-sales-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send('\uFEFF' + lines.join('\n'));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to export report' });
  }
});

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------
router.get('/settings', async (req, res) => {
  const settings = await getSettings();
  res.json({ settings });
});

router.put('/settings', async (req, res) => {
  const settings = await saveSettings(req.body || {});
  await audit(req, {
    action: 'SETTINGS_UPDATE',
    entity: 'Setting',
    entityId: null,
    detail: `Updated keys: ${Object.keys(req.body || {}).slice(0, 12).join(', ')}`,
  });
  res.json({ settings });
});

export default router;
