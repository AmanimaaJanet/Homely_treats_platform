import { Router } from 'express';
import { prisma } from '../prisma.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { applyStatus } from '../services/orderEvents.js';
import { getSettings, saveSettings } from '../services/settings.js';
import { ORDER_STATUSES } from '../config.js';

const router = Router();

router.use(requireAuth, requireAdmin);

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
    res.json({ order });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Failed to update status' });
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
      return res.json({ product: updated });
    }
    res.json({ product });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update product' });
  }
});

router.delete('/products/:id', async (req, res) => {
  try {
    await prisma.product.update({ where: { id: req.params.id }, data: { isActive: false } });
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
    const { code, type = 'PERCENT', value, active = true, usageLimit } = req.body || {};
    if (!code || value === undefined) return res.status(400).json({ error: 'Code and value required' });
    const promo = await prisma.promo.create({
      data: {
        code: String(code).toUpperCase().trim(),
        type,
        value: Number(value),
        active: Boolean(active),
        usageLimit: usageLimit ? parseInt(usageLimit, 10) : null,
      },
    });
    res.status(201).json({ promo });
  } catch (err) {
    console.error(err);
    if (err.code === 'P2002') return res.status(409).json({ error: 'Promo code already exists' });
    res.status(500).json({ error: 'Failed to create promo' });
  }
});

router.delete('/promos/:id', async (req, res) => {
  await prisma.promo.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
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
  res.json({ settings });
});

export default router;
