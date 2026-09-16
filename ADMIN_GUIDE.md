# Admin Guide — signing in and running the bakery

Everything in the admin portal is behind a single admin account. This is how you get
in, what each screen is for, and the order to do things in on a normal day.

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
| **Products** | Your catalogue: name, description, price, size tiers, stock, photos (up to 8, with cover/reorder), and de-listing. |
| **Reviews** | The approval queue: Publish, Hide or Re-queue a review. The badge shows how many are waiting. |
| **Promo Codes** | Percentage or fixed discounts with minimum spend, per-customer caps, first-order-only and expiry. |
| **Reports** | Date-range sales report, top products, refunds, and **CSV export** for your accountant. |
| **Riders** | Create rider accounts, suspend them, and see who is carrying what. |
| **Activity log** | Who changed what, when, from which IP — order changes, price edits, refunds, moderation, settings. |
| **Settings** | Business details, lead time, delivery zones and fees, payment methods, loyalty/reviews toggles, notification toggles, **WhatsApp templates**, and **your admin password**. |

---

## 3. Your first 15 minutes (getting the shop ready)

An empty install is intentional — the live site never shows demo content. In order:

1. **Settings** → business name, email, phone, address (these appear on receipts and
   in every customer email), delivery fee, minimum lead days.
2. **Settings → Delivery zones** — the Accra neighbourhoods you deliver to and their
   fees. Checkout prices delivery from this list, so no zone means no delivery orders.
3. **Settings → Your admin account** — change the password.
4. **Products → Add product** — name, category, price, size tiers (e.g. 6″ GH₵ 220 /
   8″ GH₵ 320), stock, and photos. Repeat for the catalogue.
5. **Settings → Payment methods** — leave Paystack off to take cash on delivery/pickup
   while you test; add keys (see `PAYSTACK_TESTING.md`) when you're ready for mobile
   money and cards.
6. **Settings → WhatsApp templates** — send yourself a test message once your Meta
   token is in place (`WHATSAPP_TEMPLATES.md`).
7. **Riders → Add rider** — one account per rider.
8. Place a real test order from the storefront yourself and walk it through to
   *Delivered*. That exercises payments, notifications, printing and reporting in one
   go, and you can delete nothing — it's a genuine order you can keep as your baseline.

---

## 4. The daily routine

A normal Accra bakery day, in the order the app expects it:

| When | Where | What you do |
|---|---|---|
| Morning | **Dashboard** | Check today's orders, the active queue, and the low-stock panel. Restock or de-list anything sold out. |
| Morning | **Orders → PENDING** | Confirm each new order (**status → CONFIRMED**). The customer is told by SMS, WhatsApp and email automatically. |
| Before baking | **Orders → open order → Ticket** | Print the **kitchen ticket** — spec per line, inscription, notes and the "needed by" date. Two copies: bench and packing. |
| While baking | **Orders → IN_PROGRESS** | Set it when you start, so the customer's tracker updates live over the WebSocket. |
| When ready | **Orders → READY** | Then either the rider collects (status **OUT_FOR_DELIVERY**, assigned in **Riders**) or the customer picks up. Both notify automatically. |
| On handover | **Orders → DELIVERED** | Closes the order and prompts the customer to review it (+5 loyalty points for them). |
| Anytime | **Orders → open order → Receipt** | Print the **customer receipt** — branded, itemised, with the amount in words and the payment reference. |
| Anytime | **Reviews** | Clear the approval queue (if you've turned moderation on). |
| Weekly | **Reports** | Check revenue, top products and refunds; export the CSV. |
| Weekly | **Activity log** | Skim what changed, especially with more than one person using the portal. |

---

## 5. Common order actions, precisely

Open any order from **Admin → Orders**:

- **Change status** — the dropdown on the row, or the detail panel. One click; the
  customer is notified on every channel and their tracking page updates instantly.
- **Print** — *Receipt* or *Kitchen ticket* at the top of the row and in the detail
  panel. A5, print-optimised; only the document reaches paper.
- **Refund** — *Start a refund* (only shown on paid orders). Full refund only; Paystack
  payments go back to the original wallet or card, offline payments are recorded as
  settled offline. Stock returns to inventory, the customer is notified, and the order
  stops counting towards revenue. If Paystack refuses, the order stays **Paid** and the
  error is shown — money is never marked returned when it wasn't.
- **Cancel** — restores stock, releases the promo use, and refunds the loyalty points
  the customer spent.
- **Design photos** — any photos the customer attached at checkout are in the detail
  panel; open them in a new tab to print or share with the decorator.

---

## 6. Security notes worth knowing

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
