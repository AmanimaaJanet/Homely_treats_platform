import React, { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { api } from '../api.js';
import ProductCard from '../components/ProductCard.jsx';
import { ProductIcon } from '../components/ProductIcon.jsx';
import VideoBlock from '../components/VideoBlock.jsx';
import Seo from '../components/Seo.jsx';
import { useLang } from '../lib/i18n.js';

const CATEGORIES = [
  { id: 'ALL', label: 'All Items', icon: null },
  { id: 'CAKE', label: 'Cakes', icon: 'Cake' },
  { id: 'CUPCAKE', label: 'Cupcakes', icon: 'Cookie' },
  { id: 'PASTRY', label: 'Pastries', icon: 'Croissant' },
  { id: 'CONFECTIONERY', label: 'Confectioneries', icon: 'Cherry' },
];

export default function Menu() {
  const { t } = useLang();
  const [products, setProducts] = useState([]);
  const [category, setCategory] = useState('ALL');
  const [sort, setSort] = useState('popular');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (category !== 'ALL') params.set('category', category);
    if (search) params.set('search', search);
    if (sort !== 'popular') params.set('sort', sort);
    api
      .get(`/products?${params.toString()}`)
      // A sleeping hosted database (Neon free tier) can fail this request's first
      // attempt; landing [] shows "our menu is coming soon" instead of a crash.
      .then((d) => setProducts(Array.isArray(d.products) ? d.products : []))
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  }, [category, sort, search]);

  return (
    <div className="page">
    <Seo title="Menu" description="The full menu — cakes, pastries and confectioneries with prices in GH₵, baked to order and delivered across Greater Accra." />
      <div className="page-banner">
        <VideoBlock
          className="page-banner-media"
          src="/media/craft-croissants.mp4"
          poster="/media/craft-croissants-poster.jpg"
        />
        <div className="page-banner-inner">
          <h1 className="page-banner-title">Our Menu</h1>
          <p className="page-banner-sub">
            Everything is baked to order — pick a favourite, or design your own.
          </p>
        </div>
      </div>
      <div className="container">
        <div className="section">

          <div className="menu-controls">
            <div className="search-box">
              <Search size={18} className="search-icon" />
              <input aria-label={t('Search treats…')}
                className="form-input"
                placeholder={t('Search treats…')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <select aria-label="Sort treats by" className="form-select" value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="popular">{t('Sort: Popular')}</option>
              <option value="price-asc">Price: Low → High</option>
              <option value="price-desc">Price: High → Low</option>
              <option value="name">Name: A–Z</option>
            </select>
          </div>

          <div className="category-pills">
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                className={`pill ${category === c.id ? 'pill-active' : ''}`}
                onClick={() => setCategory(c.id)}
              >
                {c.icon && <ProductIcon name={c.icon} size={16} />}
                {c.label}
              </button>
            ))}
          </div>

          <p className="muted">Showing {products.length} product{products.length !== 1 ? 's' : ''}</p>

          {loading ? (
            <div className="empty-state"><p>Loading…</p></div>
          ) : products.length === 0 ? (
            <div className="empty-state">
              <p className="empty-state-text">
                {search || category !== 'ALL' ? 'No products match your search' : 'Our menu is coming soon'}
              </p>
              <p className="muted">Fresh treats are being added — check back shortly.</p>
            </div>
          ) : (
            <div className="products-grid">
              {products.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
