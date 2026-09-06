# 🚀 Homely Treats — Complete Setup Guide

> From your computer → running locally → live on Render (with PostgreSQL), step by step.
> Every command and every file is shown in full. No steps skipped.
>
> 🖱️ Prefer a click-by-click walkthrough of the Render screens and Paystack setup? See
> **[RENDER_WALKTHROUGH.md](RENDER_WALKTHROUGH.md)**.

---

## 0. What you received (the full code)

`homely-treats.zip` contains the complete project — **107 files**, no `node_modules`, no secrets:

```
homely-treats/
├── .env.example          ← template you copy to create your real .env (see Part 4)
├── .gitignore            ← keeps secrets & build output out of GitHub
├── package.json          ← root scripts + Node version (20.x)
├── README.md             ← feature overview
├── GETTING_STARTED.md    ← quick-start summary
├── FULL_SETUP_GUIDE.md   ← this file
├── RENDER_DEPLOY.md      ← Render-specific detail
├── WINDOWS_SETUP.md      ← Windows-specific detail
├── scripts/
│   ├── setup.sh          ← one-command setup (Mac/Linux/WSL)
│   └── setup.ps1         ← one-command setup (Windows PowerShell)
├── server/               ← Node.js + Express backend (the API)
│   ├── package.json
│   ├── prisma/
│   │   ├── schema.prisma        ← database schema (PostgreSQL)
│   │   └── migrations/          ← ready-to-apply migrations (init, features_v2, product_icon)
│   ├── src/
│   │   ├── index.js             ← server entry (API + serves built frontend + WebSockets)
│   │   ├── config.js            ← reads your .env
│   │   ├── seed.js              ← creates the admin account (idempotent, safe to re-run)
│   │   ├── routes/              ← auth, orders, payments (Paystack), products, reviews,
│   │   │                           admin, rider, uploads, settings, zones, promos
│   │   ├── services/            ← email (Resend), sms (Textbelt/Arkesel), whatsapp,
│   │   │                           paystack, loyalty, orderEvents, storage, settings
│   │   └── test-e2e.mjs         ← 52-assertion feature test (self-contained)
│   └── test-e2e.mjs
└── client/               ← React + Vite frontend (the storefront)
    ├── package.json
    ├── vite.config.js
    ├── index.html
    ├── public/           ← brand.png, favicon.ico, og.jpg, PWA icons, manifest, sw.js
    └── src/
        ├── main.jsx, App.jsx, store.jsx, api.js, styles.css
        ├── components/   ← Navbar, ProductCard, ProductIcon, StatusBadge, …
        └── pages/        ← Home, Menu, CustomOrder, Cart, Track, Account, Rider, …
            └── admin/    ← Dashboard, Orders, Products, Customers, Reports, Settings, Promos
```

**Two things the zip deliberately does NOT include** (you create them in the next parts):

1. `server/.env` — your environment keys (Part 4)
2. `node_modules/`, `client/dist/`, `server/uploads/` — generated on install/build/run

---

## 1. Install the tools once

| Tool | Windows | Mac | Linux |
|---|---|---|---|
| **Node.js 20 LTS** | https://nodejs.org → download & install | `brew install node@20` | `curl -fsSL https://deb.nodesource.com/setup_20.x \| sudo -E bash - && sudo apt-get install -y nodejs` |
| **PostgreSQL 16+** | https://www.postgresql.org/download/windows/ → run installer (remember the **postgres** password you set) | `brew install postgresql@16` | `sudo apt-get install -y postgresql` |
| **Git** | https://git-scm.com | `brew install git` | `sudo apt-get install -y git` |
| **VS Code** | https://code.visualstudio.com | same | same |

Check they're installed:

```bash
node -v        # → v20.x
npm -v         # → 10.x
psql --version # → psql (PostgreSQL) 16.x / 17.x
git --version
```

---

## 2. Unzip and open in VS Code

1. Extract `homely-treats.zip` anywhere, e.g. `C:\projects\homely-treats` or `~/projects/homely-treats`.
2. VS Code → **File → Open Folder…** → select the `homely-treats` folder.
3. Open a terminal in VS Code (**Terminal → New Terminal**) — it opens in the project folder automatically.

