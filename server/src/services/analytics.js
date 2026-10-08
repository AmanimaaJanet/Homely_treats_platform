/**
 * Sales analytics.
 *
 * One pass over the orders and line items the reports route has already loaded, so the
 * deeper answers ("which zone carries the revenue?", "are customers coming back?",
 * "which day of the week is busiest?") cost nothing extra beyond grouping.
 *
 * Two conventions worth knowing:
 *  - Revenue counts only orders the shop actually got paid for (PAID / SIMULATED).
 *    Refunded orders are excluded upstream, which is why a refund lowers revenue with
 *    no separate subtraction anywhere.
 *  - "Demand" blocks (how many orders arrived, which window people chose) count every
 *    order including cancelled ones — the kitchen still had to plan for them.
 */

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const utcDay = (d) => new Date(Date.UTC(new Date(d).getUTCFullYear(), new Date(d).getUTCMonth(), new Date(d).getUTCDate()));
const monthKey = (d) => `${new Date(d).getUTCFullYear()}-${String(new Date(d).getUTCMonth() + 1).padStart(2, '0')}`;

/** The customer a report line belongs to, whether they signed in or checked out as a guest. */
export function customerKey(order) {
  if (order.userId) return `user:${order.userId}`;
  const email = (order.guestEmail || '').trim().toLowerCase();
  const phone = (order.guestPhone || '').replace(/\D/g, '');
  if (email) return `email:${email}`;
  if (phone) return `phone:${phone}`;
  return `anon:${order.id}`;
}

