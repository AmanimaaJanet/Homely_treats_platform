import { prisma } from '../prisma.js';
import { getSettings } from './settings.js';

/**
 * Delivery and collection rules — one place that knows what a bakery will and will
 * not accept, so checkout, the storefront and the admin API can't drift apart.
 *
 * It governs:
 *   • zones      — fee, minimum basket, free-over threshold, delivery note
 *   • pickup     — one or more counters to collect from
 *   • slots      — collection/delivery windows with a per-day capacity
 *   • blackouts  — days the bakery is shut
 *   • lead time  — shop-wide notice, tightened per product when a cake needs longer
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/** Midnight-to-midnight key used for slot capacity and blackout comparisons. */
export function dayKey(date) {
  const d = new Date(date);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

/**
 * Everything checkout needs to render the delivery step for a given date.
 * `date` is optional (ISO string); without it the soonest workable day is assumed.
 */
export async function deliveryOptions({ date } = {}) {
  const settings = await getSettings();
  const [zones, pickupLocations, slots, blackouts] = await Promise.all([
    prisma.deliveryZone.findMany({ where: { active: true }, orderBy: { name: 'asc' } }),
    prisma.pickupLocation.findMany({ where: { active: true }, orderBy: [{ isDefault: 'desc' }, { name: 'asc' }] }),
    prisma.timeSlot.findMany({ where: { active: true }, orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }] }),
    prisma.blackoutDate.findMany({ orderBy: { date: 'asc' } }),
  ]);

  const target = date ? new Date(date) : null;
  const key = target && !Number.isNaN(target.getTime()) ? dayKey(target) : null;

  let slotsWithCapacity = slots.map((s) => ({ ...s, booked: 0, remaining: s.capacity }));
  let blackout = null;

  if (key) {
    blackout = blackouts.find((b) => dayKey(b.date).getTime() === key.getTime()) || null;
    if (!blackout && slots.length) {
      const booked = await prisma.order.groupBy({
        by: ['timeSlot'],
        where: {
          readyDate: { gte: key, lt: new Date(key.getTime() + DAY_MS) },
          timeSlot: { not: null },
          status: { not: 'CANCELLED' },
        },
        _count: true,
      });
      const bookedMap = Object.fromEntries(booked.map((b) => [b.timeSlot, b._count]));
      slotsWithCapacity = slots.map((s) => {
        const used = bookedMap[s.label] || 0;
        return { ...s, booked: used, remaining: Math.max(0, s.capacity - used) };
      });
    }
  }

  return {
    minLeadDays: settings.minLeadDays ?? 2,
    allowPickup: settings.allowPickup !== false,
    defaultDeliveryFee: Number(settings.deliveryFee || 0),
    zones: zones.map((z) => ({
      id: z.id,
      name: z.name,
      fee: Number(z.fee || 0),
      minOrder: z.minOrder ?? null,
      freeOver: z.freeOver ?? null,
      etaNote: z.etaNote || null,
    })),
    pickupLocations: pickupLocations.length
      ? pickupLocations
      : [
          {
            // Fall back to the business address so an existing single-branch install
            // keeps working without a migration step.
            id: 'default',
            name: settings.businessName || 'Homely Treats',
            address: settings.businessAddress || '',
            phone: settings.businessPhone || '',
            hours: null,
            isDefault: true,
          },
        ],
    slots: slotsWithCapacity,
    date: key ? key.toISOString().slice(0, 10) : null,
    blackout: blackout ? { date: dayKey(blackout.date).toISOString().slice(0, 10), reason: blackout.reason } : null,
    blackoutDates: blackouts.map((b) => ({
      date: dayKey(b.date).toISOString().slice(0, 10),
      reason: b.reason || null,
    })),
  };
}

/**
 * Validate a requested collection/delivery slot. Returns an error string, or null.
 * Called inside order creation so a stale browser tab can't book a full window.
 */
export async function validateSlot({ readyDate, timeSlot }) {
  if (!timeSlot) return null; // a window is optional — the date alone is still valid

  const slots = await prisma.timeSlot.findMany({ where: { active: true } });
  if (!slots.length) return null; // no windows configured means "any time that day"

  const slot = slots.find((s) => s.label === String(timeSlot));
  if (!slot) return { error: 'That collection time is no longer available. Please pick another.' };

  if (!readyDate) return { error: 'Please choose a date for that time slot' };

  const key = dayKey(readyDate);
  const booked = await prisma.order.count({
    where: {
      readyDate: { gte: key, lt: new Date(key.getTime() + DAY_MS) },
      timeSlot: slot.label,
      status: { not: 'CANCELLED' },
    },
  });
  if (booked >= slot.capacity) {
    return {
      error: `The ${slot.label} ${'slot'} is fully booked for that day. Please choose another time.`,
    };
  }
  return null;
}

/** Is the bakery shut that day? Returns the blackout row or null. */
export async function blackoutFor(readyDate) {
  if (!readyDate) return null;
  const key = dayKey(readyDate);
  return prisma.blackoutDate.findFirst({
    where: { date: { gte: key, lt: new Date(key.getTime() + DAY_MS) } },
  });
}

/**
 * The notice a basket needs: the shop-wide lead time, raised by the pickiest product
 * with its own `leadDays`.
 */
export async function requiredLeadDays(productIds = []) {
  const settings = await getSettings();
  const base = Number(settings.minLeadDays ?? 2);
  if (!productIds.length) return base;
  const rows = await prisma.product.findMany({
    where: { id: { in: productIds }, leadDays: { not: null } },
    select: { leadDays: true, name: true },
    orderBy: { leadDays: 'desc' },
    take: 1,
  });
  const strictest = rows[0];
  return strictest && strictest.leadDays > base ? Number(strictest.leadDays) : base;
}

/** Earliest acceptable ready date (midnight) for a set of products. */
export async function earliestReadyDate(productIds = []) {
  const days = await requiredLeadDays(productIds);
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Apply a zone's trading rules to a basket.
 * Returns { fee, waived, error } — an error means we won't deliver there at all.
 */
export function applyZoneRules(zone, subtotal) {
  const fee = round2(zone.fee || 0);
  const minOrder = zone.minOrder == null ? null : Number(zone.minOrder);
  const freeOver = zone.freeOver == null ? null : Number(zone.freeOver);

  if (minOrder && subtotal < minOrder) {
    return {
      fee,
      waived: false,
      error: `We deliver to ${zone.name} from GH₵ ${minOrder.toFixed(2)}. Your basket is GH₵ ${round2(
        subtotal
      ).toFixed(2)} — add something else or choose pickup.`,
    };
  }
  if (freeOver && subtotal >= freeOver) {
    return { fee: 0, waived: true, originalFee: fee, error: null };
  }
  return { fee, waived: false, error: null };
}
