import { broadcastOrder } from './realtime.js';

/**
 * Live rider positions, for the "your rider is on the way" experience.
 *
 * Deliberately in memory, not the database:
 *
 * - A position is worthless seconds after it is captured — it is a live signal, not
 *   a record. Nothing downstream (reports, history, disputes) needs where a rider
 *   stood at 14:03, and storing customer-adjacent movement patterns would be a
 *   liability with no benefit.
 * - A server restart clears it, which is fine: the rider page re-sends its position
 *   every few seconds, so the signal reappears on its own.
 *
 * Privacy rules, enforced by every caller:
 *
 * - A position exists only while the order is OUT_FOR_DELIVERY. The moment it is
 *   delivered (or cancelled), clearForOrder() removes it — after delivery, where the
 *   rider goes next is nobody's business but theirs.
 * - Positions are only ever exposed to the tracking page of that specific order
 *   (same public-by-order-reference trust model as the rest of the tracking API).
 */

const TTL_MS = 5 * 60 * 1000; // a position older than this is stale, not "live"

/** orderId -> { lat, lng, accuracy, riderName, updatedAt } */
const positions = new Map();

// Tidy up lazily on write rather than with a timer that keeps the process awake.
function sweep() {
  const now = Date.now();
  for (const [key, pos] of positions) {
    if (now - pos.updatedAt > TTL_MS) positions.delete(key);
  }
}

export function updateRiderLocation(orderId, { lat, lng, accuracy, riderName }) {
  sweep();
  const position = { lat, lng, accuracy, riderName, updatedAt: Date.now() };
  positions.set(orderId, position);
  // The customer's tracking page is already in this WebSocket room.
  broadcastOrder(orderId, { type: 'RIDER_LOCATION', lat, lng, accuracy, updatedAt: position.updatedAt });
  return position;
}

/**
 * The live position for an order, or null if there is none worth showing.
 * `status` is the order's *current* status — the gate for whether a position is
 * served at all.
 */
export function getRiderLocation(orderId, status) {
  if (status !== 'OUT_FOR_DELIVERY') return null; // delivered/cancelled ⇒ position gone
  const pos = positions.get(orderId);
  if (!pos) return null;
  if (Date.now() - pos.updatedAt > TTL_MS) {
    positions.delete(orderId);
    return null;
  }
  return pos;
}

/** Called when an order leaves OUT_FOR_DELIVERY — delivered, cancelled, anything. */
export function clearRiderLocation(orderId) {
  positions.delete(orderId);
}