export function buildAnalytics({ orders, itemRows, months = 12 }) {
  const paid = orders.filter((o) => ['PAID', 'SIMULATED'].includes(o.paymentStatus));

  // ---- revenue by day, across whichever range was asked for
  const dayMap = new Map();
  for (const o of orders) {
    const key = utcDay(o.createdAt).toISOString().slice(0, 10);
    const row = dayMap.get(key) || { date: key, orders: 0, revenue: 0, cancelled: 0 };
    row.orders++;
    if (o.status === 'CANCELLED') row.cancelled++;
    if (['PAID', 'SIMULATED'].includes(o.paymentStatus)) row.revenue = round2(row.revenue + o.total);
    dayMap.set(key, row);
  }
  const byDay = [...dayMap.values()].sort((a, b) => (a.date < b.date ? -1 : 1));

  // ---- delivery zones: which parts of Accra are worth the trip
  const zoneMap = new Map();
  for (const o of orders) {
    const zone = o.deliveryMethod === 'DELIVERY' ? o.deliveryZone || 'Unzoned delivery' : 'Collection';
    const row = zoneMap.get(zone) || { zone, orders: 0, revenue: 0, fees: 0 };
    row.orders++;
    if (['PAID', 'SIMULATED'].includes(o.paymentStatus)) {
      row.revenue = round2(row.revenue + o.total);
      row.fees = round2(row.fees + (o.deliveryFee || 0));
    }
    zoneMap.set(zone, row);
  }
  const byZone = [...zoneMap.values()]
    .map((z) => ({ ...z, avg: z.orders ? round2(z.revenue / z.orders) : 0 }))
    .sort((a, b) => b.revenue - a.revenue);

  // ---- payments: is the mobile-money habit holding, or are people still choosing cash?
  const methodLabels = { MOMO: 'Mobile Money', ATL: 'AirtelTigo Money', CARD: 'Card', COD: 'Cash on delivery' };
  const payMap = new Map();
  for (const o of orders) {
    const method = methodLabels[o.paymentMethod] || o.paymentMethod || 'Unknown';
    const row = payMap.get(method) || { method, orders: 0, revenue: 0 };
    row.orders++;
    if (['PAID', 'SIMULATED'].includes(o.paymentStatus)) row.revenue = round2(row.revenue + o.total);
    payMap.set(method, row);
  }

  // ---- weekday rhythm and the windows people pick
  const weekday = WEEKDAYS.map((name) => ({ weekday: name, orders: 0, revenue: 0 }));
  for (const o of orders) {
    const row = weekday[new Date(o.createdAt).getUTCDay()];
    row.orders++;
    if (['PAID', 'SIMULATED'].includes(o.paymentStatus)) row.revenue = round2(row.revenue + o.total);
  }

  const slotMap = new Map();
  for (const o of orders) {
    if (!o.timeSlot) continue;
    const row = slotMap.get(o.timeSlot) || { slot: o.timeSlot, orders: 0 };
    row.orders++;
    slotMap.set(o.timeSlot, row);
  }
  const bySlot = [...slotMap.values()].sort((a, b) => b.orders - a.orders);

  // ---- which branch carries the shop? (orders record the fulfilling branch by name;
  // orders from before branches existed show as the unlabelled row) ----
  const branchMap = new Map();
  for (const o of orders) {
    const label = o.pickupLocation || 'Not recorded';
    const row = branchMap.get(label) || { branch: label, orders: 0, revenue: 0 };
    row.orders += 1;
    if (['PAID', 'SIMULATED'].includes(o.paymentStatus)) row.revenue += o.total;
    branchMap.set(label, row);
  }
  const byBranch = [...branchMap.values()].sort((a, b) => b.revenue - a.revenue);

  // ---- do customers come back? One order is a customer; two is a business.
  const customerOrders = new Map();
  for (const o of orders) {
    const key = customerKey(o);
    customerOrders.set(key, (customerOrders.get(key) || 0) + 1);
  }
  const repeatCustomers = [...customerOrders.values()].filter((n) => n > 1).length;
  const customers = customerOrders.size;
  const repeat = {
    customers,
    repeatCustomers,
    oneTimeCustomers: customers - repeatCustomers,
    repeatRate: customers ? Math.round((repeatCustomers / customers) * 1000) / 10 : 0,
  };

  // ---- status mix: how much of the book gets cancelled
  const statusMap = new Map();
  for (const o of orders) statusMap.set(o.status, (statusMap.get(o.status) || 0) + 1);
  const byStatus = [...statusMap.entries()].map(([status, count]) => ({ status, count }));

  // ---- 12-month trend (independent of the chosen range: this is the long view)
  const trendFrom = new Date();
  trendFrom.setUTCMonth(trendFrom.getUTCMonth() - (months - 1), 1);
  trendFrom.setUTCHours(0, 0, 0, 0);

  // ---- products: what sells, and how its month-to-month shape looks
  const productMap = new Map();
  let itemRevenue = 0;
  for (const it of itemRows) {
    const row = productMap.get(it.name) || {
      name: it.name,
      qty: 0,
      revenue: 0,
      orders: new Set(),
      months: {},
    };
    row.qty += it.quantity;
    row.revenue = round2(row.revenue + it.price * it.quantity);
    row.orders.add(it.orderId);
    const mk = monthKey(it.order?.createdAt || it.createdAt);
    row.months[mk] = (row.months[mk] || 0) + it.quantity;
    itemRevenue = round2(itemRevenue + it.price * it.quantity);
    productMap.set(it.name, row);
  }
  const products = [...productMap.values()]
    .map((p) => ({
      name: p.name,
      qty: p.qty,
      revenue: p.revenue,
      orders: p.orders.size,
      share: itemRevenue ? Math.round((p.revenue / itemRevenue) * 1000) / 10 : 0,
      months: p.months,
    }))
    .sort((a, b) => b.revenue - a.revenue);

  return {
    byDay,
    byZone,
    byPayment: [...payMap.values()].sort((a, b) => b.orders - a.orders),
    byWeekday: weekday,
    bySlot,
    byBranch,
    byStatus,
    repeat,
    products,
    trendFrom: trendFrom.toISOString(),
    totals: {
      itemRevenue,
      paidOrders: paid.length,
      cancelled: orders.filter((o) => o.status === 'CANCELLED').length,
      avgOrderValue: paid.length ? round2(paid.reduce((s, o) => s + o.total, 0) / paid.length) : 0,
      deliveryFees: round2(paid.reduce((s, o) => s + (o.deliveryFee || 0), 0)),
      discountGiven: round2(paid.reduce((s, o) => s + (o.discount || 0) + (o.loyaltyDiscount || 0), 0)),
    },
  };
}

/**
 * Long-view monthly trend for the dashboard and the reports header.
 * Kept separate because it needs its own (wider) date window than the report range.
 */
export async function monthlyTrend(prisma, months = 8) {
  const from = new Date();
  from.setUTCMonth(from.getUTCMonth() - (months - 1), 1);
  from.setUTCHours(0, 0, 0, 0);

  const orders = await prisma.order.findMany({
    where: { createdAt: { gte: from } },
    select: { createdAt: true, total: true, paymentStatus: true },
  });

  const buckets = new Map();
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date();
    d.setUTCMonth(d.getUTCMonth() - i, 1);
    buckets.set(monthKey(d), {
      month: d.toLocaleString('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' }),
      key: monthKey(d),
      revenue: 0,
      orders: 0,
    });
  }

  for (const o of orders) {
    const row = buckets.get(monthKey(o.createdAt));
    if (!row) continue;
    row.orders++;
    if (['PAID', 'SIMULATED'].includes(o.paymentStatus)) row.revenue = round2(row.revenue + o.total);
  }

  return [...buckets.values()];
}
