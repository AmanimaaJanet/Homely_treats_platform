import { describe, it, expect } from 'vitest';
import { distanceKm, etaMinutes, formatKm } from './geo.js';

/**
 * The live rider card says "your rider is 1.8 km away, about 5 minutes" — these
 * tests make sure that sentence is true. Distances are checked against real Accra
 * landmarks with known separations.
 */
describe('geo (live rider distances)', () => {
  it('measures a known Accra distance correctly', () => {
    // Kotoka International Airport (5.6052, -0.1719) → Accra Mall (5.6256, -0.1747):
    // roughly 2.3 km apart, straight line.
    const d = distanceKm(5.6052, -0.1719, 5.6256, -0.1747);
    expect(d).toBeGreaterThan(2.0);
    expect(d).toBeLessThan(2.6);
  });

  it('returns zero for the same point', () => {
    expect(distanceKm(5.6052, -0.1719, 5.6052, -0.1719)).toBe(0);
  });

  it('handles a long haul sanely (Accra → Tema is about 25 km)', () => {
    const d = distanceKm(5.6052, -0.1719, 5.6698, 0.0166); // airport → Tema
    expect(d).toBeGreaterThan(22);
    expect(d).toBeLessThan(28);
  });

  it('estimates arrival at Accra street speed', () => {
    expect(etaMinutes(1.8)).toBe(6); // 1.8 km at 18 km/h
    expect(etaMinutes(0.1)).toBe(1); // never "0 minutes" — the rider is not there yet
    expect(etaMinutes(11)).toBe(37); // a long haul across town
  });

  it('formats distances the way people read them', () => {
    expect(formatKm(0.85)).toBe('850 m');
    expect(formatKm(1.83)).toBe('1.8 km');
    expect(formatKm(Number.NaN)).toBe('');
  });
});
