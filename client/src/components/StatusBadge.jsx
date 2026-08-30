import React from 'react';

const MAP = {
  PENDING: 'pending',
  CONFIRMED: 'progress',
  IN_PROGRESS: 'progress',
  READY: 'ready',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled',
  PAID: 'ready',
  SIMULATED: 'ready',
  COD: 'delivered',
  FAILED: 'cancelled',
};

const LABELS = {
  PENDING: 'Pending',
  CONFIRMED: 'Confirmed',
  IN_PROGRESS: 'In Progress',
  READY: 'Ready',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
  PAID: 'Paid',
  SIMULATED: 'Paid (Demo)',
  COD: 'Pay on Delivery',
  FAILED: 'Failed',
};

export default function StatusBadge({ status }) {
  const cls = MAP[status] || 'pending';
  return <span className={`status-badge status-${cls}`}>{LABELS[status] || status}</span>;
}
