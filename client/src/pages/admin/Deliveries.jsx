import React, { useEffect, useState } from 'react';
import {
  Truck, Store, Clock, CalendarOff, Plus, Trash2, Save, CalendarDays, AlertTriangle,
} from 'lucide-react';
import { api } from '../../api.js';
import { useApp } from '../../store.jsx';
import { ghs } from '../../lib/format.js';

/**
 * Delivery operations (Admin → Deliveries).
 *
 * Four things the bakery changes as it grows: where it drives and for how much, how
 * many counters it has, which windows it promises, and which days it is shut. All four
 * are enforced at checkout — these screens are the single source of truth, not a
 * description of one.
 */
/** Readable names for the editable zone fields, used for the inputs' accessible names. */
const ZONE_FIELD_LABELS = {
  fee: 'Delivery fee',
  minOrder: 'Minimum basket',
  freeOver: 'Free delivery over',
  etaNote: 'Delivery note',
};

export default function Deliveries() {
  const { toast } = useApp();
  const [zones, setZones] = useState([]);
  const [locations, setLocations] = useState([]);
  const [slots, setSlots] = useState([]);
  const [blackouts, setBlackouts] = useState([]);
  const [calendar, setCalendar] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [newZone, setNewZone] = useState({ name: '', fee: '', minOrder: '', freeOver: '', etaNote: '' });
  const [newLocation, setNewLocation] = useState({ name: '', address: '', phone: '', hours: '', isDefault: false });
  const [newSlot, setNewSlot] = useState({ label: '', capacity: 6 });
  const [newBlackout, setNewBlackout] = useState({ date: '', reason: '' });

  const load = async () => {
    try {
      const [z, l, s, b, c] = await Promise.all([
        api.get('/admin/zones', { auth: true }),
        api.get('/admin/pickup-locations', { auth: true }),
        api.get('/admin/time-slots', { auth: true }),
        api.get('/admin/blackouts', { auth: true }),
        api.get('/admin/delivery-calendar?days=14', { auth: true }),
      ]);
      setZones(z.zones);
      setLocations(l.locations);
      setSlots(s.slots);
      setBlackouts(b.blackouts);
      setCalendar(c.calendar);
      setDrafts(
        Object.fromEntries(
          z.zones.map((zone) => [
            zone.id,
            {
              fee: zone.fee,
              minOrder: zone.minOrder ?? '',
              freeOver: zone.freeOver ?? '',
              etaNote: zone.etaNote || '',
            },
          ])
        )
      );
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const run = async (fn, success) => {
    try {
      await fn();
      toast(success, 'success');
      await load();
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const updateLocation = (location, patch) =>
    run(
      () => api.put(`/admin/pickup-locations/${location.id}`, patch, { auth: true }),
      'Counter updated.'
    );

  const saveZone = (zone) =>
    run(
      () => api.put(`/admin/zones/${zone.id}`, drafts[zone.id], { auth: true }),
      `${zone.name} updated.`
    );

  const addZone = () =>
    run(
      () => api.post('/admin/zones', newZone, { auth: true }).then(() => setNewZone({ name: '', fee: '', minOrder: '', freeOver: '', etaNote: '' })),
      'Delivery zone added.'
    );

  const toggleZone = (zone) =>
    run(() => api.put(`/admin/zones/${zone.id}`, { active: !zone.active }, { auth: true }), zone.active ? `${zone.name} hidden from checkout.` : `${zone.name} is delivering again.`);

  const removeZone = (zone) =>
    run(async () => {
      const res = await api.delete(`/admin/zones/${zone.id}`, { auth: true });
      if (res.deactivated) {
        toast(`${zone.name} has ${res.pastOrders} past orders — de-listed instead of deleted.`, 'success');
      }
    }, `${zone.name} removed.`);

  const addLocation = () =>
    run(
      () => api.post('/admin/pickup-locations', newLocation, { auth: true }).then(() => setNewLocation({ name: '', address: '', phone: '', hours: '', isDefault: false })),
      'Pickup counter added.'
    );

  const addSlot = () =>
    run(
      () => api.post('/admin/time-slots', newSlot, { auth: true }).then(() => setNewSlot({ label: '', capacity: 6 })),
      'Collection window added.'
    );

  const updateSlot = (slot, patch) =>
    run(() => api.put(`/admin/time-slots/${slot.id}`, patch, { auth: true }), 'Window updated.');

  const addBlackout = () =>
    run(
      () => api.post('/admin/blackouts', newBlackout, { auth: true }).then(() => setNewBlackout({ date: '', reason: '' })),
      'That day is now closed to orders.'
    );

  return (
    <div>
      <h2 className="admin-title">Deliveries &amp; Collection</h2>

      {/* ---------------------------------------------------------------- zones */}
      <div className="section">
        <h3 className="form-heading"><Truck size={15} /> Delivery zones and fees</h3>
        <p className="muted small">
          A minimum basket stops you driving across Accra for one cupcake; a free-over
          threshold gives customers a reason to add one more thing. Leave either blank for no rule.
        </p>

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Zone</th><th scope="col">Fee (GH₵)</th><th scope="col">Min basket</th><th scope="col">Free over</th><th scope="col">Note to customers</th><th scope="col">Active</th><th scope="col" />
              </tr>
            </thead>
            <tbody>
              {zones.map((z) => (
                <tr key={z.id}>
                  <td><strong>{z.name}</strong></td>
                  {['fee', 'minOrder', 'freeOver', 'etaNote'].map((field) => (
                    <td key={field}>
                      <input
                        className="form-input input-compact"
                        type={field === 'etaNote' ? 'text' : 'number'}
                        min={field === 'etaNote' ? undefined : 0}
                        // One row per zone: the name has to come from the row, not an id.
                        aria-label={`${ZONE_FIELD_LABELS[field]} — ${z.name}`}
                        placeholder={field === 'etaNote' ? 'e.g. Same-day before 4pm' : '—'}
                        value={drafts[z.id]?.[field] ?? ''}
                        onChange={(e) => setDrafts({ ...drafts, [z.id]: { ...drafts[z.id], [field]: e.target.value } })}
                      />
                    </td>
                  ))}
                  <td>
                    <label className="switch-inline">
                      <input type="checkbox" checked={z.active} onChange={() => toggleZone(z)} />
                    </label>
                  </td>
                  <td className="row-actions">
                    <button className="btn btn-secondary btn-sm" onClick={() => saveZone(z)}>
                      <Save size={14} /> Save
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={() => removeZone(z)} title="Remove zone">
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
              {zones.length === 0 && (
                <tr><td colSpan="7" className="centered muted">No zones yet — customers can only collect.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="inline-form">
          <input className="form-input" aria-label="New zone name" placeholder="New zone, e.g. Tema Community 25" value={newZone.name} onChange={(e) => setNewZone({ ...newZone, name: e.target.value })} />
          <input aria-label="Delivery fee for this zone" className="form-input input-compact" type="number" min="0" placeholder="Fee" value={newZone.fee} onChange={(e) => setNewZone({ ...newZone, fee: e.target.value })} />
          <input aria-label="Minimum basket for this zone" className="form-input input-compact" type="number" min="0" placeholder="Min basket" value={newZone.minOrder} onChange={(e) => setNewZone({ ...newZone, minOrder: e.target.value })} />
          <input aria-label="Free delivery over this amount" className="form-input input-compact" type="number" min="0" placeholder="Free over" value={newZone.freeOver} onChange={(e) => setNewZone({ ...newZone, freeOver: e.target.value })} />
          <input aria-label="Delivery note for this zone" className="form-input" placeholder="Note (optional)" value={newZone.etaNote} onChange={(e) => setNewZone({ ...newZone, etaNote: e.target.value })} />
          <button className="btn btn-primary btn-sm" onClick={addZone} disabled={!newZone.name}>
            <Plus size={14} /> Add zone
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------- pickup */}
      <div className="section">
        <h3 className="form-heading"><Store size={15} /> Pickup counters</h3>
        <p className="muted small">
          Shown at checkout when a customer chooses to collect. The default counter is preselected.
        </p>

        {locations.map((l) => (
          <div className="list-row" key={l.id}>
            <div>
              <strong>{l.name}</strong>
              {l.isDefault && <span className="status-pill approved" style={{ marginLeft: '8px' }}>Default</span>}
              {!l.active && <span className="status-pill hidden" style={{ marginLeft: '8px' }}>Hidden</span>}
              <p className="muted small">{l.address}{l.phone ? ` · ${l.phone}` : ''}{l.hours ? ` · ${l.hours}` : ''}</p>
            </div>
            <div className="row-actions">
              <button className="btn btn-ghost btn-sm" onClick={() => updateLocation(l, { isDefault: true })} disabled={l.isDefault}>
                Make default
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => updateLocation(l, { active: !l.active })}>
                {l.active ? 'Hide' : 'Show'}
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => run(() => api.delete(`/admin/pickup-locations/${l.id}`, { auth: true }), 'Counter removed.')}>
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
        {locations.length === 0 && (
          <p className="muted small">
            No counters yet — checkout falls back to your business address from Settings.
          </p>
        )}

        <div className="inline-form">
          <input aria-label="Counter name" className="form-input" placeholder="Counter name, e.g. Osu pop-up" value={newLocation.name} onChange={(e) => setNewLocation({ ...newLocation, name: e.target.value })} />
          <input aria-label="Counter address" className="form-input" placeholder="Full address" value={newLocation.address} onChange={(e) => setNewLocation({ ...newLocation, address: e.target.value })} />
          <input aria-label="Counter phone" className="form-input input-compact" placeholder="Phone" value={newLocation.phone} onChange={(e) => setNewLocation({ ...newLocation, phone: e.target.value })} />
          <input aria-label="Counter opening hours" className="form-input input-compact" placeholder="Hours" value={newLocation.hours} onChange={(e) => setNewLocation({ ...newLocation, hours: e.target.value })} />
          <button className="btn btn-primary btn-sm" onClick={addLocation} disabled={!newLocation.name || !newLocation.address}>
            <Plus size={14} /> Add counter
          </button>
        </div>
      </div>

      {/* -------------------------------------------------------------- slots */}
      <div className="section">
        <h3 className="form-heading"><Clock size={15} /> Collection / delivery windows</h3>
        <p className="muted small">
          Each window has a daily capacity. Once it's full for a date, checkout stops offering
          it — so the kitchen is never promised more cakes than it can finish that morning.
        </p>

        <div className="slot-manage">
          {slots.map((s) => (
            <div className="list-row" key={s.id}>
              <div>
                <strong>{s.label}</strong>
                {!s.active && <span className="status-pill hidden" style={{ marginLeft: '8px' }}>Off</span>}
                <p className="muted small">{s.capacity} orders per day</p>
              </div>
              <div className="row-actions">
                <input
                  className="form-input input-compact"
                  type="number"
                  min="1"
                  max="200"
                  aria-label={`Orders per day for the ${s.label} window`}
                  defaultValue={s.capacity}
                  onBlur={(e) => Number(e.target.value) !== s.capacity && updateSlot(s, { capacity: e.target.value })}
                />
                <button className="btn btn-ghost btn-sm" onClick={() => updateSlot(s, { active: !s.active })}>
                  {s.active ? 'Turn off' : 'Turn on'}
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => run(() => api.delete(`/admin/time-slots/${s.id}`, { auth: true }), 'Window removed.')}>
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
          {slots.length === 0 && (
            <p className="muted small">
              No windows yet. Until you add some, customers just pick a date and you confirm the time.
            </p>
          )}
        </div>

        <div className="inline-form">
          <input aria-label="Collection window label" className="form-input" placeholder="Window label, e.g. 9:00 – 11:00" value={newSlot.label} onChange={(e) => setNewSlot({ ...newSlot, label: e.target.value })} />
          <input aria-label="Orders per day for this window" className="form-input input-compact" type="number" min="1" max="200" value={newSlot.capacity} onChange={(e) => setNewSlot({ ...newSlot, capacity: e.target.value })} />
          <span className="muted small" style={{ alignSelf: 'center' }}>orders/day</span>
          <button className="btn btn-primary btn-sm" onClick={addSlot} disabled={!newSlot.label}>
            <Plus size={14} /> Add window
          </button>
        </div>
      </div>

      <div className="admin-grid-2">
        {/* ----------------------------------------------------------- blackouts */}
        <div className="section">
          <h3 className="form-heading"><CalendarOff size={15} /> Closed days</h3>
          <p className="muted small">
            Public holidays and maintenance days. Checkout refuses these dates, and the
            product page warns the customer as soon as they pick one.
          </p>

          <div className="blackout-list">
            {blackouts.map((b) => {
              const date = new Date(b.date).toISOString().slice(0, 10);
              return (
                <div className="list-row" key={b.id}>
                  <div>
                    <strong>{date}</strong>
                    {b.reason && <p className="muted small">{b.reason}</p>}
                  </div>
                  <button className="btn btn-ghost btn-sm" onClick={() => run(() => api.delete(`/admin/blackouts/${b.id}`, { auth: true }), 'That day is open again.')}>
                    <Trash2 size={14} /> Reopen
                  </button>
                </div>
              );
            })}
            {blackouts.length === 0 && <p className="muted small">Open every day.</p>}
          </div>

          <div className="inline-form">
            <input aria-label="Closed date" className="form-input" type="date" value={newBlackout.date} onChange={(e) => setNewBlackout({ ...newBlackout, date: e.target.value })} />
            <input aria-label="Reason the bakery is closed" className="form-input" placeholder="Reason (optional)" value={newBlackout.reason} onChange={(e) => setNewBlackout({ ...newBlackout, reason: e.target.value })} />
            <button className="btn btn-primary btn-sm" onClick={addBlackout} disabled={!newBlackout.date}>
              <Plus size={14} /> Close that day
            </button>
          </div>
        </div>

        {/* ----------------------------------------------------------- calendar */}
        <div className="section">
          <h3 className="form-heading"><CalendarDays size={15} /> Next 14 days</h3>
          <p className="muted small">What you have already promised, and how full each window is.</p>

          <div className="calendar-strip">
            {calendar.map((day) => {
              const full = day.slots.length > 0 && day.slots.every((s) => s.remaining === 0);
              return (
                <div className={`cal-day ${day.closed ? 'closed' : ''} ${full ? 'full' : ''}`} key={day.date}>
                  <span className="cal-date">{day.date.slice(5)}</span>
                  {day.closed ? (
                    <span className="cal-note">Closed</span>
                  ) : (
                    <>
                      <strong>{day.orders}</strong>
                      <span className="muted small">{ghs(day.value)}</span>
                      <div className="cal-slots">
                        {day.slots.map((s) => (
                          <span
                            key={s.label}
                            className={`cal-slot ${s.remaining === 0 ? 'full' : ''}`}
                            title={`${s.label}: ${s.booked}/${s.capacity} booked`}
                          >
                            {s.label.split(' – ')[0]} {s.booked}/{s.capacity}
                          </span>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>

          {calendar.some((d) => d.closed) && (
            <p className="muted small">
              <AlertTriangle size={13} /> Closed days are skipped by checkout automatically.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
