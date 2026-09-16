import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ghs } from '../lib/format.js';
import ProductPhoto from './ProductPhoto.jsx';

export default function ProductCard({ product }) {
  const navigate = useNavigate();
  return (
    <div className="product-card">
      <ProductPhoto product={product} iconSize={52} />
      <div className="product-info">
        {product.badge && <span className="product-badge">{product.badge}</span>}
        <div className="product-name">{product.name}</div>
        <div className="product-price">{ghs(product.basePrice)}</div>
        {product.description && <p className="product-desc">{product.description}</p>}
        <button
          className="btn btn-primary btn-block"
          onClick={() => navigate(`/custom-order?product=${product.id}`)}
          disabled={!product.inStock}
        >
          {product.inStock ? 'Customise & Order' : 'Out of stock'}
        </button>
      </div>
    </div>
  );
}