---

## 3. Create the local database

> **Skip this for Render** — Render creates the database for you in Part 8. This is only for running on your computer.

### 3a. Start PostgreSQL

- **Windows:** the installer runs it as a service automatically. To be sure, open **Services** app → find `postgresql-x64-16` → Start.
- **Mac:** `brew services start postgresql@16`
- **Linux:** `sudo service postgresql start` (or `sudo pg_ctlcluster 17 main start`)

### 3b. Create the role + database

**Mac / Linux (terminal):**

```bash
sudo -u postgres psql -c "CREATE ROLE homely LOGIN PASSWORD 'homely' CREATEDB;"
sudo -u postgres psql -c "CREATE DATABASE homely OWNER homely;"
```

**Windows (SQL Shell / psql):**

Open **SQL Shell (psql)** from the Start menu, or PowerShell:

```powershell
& "C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres
# enter the postgres password you set during install, then:
CREATE ROLE homely LOGIN PASSWORD 'homely' CREATEDB;
CREATE DATABASE homely OWNER homely;
\q
```

> If the role/database already exist, these commands will say "already exists" — that's fine.

---

## 4. Create your `server/.env`

The zip ships `.env.example` (in the root) but **not** the real `.env` (secrets are never committed). Create it:

```bash
cp .env.example server/.env        # Mac / Linux / WSL
```

```powershell
Copy-Item .env.example server\.env # Windows PowerShell
```

`server/.env` will look like this — **this exact content runs the app locally with zero signups**:

```env
# ===== Server =====
PORT=5000
DATABASE_URL=postgresql://homely:homely@localhost:5432/homely?schema=public
JWT_SECRET=change-me-to-a-long-random-string
CLIENT_URL=http://localhost:5173

# ===== Paystack (Ghana: MTN MoMo, AirtelTigo, Vodafone Cash, Cards) =====
# Leave blank to run in "Simulated Payment" mode (no keys needed).
PAYSTACK_SECRET_KEY=
PAYSTACK_PUBLIC_KEY=

# ===== Email — Resend =====
RESEND_API_KEY=
EMAIL_FROM=Homely Treats <onboarding@resend.dev>

# ===== WhatsApp Cloud API =====
WHATSAPP_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=

# ===== SMS =====
SMS_PROVIDER=textbelt
SMS_SENDER=HomelyTreats
TEXTBELT_API_KEY=textbelt
ARKESEL_API_KEY=

# ===== Design-photo storage =====
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
CLOUDINARY_UPLOAD_PRESET=
```

**What the blanks mean:** every integration runs in **simulation mode** — payments show a demo MoMo screen, and emails/SMS/WhatsApp print to the server console. The whole app works end-to-end with **no external accounts**.

> `DATABASE_URL` above matches the database from Part 3. If you used a different password or port, change it here.

---

## 5. Run it locally

### Option A — one command

**Mac / Linux / WSL:**

```bash
bash scripts/setup.sh
```

**Windows PowerShell:**

```powershell
powershell -ExecutionPolicy Bypass -File scripts\setup.ps1
```

This installs dependencies, applies migrations, creates the admin account, builds the frontend, and starts the app at **http://localhost:5000**.

### Option B — manual (same thing, step by step)

```bash
# 1) Backend
cd server
npm install
npx prisma generate          # builds the Prisma client
npx prisma migrate deploy    # creates the tables in PostgreSQL
npm run db:seed              # creates the admin account
npm start                    # API + app on http://localhost:5000
```

```bash
# 2) Frontend — separate terminal, only if you want hot-reload during development
cd client
npm install
npm run dev                  # http://localhost:5173 (proxies /api → :5000)
```

For a **production-style single port** (like Render), build the frontend once:

```bash
npm run build:client         # from repo root — builds client/dist
cd server && npm start       # serves app + API on http://localhost:5000
```

---

## 6. Verify locally

Open **http://localhost:5000** and check:

