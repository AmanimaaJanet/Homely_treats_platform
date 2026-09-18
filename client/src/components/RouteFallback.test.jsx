import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import RouteFallback from './RouteFallback.jsx';

describe('RouteFallback', () => {
  it('announces loading to screen readers, not just to eyes', () => {
    render(<RouteFallback label="Loading the menu" />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
    expect(screen.getByText('Loading the menu…')).toBeInTheDocument();
  });

  it('uses a shop-shaped skeleton for storefront pages', () => {
    const { container } = render(<RouteFallback />);
    expect(container.querySelectorAll('.skeleton-card')).toHaveLength(3);
  });

  it('uses a compact spinner inside the admin panel', () => {
    const { container } = render(<RouteFallback label="Loading the admin panel" variant="admin" />);
    expect(container.querySelector('.route-spinner')).toBeInTheDocument();
    expect(container.querySelector('.skeleton-card')).toBeNull();
  });
});
