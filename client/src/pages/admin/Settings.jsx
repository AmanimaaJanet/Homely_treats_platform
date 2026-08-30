import React, { useEffect, useState } from 'react';
import { Key, MessageCircle } from 'lucide-react';
import { api } from '../../api.js';
import { useApp } from '../../store.jsx';

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
  const [s, setS] = useState(null);
  const [saving, setSaving] = useState(false);
  const [zones, setZones] = useState([]);
  const [newZone, setNewZone] = useState({ name: '', fee: '' });

  const loadZones = () => api.get('/admin/zones', { auth: true }).then((d) => setZones(d.zones)).catch(() => {});

  useEffect(() => {
    api.get('/admin/settings', { auth: true }).then((d) => setS(d.settings)).catch(() => {});
    loadZones();
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

  const addZone = async (e) => {
    e.preventDefault();
    if (!newZone.name.trim()) return;
    try {
      await api.post('/admin/zones', { name: newZone.name.trim(), fee: Number(newZone.fee || 0) }, { auth: true });
      setNewZone({ name: '', fee: '' });
      toast('Zone added', 'success');
      loadZones();
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const updateZone = async (id, patch) => {
    try {
      await api.put(`/admin/zones/${id}`, patch, { auth: true });
      loadZones();
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const deleteZone = async (id) => {
    if (!window.confirm('Delete this zone?')) return;
    await api.del(`/admin/zones/${id}`, { auth: true });
    toast('Zone deleted', 'success');
    loadZones();
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
        <div className="section-head-row">
          <h3 className="form-heading" style={{ margin: 0 }}>Delivery Zones (Accra)</h3>
        </div>
        <div className="form-row" style={{ marginBottom: '1rem' }}>
          <div className="form-group">
            <input className="form-input" placeholder="Zone name (e.g. Labadi)" value={newZone.name} onChange={(e) => setNewZone({ ...newZone, name: e.target.value })} />
          </div>
          <div className="form-group">
            <div className="promo-row">
              <input type="number" className="form-input" placeholder="Fee GH₵" value={newZone.fee} onChange={(e) => setNewZone({ ...newZone, fee: e.target.value })} />
              <button type="button" className="btn btn-secondary" onClick={addZone}>Add</button>
            </div>
          </div>
        </div>
        <table className="table">
          <thead><tr><th>Zone</th><th>Fee</th><th>Active</th><th></th></tr></thead>
          <tbody>
            {zones.map((z) => (
              <tr key={z.id}>
                <td>{z.name}</td>
                <td>
                  <input
                    type="number"
                    className="form-input zone-fee-input"
                    value={z.fee}
                    onChange={(e) => updateZone(z.id, { fee: Number(e.target.value) })}
                  />
                </td>
                <td>
                  <input type="checkbox" checked={z.active} onChange={(e) => updateZone(z.id, { active: e.target.checked })} />
                </td>
                <td><button type="button" className="btn-link danger" onClick={() => deleteZone(z.id)}>Delete</button></td>
              </tr>
            ))}
          </tbody>
        </table>
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
      </div>

      <div className="section">
        <h3 className="form-heading">Notifications</h3>
        <h4 className="form-heading small">SMS</h4>
        <Toggle label="SMS order updates (confirmation, status, ready)" checked={!!s.smsOrderConfirmed} onChange={(v) => set('smsOrderConfirmed', v)} />
        <h4 className="form-heading small">WhatsApp (Cloud API)</h4>
        <Toggle label="WhatsApp order updates" checked={!!s.enableWhatsapp} onChange={(v) => set('enableWhatsapp', v)} />
        <p className="muted small"><MessageCircle size={13} /> Configure <code>WHATSAPP_TOKEN</code> & <code>WHATSAPP_PHONE_NUMBER_ID</code> in <code>server/.env</code> (free test number available).</p>
        <h4 className="form-heading small">Email (Resend)</h4>
        <Toggle label="Email order updates (confirmation, receipt, status)" checked={!!s.emailOrderConfirmed} onChange={(v) => set('emailOrderConfirmed', v)} />
        <h4 className="form-heading small">Admin Alerts</h4>
        <Toggle label="Email the business when a new order is placed" checked={!!s.adminAlertNewOrder} onChange={(v) => set('adminAlertNewOrder', v)} />
      </div>

      <button className="btn btn-primary" disabled={saving} style={{ marginBottom: '2rem' }}>
        {saving ? 'Saving…' : 'Save All Settings'}
      </button>
    </form>
  );
}