1. **Home page** loads with your brand logo (empty menu state — you build the catalog yourself).
2. Sign in at **/admin** → `admin@homelytreats.gh` / `admin123`.
3. **Admin → Products → Add Product** — create a cake with size options (6"/8"/10"/12").
4. **Admin → Settings** — add a **delivery zone** (e.g. "East Legon", fee 30) and a **promo code**.
5. Back on the storefront: order your product → choose size → checkout → pay (simulated MoMo) → land on the live tracker.
6. Run the test suite (server running in another terminal):

```bash
cd server
node test-e2e.mjs    # → 52 passed · 0 failed
```

---

## 7. Push to GitHub

```bash
cd homely-treats
git init
git add .
git commit -m "Homely Treats — full-stack bakery ordering platform"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/homely-treats.git
git push -u origin main
```

> 🔒 **Check before pushing:** `git status` must NOT list `server/.env` or `server/uploads/` (they're in `.gitignore`). If they show up, remove them: `git rm -r --cached server/.env server/uploads`.

---

## 8. Deploy on Render (with PostgreSQL)

### 8.1 Create the PostgreSQL database

1. Go to **https://render.com** → **Sign in with GitHub**.
2. Top-right: **New → PostgreSQL**.
3. Fill in:
   - **Name:** `homely-treats-db`
   - **Region:** choose one (remember it — the web service must be in the same region)
   - **Instance Type:** **Free**
4. Click **Create Database**. Wait ~1 min for "Available".

### 8.2 Copy the internal connection string

1. Open your database → **Connections** tab.
2. Copy the **Internal Database URL** (or "Internal Connection String"). It looks like:

```
postgresql://homely_treats_db_user:AbCd1234XyZ@dpg-xxxxxxxxxxxx-a.oregon-postgres.render.com/homely_treats_db
```

> ⚠️ Use the **Internal** URL (not External) — it stays inside Render's network: faster, and no firewall/SSL setup. You'll paste it into the web service in 8.4.

### 8.3 Create the Web Service

1. **New → Web Service** → choose **"Build and deploy from a Git repository"** → select your `homely-treats` repo.
2. Fill in:

| Field | Value |
|---|---|
| **Name** | `homely-treats` |
| **Region** | *same as your database* |
| **Branch** | `main` |
| **Runtime** | Node |
| **Build Command** | `cd server && npm install && npx prisma generate && npx prisma migrate deploy && node src/seed.js && cd ../client && npm install && npm run build` |
| **Start Command** | `cd server && npm start` |
| **Instance Type** | **Free** |

3. Click **Create Web Service**. It will start a build — **it may fail on the first try** because the `DATABASE_URL` isn't set yet. That's expected; continue to 8.4.

### 8.4 Connect the database + set environment variables

On the web service page → **Environment** tab → add these variables:

| Key | Value | Required? |
|---|---|---|
| `DATABASE_URL` | *(paste the Internal Database URL from 8.2)* | ✅ **yes** |
| `JWT_SECRET` | a long random string, e.g. from https://1password.com/password-generator | ✅ **yes** |
| `CLIENT_URL` | `https://homely-treats.onrender.com` (your actual service URL) | ✅ **yes** |
| `NODE_VERSION` | `20` | recommended |
| `PAYSTACK_SECRET_KEY` | *(blank for now)* | no |
| `PAYSTACK_PUBLIC_KEY` | *(blank for now)* | no |
| `RESEND_API_KEY` | *(blank for now)* | no |
| `EMAIL_FROM` | `Homely Treats <onboarding@resend.dev>` | no |
| `WHATSAPP_TOKEN` | *(blank for now)* | no |
| `WHATSAPP_PHONE_NUMBER_ID` | *(blank for now)* | no |
| `SMS_PROVIDER` | `textbelt` | no |
| `SMS_SENDER` | `HomelyTreats` | no |
| `TEXTBELT_API_KEY` | `textbelt` | no |
| `ARKESEL_API_KEY` | *(blank for now)* | no |
| `CLOUDINARY_CLOUD_NAME` | *(blank for now — see note below)* | no |
| `CLOUDINARY_API_KEY` | *(blank for now)* | no |
| `CLOUDINARY_API_SECRET` | *(blank for now)* | no |
| `CLOUDINARY_UPLOAD_PRESET` | *(blank for now)* | no |

> - Do **NOT** set `PORT` — Render injects it automatically (the app already reads `process.env.PORT`).
> - Do **NOT** append `?schema=public` — the internal URL works as-is.

### 8.5 Deploy & verify

1. Click **Save Changes** — this restarts the build. Watch the logs.
2. When the build finishes, open **https://homely-treats.onrender.com**.
3. Log in at `/admin` → `admin@homelytreats.gh` / `admin123`, change the password, and add your products, zones and promos — exactly like Part 6.

**What the build command does, in order:**

```
cd server && npm install                # backend dependencies
npx prisma generate                     # generate DB client
npx prisma migrate deploy               # create the tables in the Render PostgreSQL
node src/seed.js                        # create the admin account (idempotent)
cd ../client && npm install             # frontend dependencies
npm run build                           # build React into client/dist
```

> 🕐 **Free-tier note:** the service sleeps after ~15 min of inactivity and takes ~30–60 s to wake on the next visit. Upgrade to **Starter** ($7/mo) to remove cold starts.

> 📸 **Photo uploads on Render:** Render's disk resets on every deploy, so customer design photos won't survive. Set the three `CLOUDINARY_*` variables (free at https://cloudinary.com) to store them permanently — the app switches automatically.

---

## 9. Turn on the real integrations (when ready)

Add the keys to Render → **Environment** → **Save Changes** → deploy. A missing key never breaks the app — it just simulates.

| Integration | Sign-up | Keys to set | Cost |
|---|---|---|---|
| **Paystack** (MoMo + cards, GH) | https://dashboard.paystack.com → Settings → API Keys | `PAYSTACK_SECRET_KEY`, `PAYSTACK_PUBLIC_KEY` | Free to test — works with **no business certificates** |
| **Resend** (email) | https://resend.com → verify your domain | `RESEND_API_KEY`, `EMAIL_FROM` | Free 100/day |
| **Arkesel** (SMS, Ghana) | https://sms.arkesel.com | `SMS_PROVIDER=arkesel`, `ARKESEL_API_KEY` | Free trial credits |
| **WhatsApp** | https://developers.facebook.com → App → WhatsApp → test number | `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` | Free test number |
| **Cloudinary** (photos) | https://cloudinary.com | `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Free tier |

**Going live with Paystack (Ghana):** test keys work instantly with just an email — real MoMo prompts in sandbox, no business documents. Live mode needs business verification later; until then, run test keys or rely on the built-in **Cash on Delivery** option.

---

## 10. Everyday workflow (change → deploy)

1. Edit code in VS Code (on a branch if you like).
2. Commit & push:

```bash
git add .
git commit -m "Describe what changed"
git push
```

3. Render **auto-deploys** on every push to `main` (or click **Manual Deploy → Deploy latest commit**).
4. To change settings/products/content — **no code needed**: use the **Admin Dashboard** (products, prices, sizes, zones, promos, settings). That data lives in the database and survives deploys.

---

## 11. Troubleshooting

| Problem | Fix |
|---|---|
| `P1001: Can't reach database server` | Postgres isn't running (local) or `DATABASE_URL` is wrong (Render). Check Part 3 / 8.4. |
| `connection refused` on port 5432 | Start PostgreSQL — Services app (Windows), `brew services start postgresql@16` (Mac), `sudo service postgresql start` (Linux). |
| `vite: not found` / `sh: node: not found` | Run `npm install` in both `server/` and `client/`. |
| Port 5000 already in use | Change `PORT` in `server/.env` (local only — Render injects its own). |
| Render build fails at `prisma migrate deploy` | `DATABASE_URL` env var missing/wrong — paste the **Internal** URL exactly. |
| PowerShell blocks scripts | `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`. |
| "We're not accepting new orders" | Admin → Settings → toggle **Accept Online Orders** back on. |
| App wakes slowly on Render | Normal free-tier cold start — upgrade to Starter. |
| Photos disappear after redeploy | Set the `CLOUDINARY_*` env vars (Part 8.5 note). |
