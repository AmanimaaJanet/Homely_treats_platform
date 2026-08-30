import { config } from '../config.js';

/**
 * Loyalty points helpers.
 * Earn: 1 point per GH₵ 1 spent (rounded down).
 * Redeem: 20 points = GH₵ 1, capped at maxRedeemRatio of the order value.
 */

export function earnPoints(total) {
  return Math.floor(Number(total || 0) * config.loyalty.pointsPerGhs);
}

export function pointsValue(points) {
  return Number(points) / config.loyalty.pointsToGhs;
}

/** Max points the user can apply to an order of the given value. */
export function maxRedeemablePoints(userPoints, orderValue) {
  const cappedGhs = Number(orderValue || 0) * config.loyalty.maxRedeemRatio;
  const cappedPoints = Math.floor(cappedGhs * config.loyalty.pointsToGhs);
  return Math.max(0, Math.min(userPoints, cappedPoints));
}

export function discountForPoints(points) {
  return Math.round(pointsValue(points) * 100) / 100;
}
