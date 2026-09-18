import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import StatusBadge from './StatusBadge.jsx';

/**
 * Status labels are what the kitchen and the customer both read to know where an order
 * stands, so every state the API can return must render something human — never a raw
 * enum, never a blank badge.
 */

const STATUSES = [
  ['PENDING', 'Pending'],
  ['CONFIRMED', 'Confirmed'],
  ['IN_PROGRESS', 'In Progress'],
  ['READY', 'Ready'],
  ['OUT_FOR_DELIVERY', 'OUT_FOR_DELIVERY'], // documented: falls through to the raw value
  ['DELIVERED', 'Delivered'],
  ['CANCELLED', 'Cancelled'],
  ['PAID', 'Paid'],
  ['SIMULATED', 'Paid (Demo)'],
  ['COD', 'Pay on Delivery'],
  ['FAILED', 'Failed'],
  ['REFUNDED', 'Refunded'],
];

describe('StatusBadge', () => {
  it.each(STATUSES)('renders %s as "%s"', (status, label) => {
    render(<StatusBadge status={status} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it('paints a paid order in the same colour as a ready one', () => {
    render(<StatusBadge status="PAID" />);
    expect(screen.getByText('Paid')).toHaveClass('status-ready');
  });

  it('paints a refund the same as a cancellation', () => {
    render(<StatusBadge status="REFUNDED" />);
    expect(screen.getByText('Refunded')).toHaveClass('status-cancelled');
  });

  it('falls back to the raw status rather than rendering nothing', () => {
    render(<StatusBadge status="SOMETHING_NEW" />);
    expect(screen.getByText('SOMETHING_NEW')).toBeInTheDocument();
  });
});
