import React, { useEffect, useState } from 'react';
import {
  Coins, ClipboardList, Receipt, Download, RotateCcw, Users, Repeat, Truck, Star,
  CreditCard, CalendarDays, TrendingUp,
} from 'lucide-react';
import { ColumnChart, BarList, LineChart } from '../../components/MiniChart.jsx';
import { api } from '../../api.js';
import { useApp } from '../../store.jsx';
import StatusBadge from '../../components/StatusBadge.jsx';
import { ghs, fmtDateTime } from '../../lib/format.js';

function lastNDays(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
}

const today = () => new Date().toISOString().split('T')[0];

/** Quick ranges, because nobody wants to type two dates to see last week. */
const PRESETS = [
  { label: '7 days', from: () => lastNDays(7), to: today },
  { label: '30 days', from: () => lastNDays(30), to: today },
  { label: '90 days', from: () => lastNDays(90), to: today },
  {
    label: 'This month',
    from: () => `${new Date().toISOString().slice(0, 7)}-01`,
    to: today,
  },
  {
    label: 'Last month',
    from: () => {
      const d = new Date();
      d.setDate(1);
      d.setMonth(d.getMonth() - 1);
      return d.toISOString().split('T')[0];
    },
    to: () => {
      const d = new Date();
      d.setDate(0);
      return d.toISOString().split('T')[0];
    },
  },
];

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

      <div className="row-actions" style={{ marginBottom: '14px', flexWrap: 'wrap' }}>
        {PRESETS.map((p) => (
          <button
            key={p.label}
            className={`btn btn-sm ${from === p.from() && to === p.to() ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => {
              setFrom(p.from());
              setTo(p.to());
            }}
          >
            {p.label}
          </button>
        ))}
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
              <div className="stat-card-icon"><RotateCcw size={26} /></div>
              <div className="stat-card-value">{ghs(data.refunds?.total || 0)}</div>
              <div className="stat-card-label">Refunded</div>
              <p className="trend-warn">
                {data.refunds?.count
                  ? `${data.refunds.count} order${data.refunds.count === 1 ? '' : 's'} · excluded from revenue`
                  : 'Nothing refunded in this range'}
              </p>
            </div>
            <div className="stat-card">
              <div className="stat-card-icon"><Receipt size={26} /></div>
              <div className="stat-card-value">{ghs(data.avgOrderValue)}</div>
              <div className="stat-card-label">Avg Order Value</div>
            </div>
          </div>

          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-card-icon"><Users size={26} /></div>
              <div className="stat-card-value">{data.analytics?.repeat?.customers ?? 0}</div>
              <div className="stat-card-label">Customers</div>
              <p className="muted small">
                {data.analytics?.repeat?.repeatCustomers ?? 0} came back
              </p>
            </div>
            <div className="stat-card">
              <div className="stat-card-icon"><Repeat size={26} /></div>
              <div className="stat-card-value">{data.analytics?.repeat?.repeatRate ?? 0}%</div>
              <div className="stat-card-label">Repeat rate</div>
              <p className="muted small">
                {(data.analytics?.repeat?.repeatRate ?? 0) >= 30
                  ? 'Strong — the cakes are bringing people back'
                  : 'Room to grow: a loyalty nudge after delivery helps'}
              </p>
            </div>
            <div className="stat-card">
              <div className="stat-card-icon"><Truck size={26} /></div>
              <div className="stat-card-value">{ghs(data.analytics?.totals?.deliveryFees || 0)}</div>
              <div className="stat-card-label">Delivery collected</div>
              <p className="muted small">{data.analytics?.byZone?.length || 0} zones/collection</p>
            </div>
            <div className="stat-card">
              <div className="stat-card-icon"><TrendingUp size={26} /></div>
              <div className="stat-card-value">{ghs(data.analytics?.totals?.discountGiven || 0)}</div>
              <div className="stat-card-label">Discounts given</div>
              <p className="muted small">Promos + loyalty points</p>
            </div>
          </div>

          <div className="section">
            <h3 className="form-heading"><CalendarDays size={16} /> Revenue by day</h3>
            <ColumnChart data={data.analytics?.byDay || []} />
            <p className="muted small">
              {(data.analytics?.byDay || []).length} trading day
              {(data.analytics?.byDay || []).length === 1 ? '' : 's'} ·
              cancelled orders are counted in demand, not revenue
            </p>
          </div>

          <div className="report-grid">
            <div className="section">
              <h3 className="form-heading"><Truck size={16} /> Revenue by zone</h3>
              <BarList
                data={data.analytics?.byZone || []}
                labelKey="zone"
                valueKey="revenue"
                secondary={(z) => `${z.orders} order${z.orders === 1 ? '' : 's'}`}
              />
            </div>
            <div className="section">
              <h3 className="form-heading"><CreditCard size={16} /> How people paid</h3>
              <BarList
                data={data.analytics?.byPayment || []}
                labelKey="method"
                valueKey="orders"
                format={(n) => `${n} order${n === 1 ? '' : 's'}`}
                secondary={(p) => ghs(p.revenue)}
              />
            </div>
            <div className="section">
              <h3 className="form-heading"><CalendarDays size={16} /> Busiest days</h3>
              <BarList
                data={[...(data.analytics?.byWeekday || [])].sort((a, b) => b.orders - a.orders)}
                labelKey="weekday"
                valueKey="orders"
                format={(n) => `${n} order${n === 1 ? '' : 's'}`}
                secondary={(d) => ghs(d.revenue)}
              />
            </div>
            <div className="section">
              <h3 className="form-heading"><Star size={16} /> 12-month revenue</h3>
              <LineChart data={data.trend || []} />
            </div>
          </div>

          {(data.analytics?.bySlot || []).length > 0 && (
            <div className="section">
              <h3 className="form-heading">Windows people choose</h3>
              <BarList
                data={data.analytics?.bySlot || []}
                labelKey="slot"
                valueKey="orders"
                format={(n) => `${n} order${n === 1 ? '' : 's'}`}
              />
            </div>
          )}

          <div className="section">
            <h3 className="form-heading">Top Products</h3>
            <table className="table">
              <thead>
                <tr><th>Product</th><th>Qty Sold</th><th>Revenue</th><th>Share of sales</th><th>Orders</th></tr>
              </thead>
              <tbody>
                {(data.analytics?.products || data.topProducts).map((p) => (
                  <tr key={p.name}>
                    <td>{p.name}</td>
                    <td>{p.qty}</td>
                    <td>{ghs(p.revenue)}</td>
                    <td>{p.share !== undefined ? `${p.share}%` : '—'}</td>
                    <td>{p.orders ?? '—'}</td>
                  </tr>
                ))}
                {(data.analytics?.products || data.topProducts).length === 0 && (
                  <tr><td colSpan="5" className="centered muted">No sales in this period</td></tr>
                )}
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
