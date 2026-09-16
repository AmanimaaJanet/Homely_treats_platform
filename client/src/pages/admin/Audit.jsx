import React, { useEffect, useState } from 'react';
import { ScrollText, Search, RefreshCw } from 'lucide-react';
import { api } from '../../api.js';
import { useApp } from '../../store.jsx';
import { fmtDateTime } from '../../lib/format.js';

const ACTION_LABELS = {
  ORDER_STATUS: 'Order status change',
  PRODUCT_CREATE: 'Product created',
  PRODUCT_UPDATE: 'Product updated',
  PRODUCT_DELETE: 'Product de-listed',
  PROMO_CREATE: 'Promo created',
  PROMO_DELETE: 'Promo deleted',
  SETTINGS_UPDATE: 'Settings changed',
  RIDER_CREATE: 'Rider account created',
  RIDER_SUSPEND: 'Rider suspended',
  RIDER_REINSTATE: 'Rider reinstated',
};

export default function AdminAudit() {
  const { toast } = useApp();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [action, setAction] = useState('');

  const load = () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (action) params.set('action', action);
    api.get(`/admin/audit?${params.toString()}`, { auth: true })
      .then((d) => setLogs(d.logs))
      .catch((err) => toast(err.message, 'error'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [action]);

  return (
    <div>
      <div className="admin-page-head">
        <div>
          <h1 className="admin-title">Activity log</h1>
          <p className="muted small">
            Every privileged action is recorded — who changed what, and when. Useful when a price,
            an order or a setting needs explaining later.
          </p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={load}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      <div className="section">
        <div className="menu-controls">
          <div className="search-box">
            <Search size={17} className="search-icon" />
            <input
              className="form-input"
              placeholder="Search by email, order or detail…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && load()}
            />
          </div>
          <select className="form-input" value={action} onChange={(e) => setAction(e.target.value)}>
            <option value="">All actions</option>
            {Object.entries(ACTION_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <button className="btn btn-primary btn-sm" onClick={load}>Apply</button>
        </div>

        {loading ? (
          <p className="muted">Loading activity…</p>
        ) : logs.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon"><ScrollText size={44} strokeWidth={1.4} /></div>
            <p className="empty-state-text">Nothing recorded yet</p>
            <p className="muted">Admin actions will appear here as they happen.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Who</th>
                  <th>Action</th>
                  <th>Detail</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l) => (
                  <tr key={l.id}>
                    <td className="small">{fmtDateTime(l.createdAt)}</td>
                    <td className="small">{l.actorEmail || 'system'}</td>
                    <td>
                      <span className="pill-count">{ACTION_LABELS[l.action] || l.action}</span>
                    </td>
                    <td className="small">
                      {l.detail}
                      {l.entityId && <span className="muted"> · {l.entityId}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
