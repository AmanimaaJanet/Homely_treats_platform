import React, { useEffect, useState } from 'react';
import { TriangleAlert } from 'lucide-react';
import { api } from '../../api.js';
import { useApp } from '../../store.jsx';
import { ghs } from '../../lib/format.js';
import { ProductIcon, PRODUCT_ICON_NAMES } from '../../components/ProductIcon.jsx';

const CATEGORIES = [
  { id: 'CAKE', label: 'Cake' },
  { id: 'CUPCAKE', label: 'Cupcake' },
  { id: 'PASTRY', label: 'Pastry' },
  { id: 'CONFECTIONERY', label: 'Confectionery' },
];

const EMPTY = {
  name: '', description: '', category: 'CAKE', basePrice: '', icon: 'Cake',
  badge: '', flavors: '', stock: 0, inStock: true, featured: false, sizeOptions: [],
};

export default function Products() {
  const { toast } = useApp();
  const [products, setProducts] = useState([]);
  const [editing, setEditing] = useState(null);

  const load = () => api.get('/admin/products', { auth: true }).then((d) => setProducts(d.products)).catch(() => {});
  useEffect(load, []);

  const setSize = (i, patch) => {
    setEditing({
      ...editing,
      sizeOptions: editing.sizeOptions.map((s, j) => (j === i ? { ...s, ...patch } : s)),
    });
  };

  const addSize = () => {
    setEditing({ ...editing, sizeOptions: [...editing.sizeOptions, { label: '', serves: 1, price: editing.basePrice }] });
  };

  const removeSize = (i) => {
    setEditing({ ...editing, sizeOptions: editing.sizeOptions.filter((_, j) => j !== i) });
  };

  const save = async (e) => {
    e.preventDefault();
    const payload = {
      name: editing.name,
      description: editing.description || null,
      category: editing.category,
      basePrice: Number(editing.basePrice),
      icon: editing.icon,
      badge: editing.badge || null,
      flavors: (editing.flavors || '').split(',').map((s) => s.trim()).filter(Boolean),
      stock: parseInt(editing.stock || 0, 10),
      inStock: editing.inStock,
      featured: editing.featured,
      sizeOptions: (editing.sizeOptions || []).filter((s) => s.label),
    };
    try {
      if (editing.id) {
        await api.put(`/admin/products/${editing.id}`, payload, { auth: true });
        toast('Product updated', 'success');
      } else {
        await api.post('/admin/products', payload, { auth: true });
        toast('Product added', 'success');
      }
      setEditing(null);
      load();
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const remove = async (p) => {
    if (!window.confirm(`Deactivate "${p.name}"?`)) return;
    await api.del(`/admin/products/${p.id}`, { auth: true });
    toast('Product deactivated', 'success');
    load();
  };

  const lowStock = products.filter((p) => p.inStock && p.stock < 10);

  return (
    <div>
      <div className="section-head-row">
        <h2 className="admin-title">Product Management</h2>
        <button className="btn btn-primary" onClick={() => setEditing({ ...EMPTY, sizeOptions: [{ label: 'Standard', serves: 1, price: '' }] })}>+ Add Product</button>
      </div>

      {lowStock.length > 0 && (
        <div className="alert warn">
          <strong><TriangleAlert size={15} /> Inventory Alerts ({lowStock.length})</strong>
          {lowStock.map((p) => <p key={p.id} className="small">{p.name} — only {p.stock} remaining</p>)}
        </div>
      )}

      <div className="products-grid">
        {products.map((p) => (
          <div className="product-card" key={p.id}>
            <div className="product-image"><ProductIcon name={p.icon || p.emoji} size={48} /></div>
            <div className="product-info">
              {p.badge && <span className="product-badge">{p.badge}</span>}
              <div className="product-name">{p.name}</div>
              <div className="product-price">{ghs(p.basePrice)}</div>
              <p className="muted small">
                {CATEGORIES.find((c) => c.id === p.category)?.label || p.category} · Stock: {p.stock} {!p.inStock && '· Out of stock'}
              </p>
              {p.sizeOptions?.length > 0 && (
                <p className="muted small">Sizes: {p.sizeOptions.map((s) => `${s.label} ${ghs(s.price)}`).join(', ')}</p>
              )}
              <div className="row-actions" style={{ marginTop: '0.75rem' }}>
                <button className="btn btn-secondary btn-sm" onClick={() => setEditing({ ...p, flavors: (p.flavors || []).join(', ') })}>Edit</button>
                <button className="btn btn-danger btn-sm" onClick={() => remove(p)}>Deactivate</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <div className="modal active" onClick={(e) => e.target === e.currentTarget && setEditing(null)}>
          <div className="modal-content modal-wide">
            <div className="modal-header">
              <h3>{editing.id ? 'Edit Product' : 'Add New Product'}</h3>
              <button className="close-btn" onClick={() => setEditing(null)}>×</button>
            </div>
            <form onSubmit={save}>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Product Name *</label>
                  <input className="form-input" required value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Icon</label>
                  <select className="form-select" value={editing.icon} onChange={(e) => setEditing({ ...editing, icon: e.target.value })}>
                    {PRODUCT_ICON_NAMES.map((name) => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                  <div className="icon-preview"><ProductIcon name={editing.icon} size={22} /></div>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea className="form-textarea" value={editing.description || ''} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Base Price (GH₵) *</label>
                  <input type="number" step="0.01" className="form-input" required value={editing.basePrice} onChange={(e) => setEditing({ ...editing, basePrice: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Category *</label>
                  <select className="form-select" required value={editing.category} onChange={(e) => setEditing({ ...editing, category: e.target.value })}>
                    {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </select>
                </div>
              </div>

              <div className="size-editor">
                <div className="section-head-row">
                  <h4 className="form-heading" style={{ margin: 0 }}>Size-based pricing</h4>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={addSize}>+ Add size</button>
                </div>
                <p className="muted small">Each size has its own price. If no sizes are set, the base price applies.</p>
                {editing.sizeOptions.map((s, i) => (
                  <div className="size-row" key={i}>
                    <input className="form-input" placeholder="e.g. 8 inch (serves 14)" value={s.label} onChange={(e) => setSize(i, { label: e.target.value })} />
                    <input type="number" className="form-input" placeholder="Serves" value={s.serves} onChange={(e) => setSize(i, { serves: e.target.value })} />
                    <input type="number" step="0.01" className="form-input" placeholder="Price GH₵" value={s.price} onChange={(e) => setSize(i, { price: e.target.value })} />
                    <button type="button" className="btn btn-danger btn-sm" onClick={() => removeSize(i)}>×</button>
                  </div>
                ))}
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Flavours (comma-separated)</label>
                  <input className="form-input" value={editing.flavors} onChange={(e) => setEditing({ ...editing, flavors: e.target.value })} placeholder="Vanilla, Chocolate, Red Velvet" />
                </div>
                <div className="form-group">
                  <label className="form-label">Badge (optional)</label>
                  <input className="form-input" value={editing.badge || ''} onChange={(e) => setEditing({ ...editing, badge: e.target.value })} placeholder="Best Seller" />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Stock Count</label>
                  <input type="number" className="form-input" value={editing.stock} onChange={(e) => setEditing({ ...editing, stock: e.target.value })} />
                </div>
              </div>

              <div className="check-row">
                <label><input type="checkbox" checked={!!editing.inStock} onChange={(e) => setEditing({ ...editing, inStock: e.target.checked })} /> In Stock</label>
                <label><input type="checkbox" checked={!!editing.featured} onChange={(e) => setEditing({ ...editing, featured: e.target.checked })} /> Featured on homepage</label>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setEditing(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Product</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
