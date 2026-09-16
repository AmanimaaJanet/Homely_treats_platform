import React, { useEffect, useRef, useState } from 'react';
import { TriangleAlert, Image as ImageIcon, Trash2, ArrowLeftCircle, Upload, Star } from 'lucide-react';
import { api } from '../../api.js';
import { useApp } from '../../store.jsx';
import { ghs } from '../../lib/format.js';
import { ProductIcon, PRODUCT_ICON_NAMES } from '../../components/ProductIcon.jsx';
import ProductPhoto from '../../components/ProductPhoto.jsx';

const CATEGORIES = [
  { id: 'CAKE', label: 'Cake' },
  { id: 'CUPCAKE', label: 'Cupcake' },
  { id: 'PASTRY', label: 'Pastry' },
  { id: 'CONFECTIONERY', label: 'Confectionery' },
];

const EMPTY = {
  name: '', description: '', category: 'CAKE', basePrice: '', icon: 'Cake',
  badge: '', flavors: '', stock: 0, inStock: true, featured: false, sizeOptions: [],
  images: [], imageAlt: '',
};

const MAX_PHOTOS = 8;

export default function Products() {
  const { toast } = useApp();
  const [products, setProducts] = useState([]);
  const [editing, setEditing] = useState(null);

  const photoInput = useRef(null);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);

  const load = () => api.get('/admin/products', { auth: true }).then((d) => setProducts(d.products)).catch(() => {});
  useEffect(load, []);

  // ---- Product photo management ------------------------------------------
  const images = editing?.images || [];

  const uploadPhotos = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const room = MAX_PHOTOS - images.length;
    if (room <= 0) {
      toast(`Up to ${MAX_PHOTOS} photos per product`, 'error');
      return;
    }
    setUploadingPhotos(true);
    try {
      const added = [];
      for (const file of files.slice(0, room)) {
        if (!file.type.startsWith('image/')) {
          toast(`"${file.name}" is not an image — skipped`, 'error');
          continue;
        }
        if (file.size > 5 * 1024 * 1024) {
          toast(`"${file.name}" is larger than 5 MB — skipped`, 'error');
          continue;
        }
        const { url } = await api.upload(file, { auth: true });
        added.push(url);
      }
      if (added.length) {
        setEditing((prev) => ({ ...prev, images: [...(prev.images || []), ...added] }));
        toast(`${added.length} photo${added.length > 1 ? 's' : ''} added — remember to Save`, 'success');
      }
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setUploadingPhotos(false);
      if (photoInput.current) photoInput.current.value = '';
    }
  };

  const makeCover = (i) => {
    setEditing((prev) => {
      const next = [...(prev.images || [])];
      const [pick] = next.splice(i, 1);
      return { ...prev, images: [pick, ...next] };
    });
  };

  const movePhoto = (i, delta) => {
    setEditing((prev) => {
      const next = [...(prev.images || [])];
      const j = i + delta;
      if (j < 0 || j >= next.length) return prev;
      [next[i], next[j]] = [next[j], next[i]];
      return { ...prev, images: next };
    });
  };

  const removePhoto = (i) => {
    setEditing((prev) => ({ ...prev, images: (prev.images || []).filter((_, j) => j !== i) }));
  };

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
      images: editing.images || [],
      imageAlt: editing.imageAlt || null,
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
            <ProductPhoto product={p} iconSize={48} />
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

              {/* Product photos — first image is the cover */}
              <div className="form-group photo-manager">
                <label className="form-label">
                  <ImageIcon size={14} /> Product photos ({images.length}/{MAX_PHOTOS})
                </label>
                <p className="muted small" style={{ marginBottom: 8 }}>
                  The first photo is the cover shown on the menu. JPG or PNG, up to 5 MB each.
                  With no photos, the product shows its icon instead.
                </p>

                <div className="photo-grid">
                  {images.map((url, i) => (
                    <div className={`photo-tile ${i === 0 ? 'is-cover' : ''}`} key={url}>
                      <img src={url} alt="" loading="lazy" />
                      {i === 0 && <span className="photo-cover-tag">Cover</span>}
                      <div className="photo-tile-actions">
                        {i !== 0 && (
                          <button type="button" title="Make cover" onClick={() => makeCover(i)}>
                            <Star size={12} />
                          </button>
                        )}
                        <button type="button" title="Move left" onClick={() => movePhoto(i, -1)} disabled={i === 0}>
                          <ArrowLeftCircle size={12} />
                        </button>
                        <button type="button" title="Move right" onClick={() => movePhoto(i, 1)} disabled={i === images.length - 1}>
                          <ArrowLeftCircle size={12} style={{ transform: 'rotate(180deg)' }} />
                        </button>
                        <button type="button" className="danger" title="Remove" onClick={() => removePhoto(i)}>
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  ))}

                  {images.length < MAX_PHOTOS && (
                    <button
                      type="button"
                      className="photo-tile photo-add"
                      onClick={() => photoInput.current?.click()}
                      disabled={uploadingPhotos}
                    >
                      <Upload size={18} />
                      <span>{uploadingPhotos ? 'Uploading…' : 'Add'}</span>
                    </button>
                  )}
                </div>

                <input
                  ref={photoInput}
                  type="file"
                  accept="image/*"
                  multiple
                  hidden
                  onChange={uploadPhotos}
                />

                <div className="form-group" style={{ marginTop: 14 }}>
                  <label className="form-label">Photo description (for screen readers, optional)</label>
                  <input
                    className="form-input"
                    value={editing.imageAlt || ''}
                    onChange={(e) => setEditing({ ...editing, imageAlt: e.target.value })}
                    placeholder="Defaults to the product name"
                  />
                </div>
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
