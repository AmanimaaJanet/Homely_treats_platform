# Admin Guide — signing in and running the bakery

Everything in the admin portal is behind a single admin account. This is how you get
in, what each screen is for, and the order to do things in on a normal day.

Covers the current build: orders with receipts, kitchen tickets and delivery notes,
refunds, review moderation, delivery rules and collection windows (**Deliveries**),
bulk catalogue actions and CSV import, deeper reports, and push/wishlist notifications.

---

## 1. Signing in

### The account

`npm run db:seed` creates exactly one account:

| | |
|---|---|
| **Email** | `admin@homelytreats.gh` |
| **Password** | `admin123` |
| **Where** | `server/` → `npm run db:seed` (or `npm run db:seed:demo` to also load the sample catalogue) |

The seed is safe to run again: it re-asserts the admin role but **never overwrites an
existing password**, so your changed password survives.

### The steps

1. Start the app (`npm run dev` in `/home/user/homely-treats`, or the Render URL).
2. Go to **`/signin`** — e.g. `http://localhost:5173/signin`, or
   `https://your-app.onrender.com/signin`.
3. Enter the email and password above and press **Sign in**.
4. You land on **`/admin`** automatically. (Customers land on `/account`, riders on
   `/rider` — the app routes each role to its own home. Once signed in, the storefront
   navbar also shows an **Admin** link.)
5. Bookmark `/admin`. The portal is not linked from anywhere a customer can reach.
6. **First thing to do: change the password** — see below.

### Change the password immediately

The seed password is published in this repository, so anyone who has seen the project
files knows it. The admin portal warns you until you change it:

**Admin → Settings → Your admin account** → current password `admin123`, then a new one
(at least 8 characters, with a letter and a number) → **Change password**.

The yellow *"This account still uses the password printed by the installer"* banner
disappears the moment you do. If you forget the password later, sign out and use
**Forgot password** on the sign-in screen: with `RESEND_API_KEY` set the reset link
arrives by email; without it the link is printed in the server console (nothing is sent
anywhere, which is why it works offline in development).

### If you can't get in

| What you see | What it means |
|---|---|
| “Invalid email or password” | Wrong details — or the account was never seeded. Run `npm run db:seed` from `server/`. |
| You land on `/account`, not `/admin` | That login isn't an admin. Only `role = ADMIN` reaches the portal; check the account's role in the database. |
| “Too many attempts” | The sign-in limiter (20 per 15 minutes per IP). Wait it out, or set `DISABLE_RATE_LIMITS=true` locally — rate limits are always enforced in production. |
| An **Admin** link is missing in the navbar | You're signed in as a customer. Sign out, sign in as the admin. |
| Blank page at `/admin` | You're signed out; the portal redirects to `/signin`. |

### Adding more staff

While riding, the rider app has a **Share live location** toggle: their GPS position
appears on the customer's tracking page as an approaching-rider card, and is deleted
the moment the delivery is marked done (nothing is stored after — positions live in
server memory only, and only while a delivery is out for delivery). The rider app also
shows each rider their own delivery history and the delivery fees attached to those
orders — what you actually pay them is between you and them.

