import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ColumnChart, BarList, LineChart } from './MiniChart.jsx';

/**
 * The reports charts are the numbers an owner makes decisions from. These tests pin the
 * two things that would make them lie: rendering nothing when there is data, and showing
 * a chart (rather than "no data") when there is none.
 */

describe('ColumnChart', () => {
  const days = [
    { date: '2026-03-01', revenue: 0, orders: 0 },
    { date: '2026-03-02', revenue: 400, orders: 2 },
    { date: '2026-03-03', revenue: 800, orders: 3 },
  ];

  it('draws one column per day', () => {
    const { container } = render(<ColumnChart data={days} />);
    expect(container.querySelectorAll('.mini-column')).toHaveLength(3);
  });

  it('scales the tallest day to the full height and a zero day to nothing', () => {
    const { container } = render(<ColumnChart data={days} />);
    const bars = [...container.querySelectorAll('.mini-column-bar')].map((b) => b.style.height);
    expect(bars[0]).toBe('0%');
    expect(bars[1]).toBe('50%');
    expect(bars[2]).toBe('100%');
  });

  it('says so plainly when there is nothing to chart', () => {
    render(<ColumnChart data={[]} emptyLabel="No trading days in this range" />);
    expect(screen.getByText('No trading days in this range')).toBeInTheDocument();
  });

  it('survives a day with a missing value', () => {
    const { container } = render(<ColumnChart data={[{ date: '2026-03-04' }]} />);
    expect(container.querySelectorAll('.mini-column')).toHaveLength(1);
  });
});

describe('BarList', () => {
  const zones = [
    { zone: 'East Legon', revenue: 900, orders: 3 },
    { zone: 'Achimota', revenue: 300, orders: 1 },
  ];

  it('renders a row per entry with its value', () => {
    render(<BarList data={zones} labelKey="zone" valueKey="revenue" secondary={(z) => `${z.orders} order(s)`} />);
    expect(screen.getByText('East Legon')).toBeInTheDocument();
    expect(screen.getByText(/GH₵ 900/)).toBeInTheDocument();
    // The secondary line is its own element ("· 3 order(s)"), so match on a fragment.
    expect(screen.getByText(/3 order\(s\)/)).toBeInTheDocument();
  });

  it('sizes the bars against the leader', () => {
    const { container } = render(<BarList data={zones} labelKey="zone" valueKey="revenue" />);
    const widths = [...container.querySelectorAll('.mini-bar-fill')].map((b) => b.style.width);
    expect(widths[0]).toBe('100%');
    expect(widths[1]).toBe('33.33333333333333%');
  });

  it('handles an empty range without dividing by zero', () => {
    render(<BarList data={[]} labelKey="zone" valueKey="revenue" />);
    expect(screen.getByText('Nothing in this range yet')).toBeInTheDocument();
  });
});

describe('LineChart', () => {
  it('builds a polyline from the monthly values', () => {
    const { container } = render(
      <LineChart data={[{ month: 'Jan 2026', revenue: 100 }, { month: 'Feb 2026', revenue: 300 }]} />
    );
    const points = container.querySelector('polyline')?.getAttribute('points');
    expect(points?.split(' ')).toHaveLength(2);
    expect(container.querySelector('polyline')?.getAttribute('points')).toContain('0,');
  });

  it('reports the peak month', () => {
    render(<LineChart data={[{ month: 'Jan 2026', revenue: 100 }, { month: 'Feb 2026', revenue: 300 }]} />);
    expect(screen.getByText(/Peak GH₵ 300/)).toBeInTheDocument();
  });

  it('explains itself when there is no history', () => {
    render(<LineChart data={[]} />);
    expect(screen.getByText('Not enough history yet')).toBeInTheDocument();
  });
});
