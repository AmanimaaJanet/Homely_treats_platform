# Remaining Work — Gap Analysis & Roadmap

_Audited 16 September 2026 against the running codebase._

> **Status update — P0 complete, Phase 2 under way.** All ten P0 items are
> **built, tested and committed**: rider auth, stock control, password reset,
> email-verification policy, review limits, audit log, promo controls, legal pages,
> httpOnly cookie sessions with CSRF protection, and opt-in Turnstile bot
> protection. **Product photos (P1 #11) have also shipped.** See "Build progress"
> at the bottom for exactly what landed.

## Where the app stands today

**Done and working:** storefront (home, menu, custom order, cart, checkout, tracking),
accounts + email verification, Paystack integration (MoMo / AirtelTigo / Vodafone / card)
with a cash-on-delivery fallback, delivery zones with per-neighbourhood fees, loyalty
points, order reviews, email + SMS + WhatsApp notifications, real-time WebSocket
tracking, rider app, full admin portal (dashboard, orders, products, customers, promos,
reports + CSV, settings), PWA install, and the hardened security baseline.

The gaps below are what's left. They're ordered by **what actually blocks taking real
money**, not by how interesting they are to build.

---

## P0 — Must fix before taking real customer money

### 1. Rider endpoints are completely unauthenticated 🔴 _security_
`/api/rider/*` has **no auth at all**. Anyone who knows the URL can list every
delivery — customer names, phone numbers, home addresses, order values — accept a
delivery under any name, and mark orders delivered (which fires customer
notifications and awards loyalty points).
**Build:** a `RIDER` role with rider accounts created by the admin, rider login, auth +
role checks on every rider endpoint, only their own accepted jobs plus unassigned
`READY` deliveries, and no customer address/phone revealed until the rider accepts the
job. _Effort: M._

### 2. Stock never decreases 🔴 _correctness_
Orders check `inStock` but never decrement `stock`, so you can oversell without limit —
and the admin "low stock" panel never changes from real sales.
**Build:** atomic stock decrement inside the order transaction, restore on
cancellation, block orders that exceed available stock, and stamp "sold out" when it
hits zero. _Effort: M._

### 3. No password reset 🔴 _customer lockout_
A customer who forgets their password is locked out forever — there's no
forgot-password route at all.
**Build:** `/auth/forgot-password` + `/auth/reset-password` with a single-use,
30-minute, **hashed** token, rate-limited, Resend email, and no account enumeration
(always respond OK, whether or not the email exists). _Effort: S._

### 4. Email verification is never enforced 🟠 _abuse / fake accounts_
Verification emails are sent and can be confirmed, but nothing requires it — so
throwaway addresses can register, order, and earn loyalty points.
**Build:** require a verified email to sign in to an account (guest checkout still
works), plus a friendly "resend verification" prompt. _Effort: S._

### 5. Reviews — spam limits and moderation ✅ **SHIPPED**
`POST /api/reviews` is limited to 10 submissions per hour per IP, one review per
delivered order, and reviews now carry a moderation status: **PENDING / APPROVED /
HIDDEN**. With "Publish reviews immediately" on (the default) a review appears at once;
switch it off in Settings and every new review waits in **Admin → Reviews**, which shows
Awaiting review / Published / Hidden with counts and Publish, Hide and Re-queue actions.
Only approved reviews reach the storefront or the public rating, and hiding keeps the
row rather than destroying it — the difference between moderating and deleting. The
customer keeps their bonus points either way, and the sidebar badge shows how many
reviews are waiting so nothing sits unnoticed. _Still to consider: a reply field and a
"verified purchase" badge._

### 6. No audit log for admin actions 🟠 _accountability_
Nothing records who changed a price, cancelled an order, marked something delivered,
or changed settings. With multiple staff accounts you can't investigate a dispute.
**Build:** append-only `AuditLog` (actor, action, entity, before/after, IP, time) +
a filterable admin screen. _Effort: M._

### 7. Promo codes have no abuse controls 🟠
Expiry and total usage limits work, but there's no **minimum spend**, no
**per-customer limit**, and no "first order only" rule — so a leaked code can be used
by one person indefinitely (unlimited-use codes).
**Build:** `minSpend`, `perCustomerLimit`, `firstOrderOnly`, and usage counted against
the customer, not just globally. _Effort: S._

### 8. No privacy policy, terms, or account deletion 🟠 _legal_
You're taking payments and storing names, phones and addresses. Ghana's Data
Protection Act 2012 expects a published privacy notice, and customers expect the
right to see/delete their data.
**Build:** Privacy Policy + Terms pages (with real, accurate wording — no
placeholders), cookie/consent note, and "delete my account" + "download my data" in
the customer account area. _Effort: M._

### 9. Session tokens live in `localStorage` 🟠 _XSS exposure_
The JWT is readable by any script that gets injected; the CSP reduces that risk but
doesn't remove it.
**Build:** move sessions to `httpOnly` + `Secure` + `SameSite` cookies with CSRF
protection for state-changing requests (keeping Bearer support for the rider/API
clients). _Effort: M._

### 10. No bot protection on register / forgot-password 🟡
Rate limits help, but nothing stops scripted signups, which burn your Resend quota and
SMS credits.
**Build:** Cloudflare Turnstile (free) on register + forgot-password. _Effort: S._

---

## P1 — Commercial essentials (needed to actually run the bakery)

### 11. Product photos and galleries — ✅ **SHIPPED**
Products now carry an `images[]` gallery (`images[0]` is the cover). Admins upload up
to 8 photos per product (JPG/PNG, 5 MB each) with reorder, set-cover and delete
controls; photos work on local disk or Cloudinary. Storefront cards show the cover,
and the custom-order page has a swipeable gallery with thumbnails, arrow controls and
a counter. Products without photos fall back to their Lucide icon, so nothing looks
broken. Uploads are validated server-side: only same-origin storage paths or
Cloudinary URLs are accepted, so an injected external URL or a path-traversal attempt
is discarded. The bundled bakery stills from your footage now illustrate the sample
croissant and fruit-tart products.

### 12. WhatsApp message templates — ✅ **SHIPPED**
WhatsApp only allows free-form text within 24 hours of the customer's last message;
every other update must use a Meta-approved template. Eight templates now ship in a
registry (`server/src/services/whatsappTemplates.js`) covering confirmed, payment
received, being prepared, ready, out for delivery, delivered, cancelled and refunded —
each with its exact name, language, category, ordered variables and body text. The app
sends templates by default and treats the old plain text as a **fallback**: if Meta
refuses a template (still in review, renamed, parameter mismatch) the refusal is logged
with Meta's own wording and the message is retried as plain text, which succeeds if the
customer messaged recently. If that fails too, the notification is logged FAILED — SMS
and email still carry the news.

**Admin → Settings → WhatsApp templates** lists every template with a copy button for
the body text, the variable order, a sample rendering of the message the customer sees,
and a **test send** to any number that reports Meta's response verbatim. Nothing needs
a WhatsApp account to try it: without credentials the panel says *Not connected* and
every send is simulated in the console. Full setup steps — including what to paste into
Meta Business Manager — are in **[WHATSAPP_TEMPLATES.md](WHATSAPP_TEMPLATES.md)**.

### 13. Automatic low-stock alerts — ✅ **SHIPPED**
A reorder threshold (default 5, editable in Settings) drives everything. The dashboard
opens with a live panel listing what is at or below the threshold, sold-out items
called out separately, with an "Email me now" button; the hourly server job emails the
bakery a daily digest of the same list. Alerts are driven by the real stock decrements
from item 2, so a product drops out of the panel the moment it is restocked. Because a
sleeping free-tier host can miss a scheduled tick, the dashboard list is always live —
the digest is a convenience, not the only line of defence.

### 14. Receipts and kitchen tickets — ✅ **SHIPPED**
Every order row and the order detail modal carry **Receipt** and **Ticket** buttons
(`/admin/print/:id?doc=receipt|ticket`). The receipt is a proper branded document: the
bakery's details, the customer, delivery address and zone, line items with
size/flavour/icing and cake inscription, the subtotal → delivery → discount → loyalty
→ total breakdown with the amount written in words, and the payment method, status and
reference. The kitchen ticket drops pricing and leads with the "needed by" date, the
full spec per line and the notes box. Both render as an A5 sheet and print with the
sidebar and toolbar hidden, so only the document reaches paper.

### 15. Delivery rules that match real operations
Zones and fees exist; what's missing: delivery outside Accra, more than one pickup
location, per-zone minimum order values, and "free delivery over GH₵ X".
**Build:** extend the zone settings into a table with min order + free-over threshold,
and support multiple pickup branches. _Effort: S._

### 16. Collection / delivery time slots
Customers pick a date but not a time, and lead time isn't enforced per product.
**Build:** configurable slots per day (with capacity caps), per-product minimum lead
time, blackout dates (holidays), and slot validation at checkout. _Effort: M._

### 17. Refunds — ✅ **SHIPPED**
Admin → Orders → *Start a refund* refunds a paid order in full. Paystack payments go
straight back to the original mobile-money wallet or card and the refund reference is
kept; payments taken offline (cash, or a transfer you confirmed by hand) are recorded
as settled offline. A refused Paystack refund returns a clear error and leaves the
order **paid** — money is never marked returned when it wasn't. A refund also returns
the stock, writes a timeline entry, emails/SMSes/WhatsApps the customer and lands in
the activity log. Refunded orders drop out of every revenue figure and are reported
separately, so turnover is never overstated.

_Deliberately not built: partial refunds._ A part-refunded order would still sit in the
"paid" bucket and quietly inflate revenue in every report; odd amounts are better
settled from the Paystack dashboard, and the decision is explained in the code.

### 18. Push notifications (PWA)
SMS costs money and Textbelt's free tier is blocked for Ghana. Web push is free and
already half-built (the PWA is installable).
**Build:** service-worker push handling, subscribe prompt after first order, and status
pushes ("your cake is ready") alongside the existing email/SMS/WhatsApp channels.
_Effort: M._

### 19. Reviews on product pages
Reviews are order-level and only surface on the homepage; products show no rating.
**Build:** average rating + count per product card, per-product review list, rating
filter in the menu, and a "rate your order" prompt in the delivery email. _Effort: M._

### 20. Deeper sales analytics
The dashboard has revenue/orders/customers plus an 8-month chart. Missing: revenue by
zone and by product over time, repeat-customer rate, average order value, peak days,
and a proper date-range picker.
**Build:** extend `/admin/reports` with those breakdowns and charts. _Effort: M._

### 21. Bulk admin actions and catalogue import
Everything is edited one record at a time.
**Build:** multi-select bulk operations (activate/deactivate, price adjust, mark ready),
CSV **import** for products (CSV export already exists), and duplicate-a-product.
_Effort: M._

### 22. Wishlist and back-in-stock alerts
Customers can't save items or be told when something returns.
**Build:** favourites list in the account, "notify me" on out-of-stock products, and a
short email when it's restocked. _Effort: S._

### 23. Guest → account conversion
A guest order is a dead end: the details never become an account.
**Build:** "create a password to track this order" prompt after guest checkout, linking
past guest orders by email. _Effort: S._

---

## P2 — Quality, scale and operations

| # | Item | Why | Effort |
|---|---|---|---|
| 24 | **Automated tests + CI** — frontend component tests (Vitest + Testing Library), API contract tests, ESLint, GitHub Actions running lint/build/test on every push | Nothing catches a regression before you push | M |
| 25 | **Error monitoring + structured logging** (e.g. Sentry, request IDs) | You currently find out about errors only if a customer calls | S |
| 26 | **Backups + a rehearsed restore** (Render automated backups + documented restore drill) | One bad migration and the orders are gone | S |
| 27 | **Performance budget** — route-level code-splitting (the admin bundle loads for shoppers), LCP/CLS measurement, keep media under budget (videos are at 2.3 MB — good) | Slow first paint on 3G loses orders | M |
| 28 | **Accessibility pass (WCAG AA)** — focus states, form labels, contrast, keyboard-only ordering, screen-reader run-through | Also improves SEO and general usability | M |
| 29 | **SEO** — `sitemap.xml`, `robots.txt`, per-product Open Graph images, LocalBusiness/Product structured data, Google Business profile | Free customer acquisition | S |
| 30 | **Rider live GPS** on the tracking page + rider earnings/history | Nice-to-have; the tracker is status-based today | L |
| 31 | **Multi-branch support** | Only when a second location opens | L |
| 32 | **Bilingual UI (English / Twi)** | Wider local reach | L |
| 33 | **Per-account login throttling + lockout alerts** | Complements the existing per-IP limits | S |

---

## Recommended sequence

- **Phase 1 — launch blockers (P0): ✅ complete.** Rider auth, stock control,
  password reset, verification policy, review limits, audit log, promo controls,
  legal pages, cookie sessions with CSRF, Turnstile.
- **Phase 2 — selling properly:** 11 product photos, 14 receipts/tickets,
  13 stock alerts, 5 review moderation, 17 refunds.
- **Phase 3 — growth:** 12 WhatsApp templates, 18 push notifications,
  15/16 delivery rules & time slots, 19/20 reviews & analytics, 22/23 wishlist &
  guest conversion.
- **Phase 4 — hardening at scale:** 24–29 (tests, CI, monitoring, backups,
  performance, a11y, SEO).

Every phase ends with the E2E suite green and a fresh zip.

---

## P0 progress

### Shipped

| # | Item | What was built |
|---|---|---|
| 1 | **Rider authentication** | Riders are real accounts (`RIDER` role) created by an admin — there is no rider self-signup. Every rider endpoint requires an active rider. Unclaimed jobs expose only zone/value/item count; the customer's address and phone are revealed **only to the rider who accepts**. Accepting uses a conditional update, so two riders can't claim the same job; only the assigned rider can mark it delivered. Suspending a rider cuts access immediately (verified with a live token). 13 new assertions cover all of it, including that the old anonymous access now returns 401. |
| 2 | **Stock control** | Stock is decremented atomically inside the order transaction (`updateMany` guarded by `stock >= qty`, aggregated per product so two lines of the same cake are satisfied from one pool). Overselling is rejected with a clear message; a failed order consumes no stock; cancelling returns it; selling out auto-marks the product `inStock = false`. |
| 3 | **Password reset** | `/auth/forgot-password` + `/auth/reset-password`. Only a **SHA-256 hash** of the token is stored; the raw token exists only in the email. Single-use, 30-minute expiry, no account enumeration (identical response for unknown addresses), rate-limited to 5 requests/hour. Changing a password or completing a reset clears outstanding tokens. |
| 5 | **Review abuse** | `reviewLimiter` (10/hour) on review submission. |
| 6 | **Audit log** | Append-only `AuditLog` recording actor, action, entity, detail, IP and time for order status changes, product create/update/de-list, promo create/delete, settings changes and rider create/suspend. New **Admin → Activity log** screen with search and action filters. |
| 7 | **Promo abuse controls** | Minimum spend, per-customer limit, first-order-only and expiry, backed by a `PromoRedemption` ledger keyed on user id or guest email/phone. Cancelling an order releases the use so a customer isn't punished for a cancelled basket. Admin UI exposes every condition; percentage discounts above 100% are rejected. |
| 8 | **Legal pages** | `/privacy` and `/terms` written for a Ghanaian bakery under the Data Protection Act 2012 (Act 843) — accurate to what this software actually collects, who it is shared with (Paystack, Resend, SMS/WhatsApp, riders) and for how long. Linked from the footer. **Action for you:** replace the bracketed placeholders (business name, contact details, publish date) before launch. |

### Also shipped

| # | Item | What was built |
|---|---|---|
| 4 | **Email verification policy** | Verification is now enforced at sign-in **as soon as email delivery is configured** (`RESEND_API_KEY` present), and skipped when it isn't — otherwise a customer could be locked out of an account they had no way to activate. Unverified sign-in returns a machine-readable `EMAIL_NOT_VERIFIED` code plus the address, and the sign-in screen offers to resend the link. Resending no longer requires a session (the person who needs it can't sign in), still answers identically for unknown addresses, and stays rate-limited. Guest checkout remains fully open. |
| 9 | **httpOnly cookie sessions + CSRF** | The browser session moved out of `localStorage` into an **httpOnly, SameSite=Lax** cookie, so an XSS bug can no longer read the token. State-changing requests from a cookie session must also echo a double-submit `X-CSRF-Token` header; Bearer-token API clients (the E2E suite, rider tooling) are unaffected because they aren't CSRF-able. Logout clears both cookies. Rejected cookies fall back to the header, so existing integrations keep working. |
| 10 | **Turnstile bot protection** | Opt-in Cloudflare Turnstile on register, sign-in, resend-verification and password reset. It is a pass-through until `TURNSTILE_SECRET_KEY` is set, then becomes mandatory — and **fails closed** if Cloudflare is unreachable. |

