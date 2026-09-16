import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../prisma.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { applyStatus } from '../services/orderEvents.js';
import { getSettings, saveSettings } from '../services/settings.js';
import { audit } from '../services/audit.js';
import { ORDER_STATUSES } from '../config.js';

const router = Router();

router.use(requireAuth, requireAdmin);

/** Trim a user-supplied string and cap its length (defensive against junk payloads). */
function clean(value, maxLen = 200) {
  if (value === undefined || value === null) return '';
  return String(value).trim().slice(0, maxLen);
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
// Products CRUD (+ size options)
// ---------------------------------------------------------------------------
const includeSizes = { include: { sizeOptions: { orderBy: { price: 'asc' } } } };

router.get('/products', async (req, res) => {
  const products = await prisma.product.findMany({ orderBy: { createdAt: 'asc' }, ...includeSizes });
  res.json({ products });
});

router.post('/products', async (req, res) => {
  try {
    const { name, description, category, basePrice, emoji, icon, badge, flavors, sizes, stock, inStock, featured, sizeOptions } =
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
        flavors: Array.isArray(flavors) ? flavors : [],
        sizes: Array.isArray(sizes) ? sizes : [],
        stock: parseInt(stock || 0, 10),
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
    const { name, description, category, basePrice, emoji, icon, badge, flavors, sizes, stock, inStock, featured, isActive, sizeOptions } =
      req.body || {};
    const product = await prisma.product.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined && { name: String(name).trim() }),
        ...(description !== undefined && { description }),
        ...(category !== undefined && { category }),
        ...(basePrice !== undefined && { basePrice: Number(basePrice) }),
        ...((icon !== undefined || emoji !== undefined) && { icon: icon || emoji || 'Cake', emoji: icon || emoji || 'Cake' }),
        ...(badge !== undefined && { badge }),
        ...(flavors !== undefined && { flavors }),
        ...(sizes !== undefined && { sizes }),
        ...(stock !== undefined && { stock: parseInt(stock, 10) }),
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
  const zones = await prisma.deliveryZone.findMany({ orderBy: { name: 'asc' } });
  res.json({ zones });
});

router.post('/zones', async (req, res) => {
  try {
    const { name, fee, active = true } = req.body || {};
    if (!name) return res.status(400).json({ error: 'Zone name is required' });
    const zone = await prisma.deliveryZone.create({
      data: { name: String(name).trim(), fee: Number(fee || 0), active: Boolean(active) },
    });
    res.status(201).json({ zone });
  } catch (err) {
    console.error(err);
    if (err.code === 'P2002') return res.status(409).json({ error: 'Zone already exists' });
    res.status(500).json({ error: 'Failed to create zone' });
  }
});

router.put('/zones/:id', async (req, res) => {
  try {
    const { name, fee, active } = req.body || {};
    const zone = await prisma.deliveryZone.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined && { name: String(name).trim() }),
        ...(fee !== undefined && { fee: Number(fee) }),
        ...(active !== undefined && { active: Boolean(active) }),
      },
    });
    res.json({ zone });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update zone' });
  }
});

router.delete('/zones/:id', async (req, res) => {
  await prisma.deliveryZone.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Sales reports + CSV export
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
