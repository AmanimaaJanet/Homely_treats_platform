# 🖱️ Click-by-Click Walkthrough — Render + Paystack

Two detailed walkthroughs, with every click listed:

1. **[Part A](#part-a--deploying-on-render-click-by-click)** — Deploy on Render (create the PostgreSQL database, connect it, deploy the app).
2. **[Part B](#part-b--paystack-test-keys-click-by-click)** — Get Paystack test keys and turn on real Ghana payments.

> Render updates its UI occasionally, so button labels may shift slightly. If a label below looks different, look for the nearest equivalent — the concepts are the same.

---

## Part A — Deploying on Render, click by click

### A1. Sign in to Render

1. Go to **https://render.com**
2. Click **Get Started** (or **Sign In**, top-right).
3. Click **Sign in with GitHub**.
4. GitHub asks: *"Render wants to access your repositories."* Click **Authorize render** (or **Authorize**).
   - First time only. You can limit access to just the `homely-treats` repo if you prefer — click the "Only select repositories" option and tick `homely-treats`.

You'll land on the Render **Dashboard**.

---

### A2. Create the PostgreSQL database

1. On the Dashboard, click **New +** (top-right corner).
2. From the dropdown, click **PostgreSQL**.
3. You'll see the "New PostgreSQL" form. Fill in:
   - **Name:** `homely-treats-db`
   - **Database:** leave as-is (auto-generated, e.g. `homely_treats_db`)
   - **User:** leave as-is (auto-generated)
   - **Region:** pick one (e.g. **Frankfurt (EU Central)** if you're serving Ghana/Accra, or **Oregon (US West)**). **Remember this region** — the web service must use the same one.
   - **Instance Type:** select **Free** (or leave on the default free tier).
   - PostgreSQL version: leave the default (16/17).
4. Click **Create Database**.
5. Wait ~30–60 seconds. The status changes from "Creating" to **"Available"**.

---

### A3. Copy the Internal connection string

1. Click on your new database (`homely-treats-db`) to open its page.
2. Scroll to the **Connections** section.
3. Find **Internal Database URL** and click the **Copy** button.

   It looks like:
   ```
   postgresql://homely_treats_db_user:AbCd1234XyZ@dpg-xxxxxxxxxxxx-a.oregon-postgres.render.com/homely_treats_db
   ```

4. **Paste it somewhere safe** (a note/Notepad) — you'll need it in A6.

> ⚠️ Use **Internal**, not External. Internal works from inside Render with no extra config. (External is only for connecting your local computer directly to the Render DB with tools like pgAdmin.)

---

### A4. Create the Web Service

1. Back on the Dashboard, click **New +** → **Web Service**.
2. Click **"Build and deploy from a Git repository"** (Render shows your repos).
3. Find **`homely-treats`** and click **Connect**.
4. The "New Web Service" form appears. Fill in:

   | Field | What to enter |
   |---|---|
   | **Name** | `homely-treats` |
   | **Region** | **same as your database** (e.g. Frankfurt) |
   | **Branch** | `main` |
   | **Root Directory** | *(leave empty)* |
   | **Runtime** | Node |
   | **Build Command** | `cd server && npm install && npx prisma generate && npx prisma migrate deploy && node src/seed.js && cd ../client && npm install && npm run build` |
   | **Start Command** | `cd server && npm start` |
   | **Instance Type** | **Free** |

5. Click **Create Web Service**.

> It will start building immediately and **will likely fail the first time** with a database error (because `DATABASE_URL` isn't set yet). That's expected — continue.

---

### A5. Add the environment variables (this is what "connects the database")

1. Open the web service page (`homely-treats`).
2. Click the **Environment** tab (left side).
3. Scroll to **Environment Variables** → click **Add Environment Variable**.
4. Add each variable (key + value), clicking **Add Environment Variable** for each:

   | Key | Value |
   |---|---|
   | `DATABASE_URL` | *(paste the Internal Database URL from A3)* |
   | `JWT_SECRET` | a long random string — generate one at https://1password.com/password-generator |
   | `CLIENT_URL` | `https://homely-treats.onrender.com` (your real service URL — see A6) |
   | `NODE_VERSION` | `20` |
   | `PAYSTACK_SECRET_KEY` | *(blank for now — Part B)* |
   | `PAYSTACK_PUBLIC_KEY` | *(blank for now — Part B)* |
   | `RESEND_API_KEY` | *(blank for now)* |
   | `EMAIL_FROM` | `Homely Treats <onboarding@resend.dev>` |
   | `WHATSAPP_TOKEN` | *(blank for now)* |
   | `WHATSAPP_PHONE_NUMBER_ID` | *(blank for now)* |
   | `SMS_PROVIDER` | `textbelt` |
   | `SMS_SENDER` | `HomelyTreats` |
   | `TEXTBELT_API_KEY` | `textbelt` |
   | `ARKESEL_API_KEY` | *(blank for now)* |
   | `CLOUDINARY_CLOUD_NAME` | *(blank for now)* |
   | `CLOUDINARY_API_KEY` | *(blank for now)* |
   | `CLOUDINARY_API_SECRET` | *(blank for now)* |
   | `CLOUDINARY_UPLOAD_PRESET` | *(blank for now)* |

5. Click **Save Changes**.
   - Saving triggers a **new deploy automatically**. Watch the logs (click the **Events** or **Logs** tab, or the live log at the bottom of the page).

> Do **NOT** add a `PORT` variable — Render injects the port automatically and the app already reads it.

---

### A6. Find your live URL

1. Open the web service page.
2. The URL is shown **top-left** on the service page (e.g. `https://homely-treats.onrender.com`).
3. Copy it and make sure the `CLIENT_URL` variable (A5) matches it exactly. If you later rename the service, update `CLIENT_URL` too.

---

### A7. Verify the deployment

1. Wait for the build to finish. In the log you should see the app's startup banner:

   ```
   🎂 Homely Treats API running on http://localhost:5000
      Paystack: SIMULATION MODE (no keys set)
   ```

2. Open **https://homely-treats.onrender.com**.
3. Sign in at `/admin` with `admin@homelytreats.gh` / `admin123`.
4. Change the password immediately: **My Account → Change Password**.
5. Add your first product, a delivery zone, and a promo code from the Admin Dashboard.

**What just happened under the hood:**

```
build:  npm install (server) → prisma generate → prisma migrate deploy (creates the tables
        in the Render PostgreSQL) → seed.js (creates the admin account) → npm install
        (client) → vite build (produces client/dist)
start:  node src/index.js  → serves the built frontend + the API on one port
```

Every future `git push` to `main` triggers a new deploy automatically.

---

## Part B — Paystack test keys, click by click

### B1. Why test keys first

Paystack test keys let you take **real payments through Paystack's sandbox** — real MTN MoMo / AirtelTigo / Vodafone / card prompts — with **no business documents and no bank account**. Money doesn't actually move; it's a simulation Paystack provides. You go live only when you're ready to get verified.

### B2. Create the Paystack account

1. Go to **https://paystack.com** → click **Create free account**.
2. Sign up with your **email + password** (choose **Ghana** when asked for country, if prompted).
3. Check your email and click **Verify email**.
4. You land on the Paystack **Dashboard** (dashboard.paystack.com).
   - The top of the dashboard has a **Test Mode / Live Mode** toggle. **Leave it on Test Mode.**

### B3. Find your test keys

1. In the dashboard, click **Settings** (left sidebar, ⚙️).
2. Click **API Keys & Webhooks** (or "API Keys").
3. You'll see two keys for **Test Mode**:
   - **Test Secret Key** — starts with `sk_test_` (copy the full value from your dashboard)
   - **Test Public Key** — starts with `pk_test_` (copy the full value from your dashboard)
4. Click **Copy** on each and store them somewhere safe.

> ⚠️ The **secret key** is like a password — never put it in the frontend or commit it. It only goes in `server/.env` (local) or Render env vars (production).

### B4. Add the keys

**Locally** — edit `server/.env`:

```env
PAYSTACK_SECRET_KEY=PASTE_YOUR_TEST_SECRET_KEY_HERE
PAYSTACK_PUBLIC_KEY=PASTE_YOUR_TEST_PUBLIC_KEY_HERE
```

Then restart the server. The startup banner should now say:

```
Paystack: ENABLED (test keys)
```

**On Render** — web service → **Environment** → set the same two variables → **Save Changes** (triggers a deploy).

### B5. Test a payment end-to-end

1. Place an order in the storefront and pick **MTN MoMo** (or any method) at checkout.
2. Instead of the in-app demo screen, you'll be redirected to **Paystack's hosted checkout**.
3. In **Test Mode**:
   - **Mobile money:** Paystack shows a sandbox prompt — approve it with the on-screen button (no real money moves).
   - **Card:** use Paystack's test card `4084 0840 8408 4081`, any future expiry date, any CVV, and any PIN/OTP it asks for.
4. After success you're redirected back to the app, which calls `/api/payments/verify` and marks the order **Paid**.
5. Check **Admin → Orders** — the order shows **Paid**, and the tracker moves to Confirmed.

### B6. The webhook (for production / live mode)

The app verifies Paystack's server-to-server notifications so payments are marked paid even if the customer closes the browser after paying.

1. Paystack Dashboard → **Settings → API Keys & Webhooks**.
2. In the **Webhook URL** field, enter:

   ```
   https://homely-treats.onrender.com/api/payments/webhook
   ```

   (Use your actual service URL.)
3. Click **Save**.
4. The app verifies every webhook with the HMAC `x-paystack-signature` header using your **secret key** — so keep the secret key in sync with whatever mode you're running.

> You don't need the webhook for test mode (the frontend verify call handles it), but set it anyway so it's ready for live.

### B7. Going live (when you're ready)

1. Paystack → **Settings** → complete **business verification** (business name, bank account, ID — required for live payouts).
2. Toggle the dashboard to **Live Mode** — your **Live** secret/public keys appear in the same API Keys page.
3. Replace the two env vars with the live keys (the ones starting with `sk_live_` and `pk_live_`), on Render and/or locally.
4. Set the webhook URL (B6) to your live domain.

Until then, keep the **test keys** or leave the fields blank to run **Cash on Delivery + simulated payments** — the built-in COD option needs no gateway at all.

---

## Quick reference — the exact strings

```bash
# Render Build Command
cd server && npm install && npx prisma generate && npx prisma migrate deploy && node src/seed.js && cd ../client && npm install && npm run build

# Render Start Command
cd server && npm start

# Paystack webhook URL (set in Paystack dashboard)
https://homely-treats.onrender.com/api/payments/webhook

# Paystack test card (sandbox)
4084 0840 8408 4081

# Database create (local only)
sudo -u postgres psql -c "CREATE ROLE homely LOGIN PASSWORD 'homely' CREATEDB;"
sudo -u postgres psql -c "CREATE DATABASE homely OWNER homely;"
```
