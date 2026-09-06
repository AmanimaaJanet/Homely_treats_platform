# 🚀 Homely Treats — From Download to Deploy (Step by Step)

This guide takes you from **unzipping the project** to a **live deployment on Render**. For the exhaustive version (every command and file shown, including the full Render PostgreSQL connection walkthrough), see **[FULL_SETUP_GUIDE.md](FULL_SETUP_GUIDE.md)**.

---

## PART 1 — Download & open in VS Code

1. **Download `homely-treats.zip`** and extract it somewhere easy, e.g. `C:\projects\homely-treats` (Windows) or `~/projects/homely-treats` (Mac/Linux).
2. **Open VS Code** → *File → Open Folder* → select the extracted `homely-treats` folder.
3. You should see this structure:

```
homely-treats/
├── client/            ← React frontend
├── server/            ← Node.js backend
├── scripts/           ← setup.sh (Mac/Linux) + setup.ps1 (Windows)
├── README.md          ← feature overview
├── RENDER_DEPLOY.md   ← Render-specific detail
├── WINDOWS_SETUP.md   ← Windows-specific detail
├── .env.example       ← template for your keys
└── package.json
```

> **Note:** `node_modules/`, `client/dist/` and `server/uploads/` are intentionally **not** in the zip — they are generated. Everything else (including the database migrations) is included.

---

## PART 2 — Install the prerequisites (one-time)

| Tool | Windows | Mac/Linux |
|---|---|---|
| **Node.js 20 LTS** | https://nodejs.org | `brew install node@20` or nvm |
| **PostgreSQL 16+** | https://www.postgresql.org/download/windows/ | `brew install postgresql@16` or apt |
| **Git** | https://git-scm.com | usually pre-installed |
| **VS Code** | https://code.visualstudio.com | same |

Check everything installed:

```bash
node -v     # expect v20.x
npm -v      # expect 10.x
psql --version
git --version
```

---

## PART 3 — Create the database

Open a terminal and run (Windows users: open **SQL Shell (psql)** or pgAdmin → *Query Tool*):

```sql
CREATE ROLE homely LOGIN PASSWORD 'homely' CREATEDB;
CREATE DATABASE homely OWNER homely;
```

- **Windows tip:** `psql` is usually at `C:\Program Files\PostgreSQL\16\bin\psql.exe` — connect with `psql -U postgres` first and enter the postgres password you set during install.
- **Mac (Homebrew):** `brew services start postgresql@16` first.
- **Linux:** `sudo service postgresql start` first.

---

## PART 4 — Configure `.env`

1. In VS Code's terminal, create your env file from the template:
   - **Mac/Linux/WSL:** `cp .env.example server/.env`
   - **Windows PowerShell:** `Copy-Item .env.example server\.env`
2. Open `server/.env`. The `DATABASE_URL` is already `postgresql://homely:homely@localhost:5432/homely?schema=public` — it matches the database you just created (change it only if you used a different password/port).
3. Leave every key **blank** for now — the app runs in full **demo mode** (simulated payments, console-logged emails/SMS/WhatsApp). You'll add real keys later in Part 8.

> ⚠️ `.env` is listed in `.gitignore` — it will **not** be uploaded to GitHub. That's correct and secure. Render gets these values from its own dashboard (Part 7). The full guide is in **FULL_SETUP_GUIDE.md**.

---

## PART 5 — Run it locally

### Option A — one command

**Mac/Linux/WSL:**
```bash
bash scripts/setup.sh
```

**Windows (PowerShell):**
```powershell
powershell -ExecutionPolicy Bypass -File scripts\setup.ps1
```

This installs dependencies, applies migrations, creates the admin account, builds the frontend, and starts the server on **http://localhost:5000**.

### Option B — manual (if you prefer)

```bash
# Backend
cd server
npm install
npx prisma migrate deploy      # applies the database schema
npm run db:seed                # creates the admin account (storefront starts empty)
npm run dev                    # API + WebSockets on http://localhost:5000

# Frontend (new terminal, for hot-reload dev)
cd client
npm install
npm run dev                    # http://localhost:5173
```

### Option C — production-style (one port)

```bash
cd server
npm install
npx prisma migrate deploy
npm run db:seed

cd ../client
npm install
npm run build                  # builds client/dist

cd ../server
npm start                      # serves app + API on http://localhost:5000
```

---

## PART 6 — Verify everything works

Open **http://localhost:5000** and check:

| What to test | How |
|---|---|
| Storefront | Home, Menu, Custom Order (size pricing changes live) |
| Checkout | Sign in to **/admin** → add a product + a delivery zone + a promo code → then add to cart → delivery zone → promo → pay (simulated MoMo screen) |
| Tracking | After payment you land on the live tracker |
| Admin | `/admin` — login `admin@homelytreats.gh` / `admin123` |
| Rider app | `/rider` — appears once an order is set to **Ready** in Admin → Orders |
| Test suite | `cd server && node test-e2e.mjs` → **47/47 pass** |

**Admin account:** `admin@homelytreats.gh / admin123` (change it after first login). The storefront starts empty — add products, delivery zones and promos from the Admin Dashboard.

---

## PART 7 — Push to GitHub

```bash
cd homely-treats
git init
git add .
git commit -m "Homely Treats full-stack app"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/homely-treats.git
git push -u origin main
```

