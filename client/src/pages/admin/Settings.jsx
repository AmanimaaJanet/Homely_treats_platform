import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Key, MessageCircle, Truck } from 'lucide-react';
import { api } from '../../api.js';
import { useApp } from '../../store.jsx';
import WhatsAppTemplates from '../../components/WhatsAppTemplates.jsx';
import AdminAccount from '../../components/AdminAccount.jsx';

function Toggle({ label, checked, onChange }) {
  return (
    <label className="check-row toggle">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

export default function Settings() {
  const { toast } = useApp();
  const navigate = useNavigate();
  const [s, setS] = useState(null);
  const [saving, setSaving] = useState(false);


  useEffect(() => {
    api.get('/admin/settings', { auth: true }).then((d) => setS(d.settings)).catch(() => {});
  }, []);

  if (!s) return <div className="empty-state"><p>Loading settings…</p></div>;

  const set = (k, v) => setS({ ...s, [k]: v });

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put('/admin/settings', s, { auth: true });
      toast('Settings saved', 'success');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };







  return (
    <form onSubmit={save}>
      <h2 className="admin-title">System Settings</h2>

      <div className="section">
        <h3 className="form-heading">Business Information</h3>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Business Name</label>
            <input className="form-input" value={s.businessName} onChange={(e) => set('businessName', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input className="form-input" value={s.businessEmail} onChange={(e) => set('businessEmail', e.target.value)} />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Phone Number</label>
            <input className="form-input" value={s.businessPhone} onChange={(e) => set('businessPhone', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Business Address</label>
            <input className="form-input" value={s.businessAddress} onChange={(e) => set('businessAddress', e.target.value)} />
          </div>
        </div>
      </div>

      <div className="section">
        <h3 className="form-heading">Order & Delivery Settings</h3>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Min. Lead Time (days)</label>
            <input type="number" className="form-input" value={s.minLeadDays} onChange={(e) => set('minLeadDays', parseInt(e.target.value || '2', 10))} />
          </div>
          <div className="form-group">
            <label className="form-label">Default Delivery Fee (GH₵)</label>
            <input type="number" className="form-input" value={s.deliveryFee} onChange={(e) => set('deliveryFee', parseInt(e.target.value || '0', 10))} />
          </div>
        </div>
        <Toggle label="Accept Online Orders" checked={!!s.acceptOrders} onChange={(v) => set('acceptOrders', v)} />
        <Toggle label="Enable Pickup Option" checked={!!s.allowPickup} onChange={(v) => set('allowPickup', v)} />
      </div>

      <div className="section">
        <h3 className="form-heading">Delivery &amp; collection</h3>
        <p className="muted small">
          Zone fees and rules (minimum basket, free delivery over), pickup counters,
          collection windows with daily capacity, and closed days all live on the{' '}
          <strong>Deliveries</strong> screen.
        </p>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => navigate('/admin/deliveries')}>
          <Truck size={14} /> Open Deliveries
        </button>
      </div>

      <div className="section">
        <h3 className="form-heading">Payment Methods</h3>
        <Toggle label="MTN Mobile Money" checked={!!s.enableMomo} onChange={(v) => set('enableMomo', v)} />
        <Toggle label="AirtelTigo Money" checked={!!s.enableAtl} onChange={(v) => set('enableAtl', v)} />
        <Toggle label="Card Payments (Visa / Mastercard)" checked={!!s.enableCard} onChange={(v) => set('enableCard', v)} />
        <Toggle label="Cash on Delivery / Pickup" checked={!!s.enableCod} onChange={(v) => set('enableCod', v)} />
        <p className="muted small">
          <Key size={13} /> Paystack keys are configured in <code>server/.env</code>. With keys set, payments go through Paystack's live
          checkout (MTN MoMo, AirtelTigo, Vodafone Cash & cards). Without keys, the app runs in simulated-payment demo mode.
        </p>
      </div>

      <div className="section">
        <h3 className="form-heading">Loyalty & Reviews</h3>
        <Toggle label="Enable Loyalty Points (1 pt per GH₵ 1 · 20 pts = GH₵ 1)" checked={!!s.enableLoyalty} onChange={(v) => set('enableLoyalty', v)} />
        <Toggle label="Enable Customer Reviews (+5 pts per review)" checked={!!s.enableReviews} onChange={(v) => set('enableReviews', v)} />
        <Toggle
          label="Publish reviews immediately"
          checked={s.autoApproveReviews !== false}
          onChange={(v) => set('autoApproveReviews', v)}
        />
        <p className="muted small">
          Switch this off to hold every new review in Admin → Reviews until you approve it.
        </p>
      </div>

      <div className="section">
        <h3 className="form-heading">Notifications</h3>
        <h4 className="form-heading small">SMS</h4>
        <Toggle label="SMS order updates (confirmation, status, ready)" checked={!!s.smsOrderConfirmed} onChange={(v) => set('smsOrderConfirmed', v)} />
        <h4 className="form-heading small">WhatsApp (Cloud API)</h4>
        <Toggle label="WhatsApp order updates" checked={!!s.enableWhatsapp} onChange={(v) => set('enableWhatsapp', v)} />
        <Toggle
          label="Send approved templates (recommended — required outside the 24-hour window)"
          checked={s.whatsappTemplates !== false}
          onChange={(v) => set('whatsappTemplates', v)}
        />
        <p className="muted small">
          <MessageCircle size={13} /> With this off, WhatsApp sends plain text, which only works within 24 hours
          of the customer's last message.
        </p>
        <h4 className="form-heading small">Email (Resend)</h4>
        <Toggle label="Email order updates (confirmation, receipt, status)" checked={!!s.emailOrderConfirmed} onChange={(v) => set('emailOrderConfirmed', v)} />
        <h4 className="form-heading small">Admin Alerts</h4>
        <Toggle label="Email the business when a new order is placed" checked={!!s.adminAlertNewOrder} onChange={(v) => set('adminAlertNewOrder', v)} />
        <Toggle
          label="Email a daily low-stock digest"
          checked={s.lowStockAlerts !== false}
          onChange={(v) => set('lowStockAlerts', v)}
        />
        <label className="form-label" style={{ marginTop: '10px', maxWidth: '320px' }}>
          Reorder threshold
          <span className="muted small">
            {' '}— products at or below this stock level appear on the dashboard and in the digest
          </span>
        </label>
        <input
          className="form-input"
          type="number"
          min="0"
          max="999"
          style={{ maxWidth: '160px' }}
          value={s.lowStockThreshold ?? 5}
          onChange={(e) => set('lowStockThreshold', Math.max(0, Number(e.target.value) || 0))}
        />
      </div>

      <WhatsAppTemplates />

      <AdminAccount />

      <button className="btn btn-primary" disabled={saving} style={{ marginBottom: '2rem' }}>
        {saving ? 'Saving…' : 'Save All Settings'}
      </button>
    </form>
  );
}
