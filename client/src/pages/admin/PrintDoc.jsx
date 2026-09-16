import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { Printer, ArrowLeft, ImageIcon } from 'lucide-react';
import { api } from '../../api.js';
import { ghs } from '../../lib/format.js';
import { amountInWords } from '../../lib/words.js';

/**
 * Print views — the paper the kitchen and the counter actually use.
 *
 * Three documents, one page: a customer **receipt**, a **kitchen ticket** (big type,
 * the deadline at the top, the writing pulled out where it can't be missed) and the
 * **delivery note** (rider, address, what to collect). `?doc=` picks one, `?auto=1`
 * opens the browser's print dialog straight away — which is what a counter phone wants.
 *
 * Print styling lives in styles.css so it also reaches the printer from a build; the
 * rules hide the app chrome, keep line items from splitting across pages, and drop the
 * colours a cheap thermal printer would only smear.
 */

const money = (n) => ghs(Number(n || 0));

const stamp = (value) =>
  new Date(value).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });

const day = (value) =>
  value
    ? new Date(value).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })
    : '—';

export default function PrintDoc() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const doc = params.get('doc') || 'receipt';
  const auto = params.get('auto') === '1';

  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get(`/admin/orders/${id}/print?doc=${doc}`, { auth: true })
      .then(setData)
      .catch((err) => setError(err.message));
  }, [id, doc]);

  // Give the browser a moment to lay the page out before opening the dialog.
  useEffect(() => {
    if (!auto || !data) return;
    const t = setTimeout(() => window.print(), 400);
    return () => clearTimeout(t);
  }, [auto, data]);

  if (error) return <div className="empty-state"><p>{error}</p></div>;
  if (!data) return <div className="empty-state"><p>Preparing the document…</p></div>;

  const { order, shop, document: docLabel } = data;
  const isKitchen = doc === 'kitchen';
  const isDelivery = doc === 'delivery';
  const items = order.items || [];

  return (
    <div className="print-page">
      <div className="print-toolbar no-print">
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/admin/orders')}>
          <ArrowLeft size={15} /> Back to orders
        </button>
        <div className="row-actions">
          {[
            ['receipt', 'Receipt'],
            ['kitchen', 'Kitchen ticket'],
            ['delivery', 'Delivery note'],
          ].map(([key, label]) => (
            <button
              key={key}
              className={`btn btn-sm ${doc === key ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => navigate(`/admin/print/${id}?doc=${key}`)}
            >
              {label}
            </button>
          ))}
          <button className="btn btn-primary btn-sm" onClick={() => window.print()}>
            <Printer size={15} /> Print
          </button>
        </div>
      </div>

      <div className="print-sheet">
        <header className="print-head">
          <div>
            <h1>{shop.name}</h1>
            {shop.address && <p>{shop.address}</p>}
            {shop.phone && <p>{shop.phone}</p>}
            {shop.email && <p>{shop.email}</p>}
          </div>
          <div className="print-head-right">
            <h2>{docLabel}</h2>
            <p className="print-id">{order.id}</p>
            <p>{stamp(order.createdAt)}</p>
            <p className={`print-status ${order.status === 'CANCELLED' ? 'cancelled' : ''}`}>{order.status}</p>
          </div>
        </header>

        <hr />

        {isKitchen ? (
          <>
            {/* The kitchen's copy: what to bake, for when, and the writing that must not be missed. */}
            <div className="print-deadline">
              <span>Needed by</span>
              <strong>
                {day(order.readyDate)}
                {order.timeSlot ? ` · ${order.timeSlot}` : ''}
              </strong>
              <span className="print-mode">
                {order.deliveryMethod === 'DELIVERY' ? 'DELIVERY' : 'COLLECTION'}
              </span>
            </div>

            <table className="print-table kitchen">
              <thead>
                <tr>
                  <th style={{ width: '58px' }}>Qty</th>
                  <th>Bake this</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.id}>
                    <td className="qty">{it.quantity}×</td>
                    <td>
                      <strong>{it.name}</strong>
                      {it.size && <div>Size: {it.size}</div>}
                      {it.flavor && <div>Flavour: {it.flavor}</div>}
                      {it.icing && <div>Icing: {it.icing}</div>}
                      {it.inscription && <div className="print-inscription">Writing: “{it.inscription}”</div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {order.notes && (
              <div className="print-callout">
                <strong>Order notes</strong>
                <p>{order.notes}</p>
              </div>
            )}

            {order.photoCount > 0 && (
              <p className="print-words">
                <ImageIcon size={13} /> {order.photoCount} reference photo
                {order.photoCount === 1 ? '' : 's'} attached to this order — open it on screen to view.
              </p>
            )}
          </>
        ) : (
          <>
            <div className="print-parties">
              <div>
                <h3>Billed to</h3>
                <p><strong>{order.customer.name}</strong></p>
                {order.customer.email && <p>{order.customer.email}</p>}
                {order.customer.phone && <p>{order.customer.phone}</p>}
              </div>
              <div>
                <h3>{isDelivery ? 'Deliver to' : 'Collection'}</h3>
                {isDelivery ? (
                  <>
                    <p>{order.deliveryAddress || '—'}</p>
                    {order.deliveryZone && <p>Zone: {order.deliveryZone}</p>}
                    {order.riderName && <p>Rider: {order.riderName}{order.riderPhone ? ` · ${order.riderPhone}` : ''}</p>}
                  </>
                ) : (
                  <p>{order.pickupLocation || shop.address || 'Our shop'}</p>
                )}
                <p>
                  {isDelivery ? 'Delivery date: ' : 'Collect from: '}
                  {day(order.readyDate)}
                  {order.timeSlot ? ` · ${order.timeSlot}` : ''}
                </p>
              </div>
            </div>

            <table className="print-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th style={{ width: '52px' }} className="right">Qty</th>
                  <th style={{ width: '96px' }} className="right">Unit</th>
                  <th style={{ width: '104px' }} className="right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.id}>
                    <td>
                      {it.name}
                      {it.size && <span className="muted"> · {it.size}</span>}
                      {it.inscription && <div className="print-inscription">Writing: “{it.inscription}”</div>}
                    </td>
                    <td className="right">{it.quantity}</td>
                    <td className="right">{money(it.unitPrice)}</td>
                    <td className="right">{money(it.lineTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="print-totals">
              <div><span>Subtotal</span><span>{money(order.money.subtotal)}</span></div>
              {Number(order.money.deliveryFee) > 0 && (
                <div>
                  <span>Delivery{order.deliveryZone ? ` (${order.deliveryZone})` : ''}</span>
                  <span>{money(order.money.deliveryFee)}</span>
                </div>
              )}
              {Number(order.money.discount) > 0 && (
                <div className="credit">
                  <span>Discount{order.promoCode ? ` (${order.promoCode})` : ''}</span>
                  <span>−{money(order.money.discount)}</span>
                </div>
              )}
              {Number(order.money.loyaltyDiscount) > 0 && (
                <div className="credit">
                  <span>Loyalty points used ({order.pointsRedeemed})</span>
                  <span>−{money(order.money.loyaltyDiscount)}</span>
                </div>
              )}
              <div className="grand"><span>Total</span><span>{money(order.money.total)}</span></div>
            </div>

            <p className="print-words">
              <strong>Amount in words:</strong> {amountInWords(order.money.total)}
            </p>

            <div className="print-payment">
              <p>
                <strong>Payment:</strong> {order.paymentMethod} · {order.paymentStatus}
              </p>
              {order.paymentRef && <p><strong>Reference:</strong> {order.paymentRef}</p>}
              {order.pointsEarned > 0 && (
                <p><strong>Loyalty:</strong> {order.pointsEarned} points earned on this order</p>
              )}
              {order.refund && (
                <p>
                  <strong>Refunded:</strong> {money(order.refund.amount)}
                  {order.refund.reason ? ` — ${order.refund.reason}` : ''}
                </p>
              )}
              {order.notes && <p><strong>Notes:</strong> {order.notes}</p>}
              {isDelivery && (
                <p className="print-sign">
                  Received by ________________________  Signature ________________________
                </p>
              )}
            </div>
          </>
        )}

        <footer className="print-foot">
          <p>{shop.footer}</p>
          <p className="muted small">Printed {stamp(data.printedAt)} · {order.id}</p>
        </footer>
      </div>
    </div>
  );
}
