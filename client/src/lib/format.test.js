import { describe, it, expect } from 'vitest';
import { ghs, fmtDate, fmtDateTime, initials, minDate } from '../lib/format.js';
import { amountInWords } from '../lib/words.js';

/**
 * Money and dates are where a bakery app gets embarrassing. These tests pin the exact
 * output customers see on a receipt, in an email and on the menu, so a formatting tweak
 * can't quietly change how much someone is asked to pay.
 */

describe('ghs()', () => {
  it('formats as Ghana cedis with two decimals', () => {
    expect(ghs(320)).toBe('GH₵ 320.00');
    expect(ghs(95.5)).toBe('GH₵ 95.50');
  });

  it('puts thousand separators where they belong', () => {
    expect(ghs(1234.5)).toBe('GH₵ 1,234.50');
    expect(ghs(1000000)).toBe('GH₵ 1,000,000.00');
  });

  it('treats missing or junk values as zero rather than printing NaN', () => {
    expect(ghs(undefined)).toBe('GH₵ 0.00');
    expect(ghs(null)).toBe('GH₵ 0.00');
    expect(ghs('')).toBe('GH₵ 0.00');
    expect(ghs('abc')).toBe('GH₵ 0.00');
  });

  it('rounds a runaway float to two places', () => {
    expect(ghs(0.1 + 0.2)).toBe('GH₵ 0.30');
  });
});

describe('amountInWords()', () => {
  it('writes a whole amount in cedis', () => {
    expect(amountInWords(320)).toBe('Three hundred and twenty Ghana cedis only');
  });

  it('adds pesewas when there are any', () => {
    expect(amountInWords(95.5)).toBe('Ninety-five Ghana cedis and fifty pesewas');
  });

  it('handles the awkward single cedi', () => {
    expect(amountInWords(1)).toBe('One Ghana cedi only');
  });

  it('handles zero', () => {
    expect(amountInWords(0)).toBe('Zero Ghana cedis only');
  });

  it('reaches thousands and millions', () => {
    expect(amountInWords(1234)).toBe('One thousand, two hundred and thirty-four Ghana cedis only');
    expect(amountInWords(2500000)).toBe('Two million, five hundred thousand Ghana cedis only');
  });

  it('never produces NaN in words', () => {
    expect(amountInWords(undefined)).toBe('Zero Ghana cedis only');
    expect(amountInWords('nonsense')).toBe('Zero Ghana cedis only');
  });
});

describe('dates', () => {
  it('formats a date the way a Ghanaian customer reads it', () => {
    expect(fmtDate('2026-03-04T10:00:00Z')).toBe('4 Mar 2026');
  });

  it('shows a dash rather than "Invalid Date"', () => {
    expect(fmtDate(null)).toBe('—');
    expect(fmtDate('')).toBe('—');
  });

  it('includes the time where a time matters', () => {
    const formatted = fmtDateTime('2026-03-04T10:30:00Z');
    expect(formatted).toMatch(/4 Mar 2026/);
    expect(formatted).toMatch(/\d{2}:\d{2}/);
  });

  it('minDate() returns an ISO day N days ahead — the shape the date picker needs', () => {
    expect(minDate(2)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const [y, m, d] = minDate(0).split('-').map(Number);
    const today = new Date();
    expect(y).toBe(today.getFullYear());
    expect(m).toBe(today.getMonth() + 1);
    expect(d).toBe(today.getDate());
  });
});

describe('initials()', () => {
  it('uses the first letters of the first two names', () => {
    expect(initials('Ama Mensah')).toBe('AM');
    expect(initials('Kofi Anokye Boateng')).toBe('KA');
  });

  it('copes with a single name and with nothing', () => {
    expect(initials('Ama')).toBe('A');
    expect(initials('')).toBe('');
    expect(initials(undefined)).toBe('');
  });
});
