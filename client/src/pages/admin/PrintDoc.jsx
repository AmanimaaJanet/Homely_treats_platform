import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { Printer, ArrowLeft, ReceiptText, ChefHat } from 'lucide-react';
import { api } from '../../api.js';
import { ghs, fmtDate, fmtDateTime } from '../../lib/format.js';

/**
 * Printable documents for an order: the customer receipt and the kitchen ticket.
 *
 * Both render from a single payload (/admin/orders/:id/print) so the printout can
 * be built with no extra round-trips once the preview is open. The page lives
 * inside the admin layout so it inherits the admin auth guard and sidebar, but
 * everything except the sheet is hidden by `@media print`, and the sheet itself is
 * laid out in millimetres so it lands correctly on A5/A4.
 *
 * URL: /admin/print/HT-20260916-0001?doc=receipt|ticket  (add &auto=1 to print at once)
 */

const PAYMENT_LABELS = {
  MOMO: 'Mobile Money',
  ATL: 'Telecel Cash',
  CARD: 'Card',
  COD: 'Cash on delivery',
};

const ONES = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen',
];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

/** 1234 -> "one thousand two hundred and thirty-four". Receipts read better with words. */
function numberToWords(n) {
  const num = Math.floor(Math.abs(Number(n) || 0));
  if (num < 20) return ONES[num];
  if (num < 100) {
    const t = TENS[Math.floor(num / 10)];
    return num % 10 ? `${t}-${ONES[num % 10]}` : t;
  }
  if (num < 1000) {
    const rest = num % 100;
    return `${ONES[Math.floor(num / 100)]} hundred${rest ? ` and ${numberToWords(rest)}` : ''}`;
  }
  if (num < 1000000) {
    const rest = num % 1000;
    return `${numberToWords(Math.floor(num / 1000))} thousand${rest ? ` ${numberToWords(rest)}` : ''}`;
  }
  const rest = num % 1000000;
  return `${numberToWords(Math.floor(num / 1000000))} million${rest ? ` ${numberToWords(rest)}` : ''}`;
}

function amountInWords(amount) {
  const total = Number(amount || 0);
  const cedis = Math.floor(total);
  const pesewas = Math.round((total - cedis) * 100);
  const cediWord = `${numberToWords(cedis)} cedi${cedis === 1 ? '' : 's'}`;
  if (!pesewas) return `${cediWord} only`;
  return `${cediWord} and ${numberToWords(pesewas)} pesewa${pesewas === 1 ? '' : 's'} only`;
}

function optionsOf(item) {
  return [item.size, item.flavor, item.icing].filter(Boolean).join(' · ');
}

function customerOf(order) {
  return {
    name: order.user?.fullName || order.guestName || 'Guest',
    phone: order.user?.phone || order.guestPhone || '—',
    email: order.user?.email || order.guestEmail || '—',
  };
}

