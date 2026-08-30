import React, { useEffect, useState } from 'react';
import { Coins, ClipboardList, Receipt, Download } from 'lucide-react';
import { api } from '../../api.js';
import { useApp } from '../../store.jsx';
import StatusBadge from '../../components/StatusBadge.jsx';
import { ghs, fmtDateTime } from '../../lib/format.js';

function lastNDays(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
}

export default function Reports() {
  const { toast } = useApp();
  const [from, setFrom] = useState(lastNDays(30));
  const [to, setTo] = useState(new Date().toISOString().split('T')[0]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const load = () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    api
      .get(`/admin/reports?${params}`, { auth: true })
      .then(setData)
      .catch((e) => toast(e.message, 'error'))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const exportCsv = async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      const token = localStorage.getItem('ht_token');
      const res = await fetch(`/api/admin/reports/export?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `homely-treats-sales-${from || 'all'}-to-${to || 'all'}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast('CSV downloaded', 'success');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div>
      <h2 className="admin-title">Sales Reports</h2>

      <div className="admin-toolbar">
        <label className="muted small">From</label>
        <input type="date" className="form-input" value={from} onChange={(e) => setFrom(e.target.value)} />
        <label className="muted small">To</label>
        <input type="date" className="form-input" value={to} onChange={(e) => setTo(e.target.value)} />
        <button className="btn btn-secondary" onClick={load}>Generate</button>
        <button className="btn btn-primary" onClick={exportCsv} disabled={exporting}>
          {exporting ? 'Exporting…' : <><Download size={16} /> Export CSV</>}
        </button>
      </div>

      {loading ? (
        <div className="empty-state"><p>Generating report…</p></div>
      ) : data ? (
        <>
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-card-icon"><Coins size={26} /></div>
              <div className="stat-card-value">{ghs(data.revenue)}</div>
              <div className="stat-card-label">Revenue (paid)</div>
            </div>
            <div className="stat-card">
              <div className="stat-card-icon"><ClipboardList size={26} /></div>
              <div className="stat-card-value">{data.orderCount}</div>
              <div className="stat-card-label">Orders</div>
            </div>
            <div className="stat-card">
              <div className="stat-card-icon"><Receipt size={26} /></div>
              <div className="stat-card-value">{ghs(data.avgOrderValue)}</div>
              <div className="stat-card-label">Avg Order Value</div>
            </div>
          </div>

          <div className="section">
            <h3 className="form-heading">Top Products</h3>
            <table className="table">
              <thead>
                <tr><th>Product</th><th>Qty Sold</th><th>Revenue</th></tr>
              </thead>
              <tbody>
                {data.topProducts.map((p) => (
                  <tr key={p.name}>
                    <td>{p.name}</td>
                    <td>{p.qty}</td>
                    <td>{ghs(p.revenue)}</td>
                  </tr>
                ))}
                {data.topProducts.length === 0 && <tr><td colSpan="3" className="centered muted">No sales in this period</td></tr>}
              </tbody>
            </table>
          </div>

          <div className="section">
            <h3 className="form-heading">Orders in period ({data.orders.length})</h3>
            <table className="table">
              <thead>
                <tr><th>Order</th><th>Date</th><th>Customer</th><th>Zone</th><th>Total</th><th>Status</th></tr>
              </thead>
              <tbody>
                {data.orders.map((o) => (
                  <tr key={o.id}>
                    <td>{o.id}</td>
                    <td>{fmtDateTime(o.createdAt)}</td>
                    <td>{o.user?.fullName || o.guestName || 'Guest'}</td>
                    <td>{o.deliveryZone || '—'}</td>
                    <td>{ghs(o.total)}</td>
                    <td><StatusBadge status={o.status} /></td>
                  </tr>
                ))}
                {data.orders.length === 0 && <tr><td colSpan="6" className="centered muted">No orders in this period</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </div>
  );
}
