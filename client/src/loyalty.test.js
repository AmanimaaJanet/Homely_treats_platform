import { describe, it, expect } from 'vitest';
import { pointsValue, maxRedeemablePoints, LOYALTY } from './api.js';

/**
 * Loyalty maths.
 *
 * These two functions decide how much of a customer's balance can come off an order, and
 * the server enforces the same rules. If the client ever promises more than the server
 * grants, a customer sees one total at checkout and another on the receipt — so the
 * cap is asserted here against the documented policy (20 points = GH₵ 1, max 50% of the
 * order).
 */

describe('pointsValue()', () => {
  it('converts at 20 points to the cedi', () => {
    expect(pointsValue(20)).toBe(1);
    expect(pointsValue(320)).toBe(16);
    expect(pointsValue(0)).toBe(0);
  });

  it('matches the published rate', () => {
    expect(LOYALTY.pointsToGhs).toBe(20);
    expect(LOYALTY.maxRedeemRatio).toBe(0.5);
  });
});

describe('maxRedeemablePoints()', () => {
  it('never lets points cover more than half the order', () => {
    // GH₵ 100 order: at most GH₵ 50 = 1000 points, even with a huge balance.
    expect(maxRedeemablePoints(100000, 100)).toBe(1000);
  });

  it('never lets a customer spend more than they hold', () => {
    expect(maxRedeemablePoints(60, 100)).toBe(60);
  });

  it('rounds down to whole points', () => {
    // GH₵ 99.99 → half = 49.995 → 999.9 points → floor 999
    expect(maxRedeemablePoints(100000, 99.99)).toBe(999);
  });

  it('gives nothing for a free or empty order', () => {
    expect(maxRedeemablePoints(500, 0)).toBe(0);
    expect(maxRedeemablePoints(0, 100)).toBe(0);
  });

  it('handles a balance of exactly the cap', () => {
    expect(maxRedeemablePoints(1000, 100)).toBe(1000);
  });
});
