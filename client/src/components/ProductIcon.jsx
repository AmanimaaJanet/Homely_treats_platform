import React from 'react';
import {
  Cake,
  CakeSlice,
  Heart,
  Citrus,
  Cookie,
  Leaf,
  Cherry,
  Croissant,
} from 'lucide-react';

// Product icon registry — maps a stored icon name to a Lucide component.
const REGISTRY = {
  Cake,
  CakeSlice,
  Heart,
  Citrus,
  Cookie,
  Leaf,
  Cherry,
  Croissant,
};

export const PRODUCT_ICON_NAMES = Object.keys(REGISTRY);

/**
 * Renders a product icon by name (professional Lucide icon).
 * Falls back to the Cake icon if the name isn't recognised.
 */
export function ProductIcon({ name, size = 40, strokeWidth = 1.5, className = '' }) {
  const C = REGISTRY[name] || Cake;
  return <C size={size} strokeWidth={strokeWidth} className={className} aria-hidden="true" />;
}
