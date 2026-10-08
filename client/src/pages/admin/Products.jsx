import React, { useEffect, useRef, useState } from 'react';
import { TriangleAlert, Image as ImageIcon, Trash2, ArrowLeftCircle, Upload, Star, Copy, Download } from 'lucide-react';
import { api } from '../../api.js';
import { useApp } from '../../store.jsx';
import { ghs } from '../../lib/format.js';
import ProductPhoto from '../../components/ProductPhoto.jsx';
import { useEscape } from '../../lib/a11y.js';

const CATEGORIES = [
  { id: 'CAKE', label: 'Cake' },
  { id: 'CUPCAKE', label: 'Cupcake' },
  { id: 'PASTRY', label: 'Pastry' },
  { id: 'CONFECTIONERY', label: 'Confectionery' },
];

const EMPTY = {
  name: '', description: '', category: 'CAKE', basePrice: '', icon: 'Cake',
  badge: '', flavors: '', stock: 0, leadDays: '', inStock: true, featured: false, sizeOptions: [],
  images: [], imageAlt: '',
};

const MAX_PHOTOS = 8;

export default function Products() {
  const { toast } = useApp();
  const [products, setProducts] = useState([]);
  const [editing, setEditing] = useState(null);

  const photoInput = useRef(null);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  // Photos on local disk do not survive a redeploy on hosts with ephemeral disks
  // (Render, Heroku…) — say so before the owner learns it the hard way.
  const [photosOnDisk, setPhotosOnDisk] = useState(false);
  // Demo-seed sample products still on the menu (they are all flagged featured, so
  // they take over the homepage until removed).
  const [sampleActive, setSampleActive] = useState(0);
  const [removingSamples, setRemovingSamples] = useState(false);

  // Bulk catalogue work: a seasonal price change or a January menu clear touches the
  // whole list, and doing that one product at a time is how mistakes happen.
  const importInput = useRef(null);
  const [selected, setSelected] = useState(() => new Set());
  const [bulkAction, setBulkAction] = useState('activate');
  const [bulkValue, setBulkValue] = useState('');
  const [bulkMode, setBulkMode] = useState('percent');
  const [bulkBusy, setBulkBusy] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);

  const load = () => api.get('/admin/products', { auth: true })
    .then((d) => {
      setProducts(Array.isArray(d.products) ? d.products : []);
      setSampleActive(Number(d.sampleActive) || 0);
    })
    .catch(() => {});

  useEffect(() => {
    api.get('/health').then((d) => setPhotosOnDisk(d.cloudinaryConfigured === false)).catch(() => {});
  }, []);
  useEffect(load, []);

  // ---- Bulk actions ------------------------------------------------------
  const toggleSelect = (id) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const allSelected = products.length > 0 && selected.size === products.length;
  const toggleAll = () =>
    setSelected(allSelected ? new Set() : new Set(products.map((p) => p.id)));

  const applyBulk = async () => {
    if (selected.size === 0) return;
    const needsValue = bulkAction === 'stock' || bulkAction === 'priceAdjust';
    if (needsValue && bulkValue === '') {
      toast(bulkAction === 'stock' ? 'Enter the stock level' : 'Enter the price adjustment', 'error');
      return;
    }
    setBulkBusy(true);
    try {
      const res = await api.post(
        '/admin/products/bulk',
        {
          ids: [...selected],
          action: bulkAction,
          value: needsValue ? Number(bulkValue) : undefined,
          mode: bulkMode,
        },
        { auth: true }
      );
      toast(res.summary, 'success');
      setSelected(new Set());
      setBulkValue('');
      await load();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBulkBusy(false);
    }
  };

  const duplicate = async (product) => {
    try {
      const res = await api.post(`/admin/products/${product.id}/duplicate`, {}, { auth: true });
      toast(`Copied as "${res.product.name}" — de-listed until you review it.`, 'success');
      await load();
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  // ---- CSV import --------------------------------------------------------
  const onImportFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setImporting(true);
    setImportResult(null);
    try {
      const csv = await file.text();
      const res = await api.post('/admin/products/import', { csv, updateExisting: true }, { auth: true });
      setImportResult(res);
      toast(
        `Import finished — ${res.created} added, ${res.updated} updated${res.skipped ? `, ${res.skipped} skipped` : ''}.`,
        res.skipped ? 'error' : 'success'
      );
      await load();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setImporting(false);
    }
  };

  const downloadTemplate = async () => {
    try {
      const token = localStorage.getItem('ht_token');
      const res = await fetch('/api/admin/products/import-template', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Could not download the template');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'homely-treats-product-template.csv';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast(err.message, 'error');
    }
  };

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
      leadDays: editing.leadDays === '' || editing.leadDays === undefined ? null : Number(editing.leadDays),
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

  const removeSamples = async () => {
    if (!window.confirm('Remove the sample (demo) products from the menu? Your own products are untouched, and nothing is deleted — they are de-listed and can be restored.')) return;
    setRemovingSamples(true);
    try {
      const res = await api.del('/admin/products/sample', { auth: true });
      toast(`Removed ${res.removed} sample product${res.removed === 1 ? '' : 's'} from the menu.`, 'success');
      load();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setRemovingSamples(false);
    }
  };

  const remove = async (p) => {
    if (!window.confirm(`Deactivate "${p.name}"?`)) return;
    await api.del(`/admin/products/${p.id}`, { auth: true });
    toast('Product deactivated', 'success');
    load();
  };

  const lowStock = products.filter((p) => p.inStock && p.stock < 10);


  // Escape closes the dialog (a keyboard user's only way back out), and focus is moved
  // into it so the next Tab goes to the dialog's own controls rather than the page behind.
  const dialogRef = useRef(null);
  useEscape(!!editing, () => setEditing(null));
  useEffect(() => {
    if (editing) dialogRef.current?.focus();
  }, [editing]);
  return (
    <div>
      <div className="section-head-row">
        <h2 className="admin-title">Product Management</h2>

        {sampleActive > 0 && (
          <div className="alert warn" role="alert">
            <strong>{sampleActive} sample product{sampleActive === 1 ? '' : 's'} from the demo catalogue still on the menu.</strong>{' '}
            They are flagged as featured, so they take over the homepage's featured
            section. Remove them here and star your own products instead — nothing is
            deleted, they are simply de-listed.
            <div style={{ marginTop: 10 }}>
              <button className="btn btn-secondary btn-sm" onClick={removeSamples} disabled={removingSamples}>
                {removingSamples ? 'Removing…' : `Remove ${sampleActive} sample product${sampleActive === 1 ? '' : 's'}`}
              </button>
            </div>
          </div>
        )}

        {photosOnDisk && (
          <div className="alert warn" role="alert">
            <strong>Photos are stored on this server's disk.</strong> On hosting with an
            ephemeral disk (Render, Heroku) every deploy wipes them — the menu keeps
            working and shows each product's initial, but photos must be re-uploaded.
            To make photos permanent, connect a free Cloudinary account (see
            README → Photos) and set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and
            CLOUDINARY_API_SECRET.
          </div>
        )}
        <button className="btn btn-primary" onClick={() => setEditing({ ...EMPTY, sizeOptions: [{ label: 'Standard', serves: 1, price: '' }] })}>+ Add Product</button>
      </div>

      {lowStock.length > 0 && (
        <div className="alert warn">
          <strong><TriangleAlert size={15} /> Inventory Alerts ({lowStock.length})</strong>
          {lowStock.map((p) => <p key={p.id} className="small">{p.name} — only {p.stock} remaining</p>)}
        </div>
      )}

      <div className="admin-toolbar bulk-toolbar">
        <label className="check-inline">
          <input type="checkbox" checked={allSelected} onChange={toggleAll} />
          <span className="small">{allSelected ? 'Clear' : 'Select all'} ({products.length})</span>
        </label>
        <span className="muted small">{selected.size} selected</span>

        <select aria-label="Bulk action" className="form-select" value={bulkAction} onChange={(e) => setBulkAction(e.target.value)}>
          <option value="activate">Mark available</option>
          <option value="deactivate">Mark sold out</option>
          <option value="feature">Add to featured</option>
          <option value="unfeature">Remove from featured</option>
          <option value="list">Re-list on the menu</option>
          <option value="delist">De-list from the menu</option>
          <option value="stock">Set stock to…</option>
          <option value="priceAdjust">Adjust prices…</option>
                </select>

        {(bulkAction === 'stock' || bulkAction === 'priceAdjust') && (
          <>
            <input aria-label="Value for the bulk action"
              className="form-input"
              type="number"
              step="any"
              value={bulkValue}
              onChange={(e) => setBulkValue(e.target.value)}
              placeholder={bulkAction === 'stock' ? 'Stock level' : 'e.g. 10 or -15'}
              style={{ maxWidth: '150px' }}
            />
            {bulkAction === 'priceAdjust' && (
              <select aria-label="Adjustment type" className="form-select" value={bulkMode} onChange={(e) => setBulkMode(e.target.value)} style={{ maxWidth: '130px' }}>
                <option value="percent">percent</option>
                <option value="amount">GH₵ each</option>
                </select>
            )}
          </>
        )}

        <button className="btn btn-primary btn-sm" onClick={applyBulk} disabled={bulkBusy || selected.size === 0}>
          {bulkBusy ? 'Applying…' : 'Apply to selected'}
        </button>

        <span className="spacer" />

        <input ref={importInput} type="file" accept=".csv,text/csv" hidden onChange={onImportFile} />
        <button className="btn btn-secondary btn-sm" onClick={() => importInput.current?.click()} disabled={importing}>
          <Upload size={14} /> {importing ? 'Importing…' : 'Import CSV'}
        </button>
        <button className="btn btn-ghost btn-sm" onClick={downloadTemplate}>
          <Download size={14} /> Template
        </button>
      </div>

      {importResult && (
        <div className={`alert ${importResult.skipped ? 'warn' : 'success'}`}>
          <strong>Import finished</strong>
          <p className="small">
            {importResult.created} added · {importResult.updated} updated · {importResult.skipped} skipped
          </p>
          {importResult.errors?.slice(0, 5).map((e) => (
            <p className="small" key={e.line}>Line {e.line}: {e.message}</p>
          ))}
          {importResult.errors?.length > 5 && (
            <p className="small">…and {importResult.errors.length - 5} more row(s) skipped</p>
          )}
          <button className="btn btn-ghost btn-sm" onClick={() => setImportResult(null)}>Dismiss</button>
        </div>
      )}

      <div className="products-grid">
        {products.map((p) => (
          <div className={`product-card ${selected.has(p.id) ? 'bulk-selected' : ''}`} key={p.id}>
            <label className="bulk-check" title="Select for a bulk action">
              <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggleSelect(p.id)} />
            </label>
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
                <button className="btn btn-ghost btn-sm" onClick={() => duplicate(p)} title="Copy this product as a starting point">
                  <Copy size={14} /> Duplicate
                </button>
                <button className="btn btn-danger btn-sm" onClick={() => remove(p)}>Deactivate</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <div className="modal active" onClick={(e) => e.target === e.currentTarget && setEditing(null)}>
          <div ref={dialogRef} tabIndex={-1} className="modal-content modal-wide" role="dialog" aria-modal="true" aria-labelledby="product-dialog-title">
            <div className="modal-header">
              <h3 id="product-dialog-title">{editing.id ? 'Edit Product' : 'Add New Product'}</h3>
              <button className="close-btn" onClick={() => setEditing(null)}>×</button>
            </div>
            <form onSubmit={save}>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">
                    <span className="form-label-text">Product Name *</span>
                    <input className="form-input" required value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
                  </label>
                </div>
                <div className="form-group">
                  <label className="form-label">
                    <span className="form-label-text">Category *</span>
                    <select className="form-select" required value={editing.category} onChange={(e) => setEditing({ ...editing, category: e.target.value })}>
                      {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                    </select>
                  </label>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">
                  <span className="form-label-text">Description</span>
                  <textarea className="form-textarea" value={editing.description || ''} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
                </label>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">
                    <span className="form-label-text">Base Price (GH₵) *</span>
                    <input type="number" step="0.01" className="form-input" required value={editing.basePrice} onChange={(e) => setEditing({ ...editing, basePrice: e.target.value })} />
                  </label>
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
                    <input aria-label="Size label" className="form-input" placeholder="e.g. 8 inch (serves 14)" value={s.label} onChange={(e) => setSize(i, { label: e.target.value })} />
                    <input aria-label="How many this size serves" type="number" className="form-input" placeholder="Serves" value={s.serves} onChange={(e) => setSize(i, { serves: e.target.value })} />
                    <input aria-label="Price for this size" type="number" step="0.01" className="form-input" placeholder="Price GH₵" value={s.price} onChange={(e) => setSize(i, { price: e.target.value })} />
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
                  The first photo is the cover shown on the menu. Photos straight from a
                  phone camera are fine — anything up to 20 MB is accepted and compressed
                  automatically. With no photos yet, the product shows a placeholder.
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
                  <label className="form-label">
                    <span className="form-label-text">Photo description (for screen readers, optional)</span>
                    <input
                      className="form-input"
                      value={editing.imageAlt || ''}
                      onChange={(e) => setEditing({ ...editing, imageAlt: e.target.value })}
                      placeholder="Defaults to the product name"
                    />
                  </label>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">
                    <span className="form-label-text">Flavours (comma-separated)</span>
                    <input className="form-input" value={editing.flavors} onChange={(e) => setEditing({ ...editing, flavors: e.target.value })} placeholder="Vanilla, Chocolate, Red Velvet" />
                  </label>
                </div>
                <div className="form-group">
                  <label className="form-label">
                    <span className="form-label-text">Badge (optional)</span>
                    <input className="form-input" value={editing.badge || ''} onChange={(e) => setEditing({ ...editing, badge: e.target.value })} placeholder="Best Seller" />
                  </label>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">
                    <span className="form-label-text">Stock Count</span>
                    <input type="number" className="form-input" value={editing.stock} onChange={(e) => setEditing({ ...editing, stock: e.target.value })} />
                  </label>
                </div>
                <div className="form-group">
                  <label className="form-label">
                    <span className="form-label-text">Notice needed (days)</span>
                    <input
                      type="number"
                      min="0"
                      max="60"
                      className="form-input"
                      placeholder="Use the shop default"
                      value={editing.leadDays ?? ''}
                      onChange={(e) => setEditing({ ...editing, leadDays: e.target.value })}
                    />
                  </label>
                  <p className="muted small">
                    Leave blank to use your shop-wide lead time. Raise it for cakes that
                    need longer (a tiered cake vs a tray of cookies).
                  </p>
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
