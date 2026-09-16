import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { ShieldCheck, FileText } from 'lucide-react';

/**
 * Privacy Policy and Terms of Service.
 *
 * IMPORTANT — before you go live, replace the bracketed placeholders with your
 * real business details (registered name, address, contact, and the date). The
 * wording below accurately describes what THIS software actually collects and
 * does; if you change how the app handles data, update this page too.
 */

const UPDATED = '[add the date you publish this]';
const BUSINESS = 'Homely Treats Service Limited';
const CONTACT = '[your email] · [your phone number]';
const ADDRESS = 'Airport Residential, Accra, Ghana';

function Shell({ title, icon: Icon, children }) {
  return (
    <div className="page">
      <div className="container">
        <div className="section legal">
          <div className="legal-head">
            <div className="legal-icon"><Icon size={26} /></div>
            <div>
              <h1 className="section-title" style={{ textAlign: 'left', marginBottom: 4 }}>{title}</h1>
              <p className="muted small">Last updated: {UPDATED}</p>
            </div>
          </div>
          {children}
          <div className="legal-foot">
            <Link to="/privacy" className="btn-link">Privacy Policy</Link>
            <span className="muted small">·</span>
            <Link to="/terms" className="btn-link">Terms of Service</Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Privacy() {
  return (
    <Shell title="Privacy Policy" icon={ShieldCheck}>
      <p>
        {BUSINESS} ("we", "us") bakes and delivers custom cakes, pastries and confectioneries in
        Accra. This policy explains what personal information our website and app collect, why we
        need it, and the choices you have. We handle personal data in line with Ghana's Data
        Protection Act, 2012 (Act 843).
      </p>

      <h2>What we collect</h2>
      <ul>
        <li><strong>Account details</strong> — your name, email address and phone number, plus a
          securely hashed password. We never store your password in readable form.</li>
        <li><strong>Order details</strong> — the items you order, cake size, flavour, icing,
          inscription, collection or delivery date, the delivery address you give us, and any
          design photo you upload.</li>
        <li><strong>Payment information</strong> — payments are processed by <strong>Paystack</strong>.
          We never see or store your card number or mobile-money PIN. We receive only a payment
          reference and whether the payment succeeded.</li>
        <li><strong>Order updates</strong> — a record of the messages we send you (email, SMS,
          WhatsApp) so you can see what was sent and when.</li>
        <li><strong>Basic technical data</strong> — IP address and timestamps, used to keep the
          service secure and prevent abuse.</li>
      </ul>

      <h2>How we use it</h2>
      <ul>
        <li>To bake, prepare and deliver your order, and to contact you about it.</li>
        <li>To send order updates by email, SMS and WhatsApp.</li>
        <li>To run loyalty points and let you review an order you received.</li>
        <li>To keep the service secure, prevent fraud, and meet our accounting obligations.</li>
      </ul>
      <p>
        We do not sell your personal information, and we do not use it for third-party advertising.
      </p>

      <h2>Who we share it with</h2>
      <p>We share only what is necessary, with:</p>
      <ul>
        <li><strong>Paystack</strong> — to process your payment.</li>
        <li><strong>Resend</strong> — to deliver order emails.</li>
        <li><strong>Our SMS and WhatsApp providers</strong> — to deliver order text messages.</li>
        <li><strong>Our delivery riders</strong> — the name, phone number and delivery address
          needed to hand over your order. Riders only see this after they accept your delivery.</li>
      </ul>

      <h2>How long we keep it</h2>
      <p>
        Order and payment records are kept for as long as we need them for accounting and tax
        purposes. Account details are kept while your account is open. Design photos you upload are
        kept with the order so we can bake it again for you.
      </p>

      <h2>Your choices</h2>
      <ul>
        <li>You can update your name, email, phone and password at any time in <strong>My Account</strong>.</li>
        <li>You can ask us for a copy of the personal information we hold about you.</li>
        <li>You can ask us to delete your account and personal information. We will remove what we
          are not legally required to keep (for example, paid invoices).</li>
        <li>You can ask us to stop sending promotional messages — you will still receive messages
          about orders you have placed.</li>
      </ul>

      <h2>Security</h2>
      <p>
        Passwords are hashed with bcrypt. Sessions use signed tokens that expire. Payment
        notifications from Paystack are cryptographically verified before we mark an order paid.
        Access to customer data in our admin portal is limited to staff accounts and every
        privileged action is logged.
      </p>

      <h2>Cookies and local storage</h2>
      <p>
        We use your browser's local storage to keep your cart and your signed-in session. We do not
        use third-party advertising cookies.
      </p>

      <h2>Children</h2>
      <p>
        Our service is intended for adults. If an order is placed for a child's celebration, the
        account and contact details belong to the adult placing the order.
      </p>

      <h2>Contact us</h2>
      <p>
        {BUSINESS}<br />{ADDRESS}<br />{CONTACT}
      </p>
      <p className="muted small">
        If you are not satisfied with our response, you may contact the Data Protection Commission
        of Ghana.
      </p>
    </Shell>
  );
}

export function Terms() {
  return (
    <Shell title="Terms of Service" icon={FileText}>
      <p>
        These terms cover orders placed with {BUSINESS} through this website or app. By placing an
        order you agree to them.
      </p>

      <h2>Placing an order</h2>
      <ul>
        <li>Custom cakes and pastries are made to order and require advance notice. The minimum
          notice period is shown at checkout.</li>
        <li>Your order is confirmed once we accept it. If we cannot bake it — for example, the date
          is fully booked — we will tell you and refund any payment in full.</li>
        <li>Please check your order carefully, especially the inscription, date and delivery
          address. Tell us immediately if something is wrong.</li>
      </ul>

      <h2>Prices and payment</h2>
      <ul>
        <li>Prices are in Ghana cedis (GH₵) and include the items you select. Delivery fees depend
          on your zone and are shown before you pay.</li>
        <li>Payment is by mobile money (MTN MoMo, AirtelTigo, Vodafone Cash), card via Paystack, or
          cash on delivery/pickup where that option is offered.</li>
        <li>Where a promo code applies, it is valid only under the conditions shown (minimum spend,
          expiry, and any per-customer limit).</li>
        <li>Loyalty points can be redeemed against an order up to the limit shown at checkout.
          Points have no cash value and cannot be transferred.</li>
      </ul>

      <h2>Changes and cancellations</h2>
      <ul>
        <li>You can cancel an order from your account until it is marked as being prepared. Once
          baking has started, ingredients are committed and the order can no longer be cancelled.</li>
        <li>If you cancel in time, any amount paid is refunded, and loyalty points you used are
          returned to your account.</li>
        <li>We may cancel and refund an order if the requested date cannot be met or if the order
          cannot be produced safely.</li>
      </ul>

      <h2>Delivery and collection</h2>
      <ul>
        <li>Delivery is available within the Accra zones listed at checkout. Please give an accurate
          address and a reachable phone number.</li>
        <li>Someone must be available to receive the order. If we cannot deliver because nobody is
          available or the address is incorrect, re-delivery may attract an additional fee.</li>
        <li>Risk passes to you once the order is handed over or collected.</li>
      </ul>

      <h2>Allergens and ingredients</h2>
      <ul>
        <li>Our products are made in a kitchen that handles <strong>wheat, eggs, dairy, nuts and
          soy</strong>. We cannot guarantee that any item is free from traces of these.</li>
        <li>Tell us about allergies or dietary requirements when you order. We will tell you
          honestly whether we can meet them.</li>
      </ul>

      <h2>Design, photos and reviews</h2>
      <ul>
        <li>Any design photo you upload is used only to bake your order. Please only upload photos
          you have the right to share.</li>
        <li>You keep ownership of a review you write and give us permission to show it on our site
          alongside your first name.</li>
      </ul>

      <h2>Your account</h2>
      <ul>
        <li>Keep your password private and tell us straight away if you think someone else has
          access to your account.</li>
        <li>We may suspend an account that is used fraudulently or abused.</li>
      </ul>

      <h2>Liability</h2>
      <p>
        We take great care with every order. Where something goes wrong, our responsibility is
        limited to the value of the affected order. Nothing in these terms limits rights you have
        under Ghanaian consumer law.
      </p>

      <h2>Changes to these terms</h2>
      <p>
        We may update these terms occasionally. The version in force is the one published on this
        page when you place your order.
      </p>

      <h2>Contact us</h2>
      <p>
        {BUSINESS}<br />{ADDRESS}<br />{CONTACT}
      </p>
    </Shell>
  );
}