### Still open in P0

Nothing. Recommend moving to **Phase 2** (product photos, receipts and kitchen tickets,
low-stock alerts, review moderation, refunds).

### Testing note

`DISABLE_RATE_LIMITS=true` (documented in `.env.example`) lets the E2E suite run repeatedly
from one IP without tripping the limiters. It is **deliberately ignored when
`NODE_ENV=production`**, so it can never weaken a deployed site. Rate limiting itself is
verified separately: 5 forgot-password requests then 429.

---

## Build progress

### Phase 1 — P0 launch blockers: ✅ complete

| # | Item | What shipped |
|---|---|---|
| 1 | Rider authentication | Rider accounts created by an admin; unclaimed jobs hide the customer's address and phone; claim races resolved; suspension revokes access instantly |
| 2 | Stock control | Atomic reserve-and-commit with the order; overselling rejected; cancel restores; sell-out auto-marks the product |
| 3 | Password reset | Hashed single-use 30-minute tokens, no account enumeration |
| 4 | Email verification | Enforced the moment Resend is configured; skipped (with a console notice) when it isn't, so nobody is locked out |
| 5 | Review abuse | 10 submissions per hour per IP |
| 6 | Audit log | Every privileged action recorded, with a searchable Admin screen |
| 7 | Promo controls | Minimum spend, per-customer limit, first-order-only, expiry; cancelling releases the use |
| 8 | Legal pages | `/privacy` and `/terms` written for a Ghanaian bakery |
| 9 | Cookie sessions | httpOnly + SameSite=Lax with double-submit CSRF; Bearer tokens still supported |
| 10 | Bot protection | Opt-in Cloudflare Turnstile on the account endpoints, failing closed |

### Phase 2 — selling properly: in progress

> Docs: **[ADMIN_GUIDE.md](ADMIN_GUIDE.md)** covers signing in and running the portal.

> Running total: **216 end-to-end assertions passing** (`node test-e2e.mjs` from `server/`).

| # | Item | Status |
|---|---|---|
| 11 | **Product photos and galleries** | ✅ shipped |
| 13 | **Automatic low-stock alerts** | ✅ shipped |
| 14 | **Receipts and kitchen tickets** | ✅ shipped |
| 5 | **Review moderation in admin** | ✅ shipped (rate limits + approval queue) |
| 17 | **Refunds** | ✅ shipped (full refunds; see note above) |
| 12 | **WhatsApp message templates** | ✅ shipped |
| 15 | Delivery rules (min order, free over, more branches) | next |
| 16 | Collection / delivery time slots | next |
| 18 | Push notifications (PWA) | planned |
| 19 | Reviews on product pages | planned |
| 20 | Deeper sales analytics | planned |
