# Paystack Testing, Admin Login & App Flows

This guide covers everything you asked for:

1. **How to test payments now with real Paystack test keys** (no business documents needed).
2. **How to log in as admin**.
3. **How the customer flow and admin flow work** end to end.
4. **The security measures built into the app.**

---

## 1. Test Paystack with real test keys — step by step

Paystack's **test mode** lets you take real payments (card + Ghana mobile money)
using *fake* credentials — you need **no business certificates, no bank account,
no company registration**. It's designed exactly for this.

### Step 1 — Create a free Paystack account

1. Go to <https://dashboard.paystack.com> and click **Create a free account**.
2. Verify your email and log in.
3. The dashboard opens in **Test Mode** by default (you'll see a "Test Mode" badge).

### Step 2 — Copy your test keys

1. In the dashboard, open **Settings → API Keys & Webhooks**.
2. You'll see two keys that both start with `sk_test_` / `pk_test_`:
   - **Secret key** (starts with `sk_test_…`)
   - **Public key** (starts with `pk_test_…`)
3. Copy both.

> Never use a key that starts with `sk_live_` / `pk_live_` while testing — live
> keys charge real money.

### Step 3 — Paste the keys into the server `.env`

Open `server/.env` and set:

```env
PAYSTACK_SECRET_KEY=sk_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxx
PAYSTACK_PUBLIC_KEY=pk_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

The moment `PAYSTACK_SECRET_KEY` is set, the app **automatically switches from
"Simulated Payment" mode to real Paystack checkout** (it reads the keys at
startup).

### Step 4 — Restart the server

```bash
cd server
npm start        # or: node src/index.js
```

The startup banner should now say:

```
Paystack: ENABLED (keys set)
```

### Step 5 — Place an order and pay

1. Open the site and add a product to the cart (or place a custom order).
2. At checkout choose a payment method, then **Place Order & Pay**.
3. You'll be redirected to Paystack's hosted checkout (it shows a "Test Mode" banner).

#### Pay by test card

| Field | Test value |
|---|---|
| Card number | `4084 0840 8408 4081` |
| Expiry | any future date (e.g. `12/30`) |
| CVV | `408` |
| PIN (when asked) | `408408` |
| OTP (when asked) | `123456` |

> To simulate a **failed** card payment, use OTP `123457` instead.

#### Pay by Ghana mobile money (test)

1. On the Paystack checkout choose **Mobile Money**, then pick **MTN**,
   **AirtelTigo (ATL)** or **Vodafone (VOD)**.
2. Enter any valid 10-digit Ghanaian number (e.g. `0240000000`).
3. In **test mode no real money moves** — Paystack shows a simulated approval
   prompt. Approve it, and the transaction succeeds.

### Step 6 — Confirm the result in the app

After a successful test payment, Paystack redirects you back to the app
(`/pay/callback?reference=…`), the app verifies the transaction with Paystack's
API, marks the order **PAID**, awards loyalty points, and sends the customer a
confirmation (email / SMS / WhatsApp). You can confirm in the admin portal under
**Orders**, and see the transaction under **Paystack dashboard → Transactions**
(with the "Test Mode" badge on).

### (Optional) Step 7 — Webhooks for server-to-server confirmation

The app already verifies payment on redirect, so webhooks are optional. If you
want Paystack to also *push* confirmation to your server (the more robust
production setup):

1. In the Paystack dashboard, **Settings → API Keys & Webhooks → Webhook URL**.
2. Enter `https://<your-domain>/api/payments/webhook`.
3. Paystack signs each webhook with your secret key; the app verifies the
   `x-paystack-signature` (HMAC-SHA512) before trusting it.

To test webhooks locally, expose your server with `ngrok http 5000` and use the
ngrok URL. (On Render, just use your live `*.onrender.com` URL.)

---

## 2. How to log in as admin

The database is seeded with **one** admin account:

| Field | Value |
|---|---|
| URL | `https://<your-app>/admin` (locally: `http://localhost:5173/admin`) |
| Email | `admin@homelytreats.gh` |
| Password | `admin123` |

**Steps:**

1. Open the app and click **Sign In** (top right).
2. Enter `admin@homelytreats.gh` and `admin123`, then **Sign In**.
3. Because this user has the `ADMIN` role, you're taken straight to the
   **Admin Dashboard** (`/admin`).

**Important:** change this password after your first login
(Admin → **Settings**, or **My Account → Change password**). The seeded password
is only meant to get you in the first time.

> There is **no** public "admin sign-up" — the `ADMIN` role can only be set in
> the database (the seed script). This prevents anyone from registering
> themselves as admin.

---

## 3. How the customer flow works

1. **Browse** — Home shows featured products; **Menu** has search, category
   filters, and sorting.
2. **Customise** — On a product you pick quantity, flavour, icing, cake
   inscription, required date, and a **size tier** (each size has its own
   price). For custom designs you can **upload a reference photo**.
3. **Cart & checkout** —
   - Choose **Delivery** (pick an Accra delivery zone — a fee is added per
     neighbourhood) or **Pickup**.
   - Apply a **promo code** if you have one.
   - Redeem **loyalty points** (20 points = GH₵ 1 off).
   - Sign in, or continue as a **guest** with name/email/phone.
   - Choose payment: **MTN MoMo**, **AirtelTigo**, **Vodafone Cash**, **Card**,
     or **Pay on Delivery (COD)**.
4. **Pay** — Paystack checkout → approve → redirected back → order confirmed.
5. **Track** — open **Track Order** (or the link from your SMS/WhatsApp/email),
   enter the order reference (e.g. `HT-20260906-0001`), and watch the live
   timeline update in real time (WebSockets) as the bakery progresses the order.
6. **After delivery** — you can **rate & review** the order (earns +5 bonus
   loyalty points) and **order it again** from your account history.

## 4. How the admin flow works

1. **Dashboard** — revenue, order count, customer count, an 8-month revenue
   chart and a product-category donut.
2. **Products** — create the catalog: name, category, description, price,
   **size tiers**, stock, "featured" flag, and a Lucide icon.
3. **Orders** — see new orders (with design photos and inscriptions), advance
   their status: **Pending → Confirmed → In Progress → Ready → Out for
   Delivery → Delivered**, or cancel. Every change notifies the customer
   (SMS + WhatsApp + email) and pushes a live update to their tracker.
4. **Customers** — view customers, their orders, spend, and loyalty points.
5. **Promo codes** — create percentage or fixed discounts with usage limits.
6. **Reports** — pick a date range for a sales report, see top products, and
   **export to CSV**.
7. **Settings** — business info, minimum lead time, **delivery zones & fees**,
   which payment methods are enabled, open/close the store, loyalty & review
   toggles, and notification switches.

The **rider app** at `/rider` is a third role: a rider sees deliveries that are
**READY**, accepts them (→ *Out for Delivery*), and marks them **Delivered**,
which updates the customer's tracker instantly.

---

## 5. Security measures implemented

The backend was hardened for production. Summary:

| Area | Measure |
|---|---|
| HTTP headers | **Helmet** — Content-Security-Policy (tuned to the app's own assets, Google Fonts, Cloudinary, WebSockets), `X-Frame-Options`, `nosniff`, HSTS, Referrer-Policy |
| CORS | Pinned to the configured frontend origin only (no open `*`) |
| Brute force | **Rate limiting** — 20 login attempts / 15 min per IP; 10 sign-ups / hour; 600 API calls / 15 min; 5 verification emails / 30 min |
| Passwords | **bcrypt cost 12**; minimum 8 chars with at least one letter and one number |
| Tokens | **JWT** pinned to `HS256` with `issuer` + `audience`; 24-hour expiry |
| Secrets | Server **refuses to start in production without a real `JWT_SECRET`** |
| Payments | Paystack webhook body verified with **HMAC-SHA512** before acting; amounts re-checked server-side |
| Payloads | JSON body limited to **100 KB**; order fields length-capped; quantities bounded |
| Data exposure | Auth responses strip password hashes/tokens; production error handler never leaks stack traces |
| Roles | `ADMIN` role is database-assigned only; every admin route re-checks the role |

### Things you must still do yourself (they depend on you, not the code)

1. Set a **strong, unique `JWT_SECRET`** in `server/.env` (e.g. run
   `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`).
2. Change the **admin password** after first login.
3. Never commit `.env` (it's already in `.gitignore`).
4. On Render, set the env vars under the web service (see
   `RENDER_WALKTHROUGH.md`) — never put secrets in the repo.