Riders are ordinary accounts the admin creates — **Admin → Riders → Add rider** — and
they can be suspended instantly (suspension cuts an active session's access
immediately; two riders can't claim the same job). There is currently no screen for
creating a *second admin*; when you need one, promote an existing account in the
database:

```sql
-- server/: npx prisma studio, or psql
UPDATE "User" SET role = 'ADMIN' WHERE email = 'owner@homelytreats.gh';
```

Every privileged action is recorded in **Admin → Activity log** with the actor's email,
so with more than one admin you can always see who did what.

---

## 2. What each screen is for

| Screen | Use it to |
|---|---|
| **Dashboard** | Start here each morning: today's orders, active orders, revenue, and the **low-stock panel** listing anything at or below your reorder threshold (with an *Email me now* button for the restock digest). |
| **Orders** | The workhorse — filter by status, search, open an order, change its status, print documents, issue refunds. |
| **Products** | Your catalogue: name, description, price, size tiers, **notice period**, stock, photos (up to 8, with cover/reorder), de-listing — plus **bulk actions**, **CSV import** and **duplicate**. |
| **Reviews** | The approval queue: Publish, Hide or Re-queue a review. The badge shows how many are waiting. |
| **Promo Codes** | Percentage or fixed discounts with minimum spend, per-customer caps, first-order-only and expiry. |
| **Reports** | Revenue over any date range: by day, **by zone**, by payment method, busiest weekdays and windows, repeat-customer rate, average order value, 12-month trend, top products with share of sales, refunds, and **CSV export** for your accountant. |
| **Deliveries** | Your delivery rules in one place: zones with fees, **minimum basket**, **free delivery over**, ETA note, **pickup counters**, **collection windows with daily capacity**, **closed days**, and a 14-day calendar of what each day has promised. |
| **Riders** | Create rider accounts, suspend them, and see who is carrying what. |

**Sample products** — if the demo catalogue (from `npm run db:seed:demo`) is still on
your menu, Admin → Products shows an amber notice with a one-click **Remove sample
products** button. Every sample is flagged featured, so until they are removed they
take over the homepage's featured section. Nothing is deleted — they are de-listed and
can be restored individually. To star your own products instead, tick **Featured** in
the product form.

**Branches** — every order records the branch that fulfils it: the counter a pickup
customer chose, or (for deliveries) the default kitchen. When you open a second
location, add it under **Deliveries → Pickup locations** and mark one as the default —
orders then carry the right branch automatically, the Orders screen gains a
**branch filter**, Reports gains a per-branch revenue table, and pickup customers see
the address of the branch they chose on their tracker.
| **Activity log** | Who changed what, when, from which IP — order changes, price edits, refunds, moderation, settings. |
| **Diagnostics** | Is everything switched on (Paystack, email, WhatsApp, push, SMS), did any notification fail this week, and what errors has the server hit — each with the reference to quote. |
| **Settings** | Business details, lead time, low-stock threshold, payment methods, loyalty/review toggles, notification toggles, **WhatsApp templates**, and **your admin account & password**. (Delivery zones now live under **Deliveries**.) |

---

## 3. Your first 15 minutes (getting the shop ready)

An empty install is intentional — the live site never shows demo content. In order:

1. **Settings** → business name, email, phone, address (these appear on receipts and
   in every customer email), delivery fee, minimum lead days.
2. **Deliveries → zones** — the Accra neighbourhoods you deliver to and their fees, plus
   the two rules that protect your margins: a **minimum basket** per zone (a GH₵ 300
   minimum saves you driving across Accra for one cupcake) and **free delivery over** a
   threshold. Checkout prices delivery from this list, so no zone means no delivery
   orders.
3. **Deliveries → counters, windows, closed days** — where customers collect from, the
   collection/delivery windows you can actually bake for (each with a **daily
   capacity**), and any day you're shut. The calendar strip underneath shows the next
   14 days: what each day has promised and how full each window is.
4. **Products → notice period** — set a per-product lead time where a cake needs longer
   than the shop default (a wedding cake needs a week; cupcakes need two days). The
   date picker and the server both take the stricter of the two.
5. **Settings → Your admin account** — change the password.
6. **Products → Add product** — name, category, price, size tiers (e.g. 6″ GH₵ 220 /
   8″ GH₵ 320), stock, and photos. Repeat for the catalogue — or fill in the **CSV
   template** (*Products → Template*) and upload it, which is much faster for a long
   menu, and re-upload it whenever your price list changes.
7. **Settings → Payment methods** — leave Paystack off to take cash on delivery/pickup
   while you test; add keys (see `PAYSTACK_TESTING.md`) when you're ready for mobile
   money and cards.
8. **Settings → WhatsApp templates** — send yourself a test message once your Meta
   token is in place (`WHATSAPP_TEMPLATES.md`).
9. **Riders → Add rider** — one account per rider.
10. Place a real test order from the storefront yourself and walk it through to
   *Delivered*. That exercises payments, notifications, printing and reporting in one
   go, and you can delete nothing — it's a genuine order you can keep as your baseline.

---

## 4. The daily routine

A normal Accra bakery day, in the order the app expects it:

| When | Where | What you do |
|---|---|---|
| Morning | **Dashboard** | Check today's orders, the active queue, and the low-stock panel. Restock or de-list anything sold out. |
| Morning | **Orders → PENDING** | Confirm each new order (**status → CONFIRMED**). The customer is told by SMS, WhatsApp and email automatically. |
| Before baking | **Deliveries** | Glance at the calendar: which windows are nearly full, what is promised for tomorrow, and any closed day coming up. |
| Before baking | **Orders → open order → Ticket** | Print the **kitchen ticket** — spec per line, inscription, notes and the "needed by" date. Two copies: bench and packing. |
| Before the van leaves | **Orders → open order → Delivery note** | Print the **delivery note** for the rider: address, zone, contact, what to collect, and a signature line to sign on handover. |
| While baking | **Orders → IN_PROGRESS** | Set it when you start, so the customer's tracker updates live over the WebSocket. |
| When ready | **Orders → READY** | Then either the rider collects (status **OUT_FOR_DELIVERY**, assigned in **Riders**) or the customer picks up. Both notify automatically. |
| On handover | **Orders → DELIVERED** | Closes the order and prompts the customer to review it (+5 loyalty points for them). |
| Anytime | **Orders → open order → Receipt** | Print the **customer receipt** — branded, itemised, with the amount in words and the payment reference. The *Receipt* and *Ticket* buttons on the order row print immediately (no extra click). |
| Anytime | **Reviews** | Clear the approval queue (if you've turned moderation on). |
| Weekly | **Reports** | Check revenue, which zones and products carry it, whether customers come back, and refunds; export the CSV. |
| Weekly | **Activity log** | Skim what changed, especially with more than one person using the portal. |
| When something feels wrong | **Diagnostics** | Start here before phoning anyone: an integration showing *not set*, a notification that failed, or an error with an exact time. |

---

## 5. Common order actions, precisely

Open any order from **Admin → Orders**:

- **Change status** — the dropdown on the row, or the detail panel. One click; the
  customer is notified on every channel and their tracking page updates instantly.
- **Print** — *Receipt*, *Kitchen ticket* or *Delivery note*, from the row or the detail
  panel. Print-optimised; only the document reaches paper. The counter phone trick:
  print straight from the list and the browser dialog opens by itself.
- **Bulk actions** — tick several orders and confirm or advance them in one go (the
  weekend pile on a Monday morning). Each order still notifies its customer normally.
- **Refund** — *Start a refund* (only shown on paid orders). Full refund only; Paystack
  payments go back to the original wallet or card, offline payments are recorded as
  settled offline. Stock returns to inventory, the customer is notified, and the order
  stops counting towards revenue. If Paystack refuses, the order stays **Paid** and the
  error is shown — money is never marked returned when it wasn't.
- **Cancel** — restores stock, releases the promo use, and refunds the loyalty points
  the customer spent.
- **Design photos** — any photos the customer attached at checkout are in the detail
  panel; open them in a new tab to print or share with the decorator. The kitchen
  ticket also states how many there are, so nothing gets baked from the wrong picture.

Catalogue-wide actions (Admin → **Products**): tick products and apply one instruction —
available / sold out, featured, listed / de-listed, set stock, or **adjust prices by a
percentage or a flat amount** (size prices move with the base price, so a festive rise
stays proportional). **Duplicate** copies a product with its sizes as a de-listed,
zero-stock draft for this year's variation.

Customers doing things by themselves, for reference: they can **save items** (the heart
on any product) and are emailed the moment a sold-out item returns; they can turn on
**order alerts** in *Account → Saved & Alerts* so their phone pings when the order is
ready; and a **guest order** is no longer a dead end — creating an account with the same
email attaches their past orders automatically.

---

## 6. Email — what the free Resend tier actually delivers

**The short version:** with a free Resend account and no verified domain, the default
sender (`onboarding@resend.dev`) can only deliver to **your own Resend account's email
address**. Every send to a customer is refused by Resend with a 403. That is Resend's
policy, not a bug in the app — and it is why customers were not receiving their
verification emails.

**What the app does about it (as of this change):** email verification is **switched
off entirely** while the sender is the resend.dev test address — accounts are verified
the moment they are created, existing unverified accounts are let in and marked
verified the next time they sign in, and the registration screen says "you are all
set". Customers are never trapped again, whatever state your email is in. Verification
also switches itself back on automatically if you ever set `EMAIL_FROM` to a domain
you have verified at [resend.com/domains](https://resend.com/domains).

**Your options, all free:**

| State | What customers receive | What you receive |
| --- | --- | --- |
| `RESEND_API_KEY` set, no verified domain (you are here) | No emails; accounts verify automatically | New-order and lockout alerts **only** if your Settings → business email matches your Resend account address |
| `RESEND_API_KEY` removed | No emails (simulated in the server console) | Same — alerts are simulated too |
| A domain you own verified at [resend.com/domains](https://resend.com/domains) (verifying is free; the domain itself costs about GH₵ 150–200/year) | Real verification, order and restock emails — 100/day free | Everything, to any address |

When you verify a domain: add `EMAIL_FROM=Homely Treats <orders@yourdomain.com>` in
Render's environment, redeploy, and email verification becomes real automatically —
no code changes. Until then, treat customer email as switched off; **WhatsApp and SMS
notifications carry the customer-facing side** (see Settings → Notifications).

> **Note:** with only one admin account, the password-reset email is your only way
> back in if you forget it. In test mode that email only reaches your own Resend
> address — so either keep your admin password in a password manager, or make sure
> the business email in Settings matches your Resend account email.

## 7. Security notes worth knowing

- Sessions are **httpOnly cookies** — JavaScript can't read the token, so an XSS bug
  can't steal it. State-changing requests also carry a CSRF token.
- **Sign out** from the sidebar footer (or Settings → Your admin account). Signing out
  clears both cookies.
- The portal is guarded on the server, not just in the UI: every `/api/admin/*` route
  requires an admin token, so a hidden link isn't a security boundary.
- Rate limits and refusal behaviour are always enforced in production, even if
  `DISABLE_RATE_LIMITS` is set.
- With only one admin account, **the password reset email is your only way back in** —
  so keep `RESEND_API_KEY` configured on the live site, or write the password down in a
  password manager.
- The installer's password (`admin123`) is published in this repo. If **Settings → Your
  admin account** is showing the yellow warning banner, anyone who finds your site and
  guesses that password is you. Change it before the shop goes live.
- **Every request has a reference.** The server attaches an id to each request, logs its
  method, path, status and duration under that id, and returns it to the browser. If a
  customer sees *"quote this reference"*, that string pins down the exact request in the
  server log. **Diagnostics → Send a test alert** proves the pipeline works.
- Admin actions are audited: price changes, refunds, status changes, bulk edits, CSV
  imports, review moderation and setting changes all land in **Activity log** with the
  actor, the time and the IP.
- **Sign-in protection is per account, not just per IP.** After `AUTH_MAX_FAILED_ATTEMPTS`
  wrong passwords (10 by default) an account pauses for `AUTH_LOCKOUT_MINUTES` (15). You
  are emailed each time it happens, the customer is emailed a reset link, and **Admin →
  Customers** lists any paused account with a *Let them in* button — so the phone call
  that starts *"I can't log in"* has a one-click answer. The lock also lifts by itself,
  and a password reset clears it instantly.