> 🔒 **Before pushing:** run `git status` and confirm `server/.env` and `server/uploads/` are NOT listed (they're gitignored). If they appear, they were added earlier — run `git rm -r --cached server/.env server/uploads` first.

---

## PART 8 — Deploy on Render (free tier)

### 8.1 Create the PostgreSQL database

1. Go to https://render.com → **Sign in** (GitHub login works).
2. **New → PostgreSQL** → name `homely-treats-db` → choose a region → **Free** plan → *Create*.
3. Copy the **Internal Database URL** (looks like `postgresql://user:pass@host:5432/homely_treats_db`).

### 8.2 Create the Web Service

1. **New → Web Service** → connect your GitHub repo (`homely-treats`).
2. Fill in:

| Setting | Value |
|---|---|
| Name | `homely-treats` |
| Region | same as your database |
| **Build Command** | `cd server && npm install && npx prisma generate && npx prisma migrate deploy && node src/seed.js && cd ../client && npm install && npm run build` |
| **Start Command** | `cd server && npm start` |
| Plan | Free |

3. **Create Web Service** (it will fail its first build until we add env vars — that's fine).

### 8.3 Add environment variables

On the Web Service → **Environment** tab, add:

| Key | Value |
|---|---|
| `DATABASE_URL` | *(the Internal Database URL from 8.1)* |
| `JWT_SECRET` | a long random string (e.g. from https://1password.com/password-generator) |
| `CLIENT_URL` | `https://homely-treats.onrender.com` (your actual service URL) |
| `PAYSTACK_SECRET_KEY` | *(leave blank for now → demo payments)* |
| `PAYSTACK_PUBLIC_KEY` | *(blank)* |
| `RESEND_API_KEY` | *(blank → emails logged to console)* |
| `EMAIL_FROM` | `Homely Treats <onboarding@resend.dev>` |
| `SMS_PROVIDER` | `textbelt` |
| `SMS_SENDER` | `HomelyTreats` |
| `TEXTBELT_API_KEY` | `textbelt` |
| `WHATSAPP_TOKEN` | *(blank → WhatsApp logged to console)* |
| `WHATSAPP_PHONE_NUMBER_ID` | *(blank)* |
| `CLOUDINARY_CLOUD_NAME` | *(needed for photo uploads — see 8.5)* |
| `CLOUDINARY_API_KEY` | *(see 8.5)* |
| `CLOUDINARY_API_SECRET` | *(see 8.5)* |

> `PORT` is **not** needed — Render injects it automatically.

Click **Save & Deploy**.

### 8.4 Verify the deployment

When the build finishes, open `https://homely-treats.onrender.com` and repeat the checks from Part 6.

> 🕐 **Free-tier note:** the service sleeps after ~15 min idle and takes ~30–60 s to wake on the next visit. Upgrade to Starter to remove cold starts.

### 8.5 Photo uploads need Cloudinary ⚠️

Render's disk is wiped on every deploy, so customer design photos won't survive. Enable **Cloudinary** (free):

1. Sign up at https://cloudinary.com → copy **Cloud name**, **API key**, **API secret** from the dashboard.
2. Paste them into the Render env vars (`CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`).
3. **Deploy** again — uploads now store permanently.

---

## PART 9 — Turn on real integrations (when ready)

| Integration | Sign-up | Env vars to set on Render | Cost |
|---|---|---|---|
| **Paystack** (MoMo + cards) | https://dashboard.paystack.com | `PAYSTACK_SECRET_KEY`, `PAYSTACK_PUBLIC_KEY` | Free to test (no business docs) |
| **Resend** (email) | https://resend.com | `RESEND_API_KEY`, `EMAIL_FROM` | Free 100/day |
| **Arkesel** (SMS, GH) | https://sms.arkesel.com | `SMS_PROVIDER=arkesel`, `ARKESEL_API_KEY` | Free trial |
| **WhatsApp** | https://developers.facebook.com → App → WhatsApp | `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` | Free test number |
| **Cloudinary** (photos) | https://cloudinary.com | `CLOUDINARY_*` | Free tier |

Set the keys → **Deploy** → done. Everything also has a graceful fallback, so a missing key never breaks the app.

### Going live with Paystack (Ghana)
- **Test mode** works instantly with just an email — real MoMo prompts in sandbox, no business certificates.
- **Live mode** needs business verification later. Until then, run test keys or rely on the built-in **Cash on Delivery** option.

---

## PART 10 — After first login (important)

1. Sign in as admin → **My Account → Change Password** (or run the app and change `admin123`).
2. In **Admin → Settings**, set your real business name, address, phone, delivery fees and zones.
3. Create a new promo code for your launch.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `connection refused` on 5432 | PostgreSQL isn't running — start it (Services app on Windows, `brew services start postgresql@16` on Mac) |
| `P1001: Can't reach database server` | Wrong `DATABASE_URL` or Postgres down — check `.env` |
| Port 5000 in use | Change `PORT` in `server/.env` (local) — Render handles its own |
| `vite: not found` / `node: not found` | Run `npm install` in both `server/` and `client/` |
| PowerShell blocks scripts | `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` |
| Render build fails on migrate | Confirm `DATABASE_URL` env var is set to the **Internal** URL |
| "We're not accepting new orders" | Admin → Settings → toggle *Accept Online Orders* back on |