export default function PrintDoc() {
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const doc = params.get('doc') === 'ticket' ? 'ticket' : 'receipt';
  const auto = params.get('auto') === '1';

  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get(`/admin/orders/${encodeURIComponent(id)}/print`, { auth: true })
      .then(setData)
      .catch((err) => setError(err.message));
  }, [id]);

  // ?auto=1 prints as soon as the sheet is ready — handy for a "Print" button that
  // opens a fresh tab, and it keeps the browser's own print preview working.
  useEffect(() => {
    if (!data || !auto) return;
    const t = setTimeout(() => window.print(), 350);
    return () => clearTimeout(t);
  }, [data, auto]);

  if (error) {
    return (
      <div className="empty-state">
        <p>{error}</p>
        <button className="btn btn-secondary" onClick={() => navigate('/admin/orders')}>
          Back to orders
        </button>
      </div>
    );
  }
  if (!data) return <div className="empty-state"><p>Preparing document…</p></div>;

  const { order, business, printedAt } = data;
  const customer = customerOf(order);
  const isTicket = doc === 'ticket';
  const title = isTicket ? 'Kitchen Ticket' : 'Receipt';
  const paid = ['PAID', 'SIMULATED', 'COD'].includes(order.paymentStatus);

  return (
    <div className="print-page">
      {/* Screen-only toolbar — never printed */}
      <div className="print-toolbar no-print">
        <button className="btn btn-secondary btn-sm" onClick={() => navigate('/admin/orders')}>
          <ArrowLeft size={15} /> Orders
        </button>
        <div className="print-tabs">
          <button
            className={`print-tab ${!isTicket ? 'active' : ''}`}
            onClick={() => setParams({ doc: 'receipt' })}
          >
            <ReceiptText size={15} /> Customer receipt
          </button>
          <button
            className={`print-tab ${isTicket ? 'active' : ''}`}
            onClick={() => setParams({ doc: 'ticket' })}
          >
            <ChefHat size={15} /> Kitchen ticket
          </button>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => window.print()}>
          <Printer size={15} /> Print {title.toLowerCase()}
        </button>
      </div>

      <div className={`print-sheet ${isTicket ? 'print-ticket' : 'print-receipt'}`}>
        {/* ---------------------------------------------------------------- */}
        <header className="print-head">
          <div>
            <h1>{business.name}</h1>
            <p className="print-sub">
              {business.address}
              {business.phone ? ` · ${business.phone}` : ''}
              {business.email ? ` · ${business.email}` : ''}
            </p>
          </div>
          <div className="print-head-right">
            <span className="print-doc-type">{title}</span>
            <span className="print-doc-id">{order.id}</span>
          </div>
        </header>

        <div className="print-meta">
          <div>
            <span className="print-label">Received / issued</span>
            <strong>{fmtDateTime(printedAt)}</strong>
          </div>
          <div>
            <span className="print-label">{isTicket ? 'Needed by' : 'Ready date'}</span>
            <strong>{fmtDate(order.readyDate)}</strong>
          </div>
          <div>
            <span className="print-label">Fulfilment</span>
            <strong>{order.deliveryMethod === 'DELIVERY' ? 'Delivery' : 'Pickup'}</strong>
          </div>
          <div>
            <span className="print-label">Order status</span>
            <strong>{order.status.replace(/_/g, ' ')}</strong>
          </div>
        </div>

        {!isTicket && (
          <div className="print-parties">
            <div>
              <span className="print-label">Customer</span>
              <strong>{customer.name}</strong>
              <span>{customer.phone}</span>
              <span>{customer.email}</span>
            </div>
            <div>
              <span className="print-label">
                {order.deliveryMethod === 'DELIVERY' ? 'Deliver to' : 'Collection point'}
              </span>
              {order.deliveryMethod === 'DELIVERY' ? (
                <>
                  <strong>{order.deliveryAddress}</strong>
                  {order.deliveryZone ? <span>Zone: {order.deliveryZone}</span> : null}
                </>
              ) : (
                <strong>{business.name}, {business.address}</strong>
              )}
              {order.riderName ? <span>Rider: {order.riderName} ({order.riderPhone})</span> : null}
            </div>
          </div>
        )}

        <table className="print-table">
          <thead>
            <tr>
              <th className="print-col-qty">Qty</th>
              <th>Item</th>
              {!isTicket && <th className="print-col-money">Unit</th>}
              {!isTicket && <th className="print-col-money">Amount</th>}
            </tr>
          </thead>
          <tbody>
            {order.items.map((item) => (
              <tr key={item.id}>
                <td className="print-col-qty print-qty">{item.quantity}</td>
                <td>
                  <strong>{item.name}</strong>
                  {optionsOf(item) ? <span className="print-opt">{optionsOf(item)}</span> : null}
                  {item.inscription ? (
                    <span className="print-inscription">Inscription: “{item.inscription}”</span>
                  ) : null}
                </td>
                {!isTicket && <td className="print-col-money">{ghs(item.price)}</td>}
                {!isTicket && (
                  <td className="print-col-money">{ghs(item.price * item.quantity)}</td>
                )}
              </tr>
            ))}
          </tbody>
        </table>

        {!isTicket && (
          <>
            <div className="print-totals">
              <div className="print-total-row">
                <span>Subtotal</span>
                <span>{ghs(order.subtotal)}</span>
              </div>
              {order.deliveryFee > 0 && (
                <div className="print-total-row">
                  <span>Delivery{order.deliveryZone ? ` — ${order.deliveryZone}` : ''}</span>
                  <span>{ghs(order.deliveryFee)}</span>
                </div>
              )}
              {order.discount > 0 && (
                <div className="print-total-row">
                  <span>Discount{order.promoCode ? ` (${order.promoCode})` : ''}</span>
                  <span>−{ghs(order.discount)}</span>
                </div>
              )}
              {order.loyaltyDiscount > 0 && (
                <div className="print-total-row">
                  <span>Loyalty points ({order.pointsRedeemed} pts)</span>
                  <span>−{ghs(order.loyaltyDiscount)}</span>
                </div>
              )}
              <div className="print-total-row print-grand-total">
                <span>Total</span>
                <span>{ghs(order.total)}</span>
              </div>
              <p className="print-words">In words: {amountInWords(order.total)}</p>
            </div>

            <div className="print-payment">
              <div>
                <span className="print-label">Payment method</span>
                <strong>{PAYMENT_LABELS[order.paymentMethod] || order.paymentMethod}</strong>
              </div>
              <div>
                <span className="print-label">Payment status</span>
                <strong>{paid ? order.paymentStatus : 'Not yet paid'}</strong>
              </div>
              {order.paymentRef ? (
                <div>
                  <span className="print-label">Reference</span>
                  <strong className="print-mono">{order.paymentRef}</strong>
                </div>
              ) : null}
            </div>
          </>
        )}

        {isTicket && order.notes ? (
          <div className="print-notes">
            <span className="print-label">Notes for the kitchen</span>
            <p>{order.notes}</p>
          </div>
        ) : null}

        {isTicket && order.deliveryMethod === 'DELIVERY' ? (
          <p className="print-foot-note">
            Deliver to: {order.deliveryAddress}
            {order.deliveryZone ? ` (${order.deliveryZone})` : ''} — contact {customer.name} on {customer.phone}
          </p>
        ) : null}

        <footer className="print-foot">
          {isTicket ? (
            <span>Print two copies: one for the bench, one for packing. Write the order number on every box.</span>
          ) : (
            <>
              <span>
                Thank you for choosing {business.name}. This receipt was generated on{' '}
                {fmtDateTime(printedAt)} for order {order.id}.
              </span>
              <span>Questions? Call {business.phone || business.email}.</span>
            </>
          )}
        </footer>
      </div>
    </div>
  );
}
