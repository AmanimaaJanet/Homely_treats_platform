# 🎂 Homely Treats — Custom Bakery Ordering Platform

A full-stack bakery ordering platform built from your HTML mockup: **React** frontend + **Node.js/Express** backend + **PostgreSQL** (Prisma), with **Paystack** payments (Ghana mobile money & cards), **Resend** email, **WhatsApp Cloud API**, **Textbelt/Arkesel** SMS, and a **PWA** install experience.

> Accra's favourite artisan bakery — order custom cakes, cupcakes & pastries online, pay with MoMo, and track every step live.

> 📖 **New here?** Start with **[GETTING_STARTED.md](GETTING_STARTED.md)** — the full step-by-step from downloading the zip to deploying on Render.

**Professional icon set:** the UI uses **[Lucide](https://lucide.dev) icons** (`lucide-react`) throughout instead of emojis — product cards, navigation, admin dashboard, payment methods, tracking timeline, notifications, and more. Products store a Lucide icon name (e.g. `Cake`, `CakeSlice`, `Heart`, `Citrus`, `Cookie`, `Leaf`, `Cherry`, `Croissant`) and can be changed per-product from the admin panel.

---

## ✨ Features

### Customer storefront
- 🏠 **Home** — hero, featured products, how-it-works, real customer reviews
- 📖 **Menu** — search, category filters, price & name sorting
- 🧁 **Custom Order** — product, quantity, flavour, icing, inscription, required date + **size-based pricing** + **design-photo upload** (show our decorators a cake you love)
- 🛒 **Cart & Checkout** — quantity controls, **delivery zones with per-neighbourhood fees**, promo codes, **loyalty-point redemption**, guest or signed-in checkout
- 🚚 **Track Order** — live **real-time updates over WebSockets** (auto-falls back to polling), full status timeline, rider info, design photos, and the notification log
- 👤 **Accounts** — register, sign in, email verification, profile, password change, order history with **"Order again"**, **loyalty points** balance
- ⭐ **Reviews & ratings** — rate delivered orders (earn +5 bonus points); shown on the homepage
- 🛵 **Rider app** at `/rider` — riders accept deliveries and mark them delivered (updates the customer's tracker instantly)
- 📱 **PWA** — installable to the home screen (manifest + service worker + icons)

### Admin portal (`/admin`)
- 📊 **Dashboard** — revenue, orders, customers, 8-month revenue chart, category donut
- 📋 **Orders** — filter/search, detail view with photos & status history, one-click status updates (auto-notifies customer via SMS + WhatsApp + email + WebSocket)
- 🗂️ **Products** — full CRUD incl. **size-tier pricing** and **low-stock alerts**
- 👥 **Customers** — orders, spend, loyalty points
- 🎟️ **Promo codes** — percentage/fixed discounts with usage limits
- 📈 **Reports** — date-range sales report, top products, **CSV export**
- ⚙️ **Settings** — business info, lead time, **delivery zones management**, payment methods, loyalty/reviews toggles, notification toggles

### Integrations (all degrade gracefully to simulation when keys are absent)
| Service | What it does | Notes |
|---|---|---|
| **Paystack** | MTN MoMo, AirtelTigo, Vodafone Cash, Visa/MC | Test keys need **no business docs** — free signup |
| **Resend** | Order confirmations, receipts, status updates, email verification | Free 100/day, 3,000/month |
| **WhatsApp Cloud API** | WhatsApp notifications | Free test number, 1,000 conversations/month |
| **Textbelt** | SMS (free 1/day) | ⚠️ free tier blocked for Ghana numbers |
| **Arkesel** | SMS (Ghana-based) | ✅ recommended for GH — free trial credits |
| **Cloudinary** | Design-photo storage (required on Render) | Free tier |

**No credentials?** Everything still runs in **simulation mode**: payments simulated with a demo MoMo screen, and emails/WhatsApp/SMS printed to the server console — the entire flow is demoable with zero signups.

---

## 🚀 Quick start

### macOS / Linux (or WSL)

```bash
bash scripts/setup.sh
```

### Windows

```bash
powershell -ExecutionPolicy Bypass -File scripts/setup.ps1
```

See **[WINDOWS_SETUP.md](WINDOWS_SETUP.md)** for full Windows instructions (the `.sh` script won't run natively on Windows).

### Manual

**1. Database (PostgreSQL)**
```sql
CREATE ROLE homely LOGIN PASSWORD 'homely' CREATEDB;
CREATE DATABASE homely OWNER homely;
```

**2. Backend**
```bash
cd server
cp ../.env.example .env     # edit with your keys (see below)
npm install
npx prisma migrate deploy
npm run db:seed
npm run dev                 # API + WebSockets on http://localhost:5000
```

**3. Frontend (dev, hot reload)**
```bash
cd client
npm install
npm run dev                 # http://localhost:5173 (proxies /api, /uploads, /ws)
```

**Production-ish (one port)** — API serves the built frontend:
```bash
npm run build:client        # from repo root
cd server && npm start      # http://localhost:5000
```

### Admin account (seeded)
| Role | Email | Password |
|---|---|---|
| Admin | `admin@homelytreats.gh` | `admin123` |

> The storefront ships **empty** — no demo products, reviews, promos or zones. Build the catalog from **Admin → Products** and **Admin → Settings** (delivery zones, promos). This keeps the live site free of fake content.

### Try it end-to-end
1. Sign in to **Admin** (`/admin`) → **Products → Add Product** — create a cake with size options (6" / 8" / 10" / 12") and save.
2. **Settings → Delivery Zones** — add a zone (e.g. "East Legon", fee 30) and a **Promo code**.
3. Open the storefront → **Custom Order** → pick your product, **choose a size** (watch the price change) → add to cart.
4. At checkout pick **Home Delivery → choose a zone** (fee auto-updates), enter the promo code, and if signed in, **redeem loyalty points**.
5. Pay with the **simulated MoMo screen** → land on the live tracking page.
6. In **Admin → Orders**, change the status → watch the tracker update in real time (SMS/WhatsApp/email logged to console).

---

## 🧪 Testing

A self-contained end-to-end test (50+ assertions) covers every feature. It builds its own fixtures through the admin API and cleans up afterwards, so it runs against a clean database:

```bash
cd server
npm start                 # (or npm run dev) in one terminal
node test-e2e.mjs         # in another — prints ✅/❌ for each check
```

Covers: products & size pricing, zones, reviews, PWA assets, photo upload, order math (promo + zone + size), loyalty earn/redeem/refund, review rules, WebSocket broadcasts, rider accept/deliver flow, sales reports + CSV export, and auth guards.

---

## 🔑 Configuration (`server/.env`)

```env
PORT=5000
DATABASE_URL=postgresql://homely:homely@localhost:5432/homely?schema=public
JWT_SECRET=change-me-to-a-long-random-string
CLIENT_URL=http://localhost:5173     # payment callback + verify links

# Paystack (blank = simulated payments)
PAYSTACK_SECRET_KEY=
PAYSTACK_PUBLIC_KEY=

# Resend (blank = emails printed to console)
RESEND_API_KEY=
EMAIL_FROM=Homely Treats <onboarding@resend.dev>

# WhatsApp Cloud API (blank = simulated)
WHATSAPP_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=

# SMS: 'textbelt' or 'arkesel' (recommended for Ghana)
SMS_PROVIDER=textbelt
SMS_SENDER=HomelyTreats
TEXTBELT_API_KEY=textbelt
ARKESEL_API_KEY=

# Photos: blank = local disk; set Cloudinary for Render/production
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
CLOUDINARY_UPLOAD_PRESET=
```

### Loyalty rules (configurable in `server/src/config.js`)
- Earn **1 point per GH₵ 1** spent (paid orders) + **5 points per review**
- Redeem **20 points = GH₵ 1**, max 50% of an order's value
- Points are refunded if an order is cancelled

---

## 🗂️ Project structure

```
homely-treats/
├── client/                  # React (Vite) — PWA
│   ├── public/              # manifest.webmanifest, sw.js, icons/
│   └── src/
│       ├── pages/           # Home, Menu, CustomOrder, Cart, Track, Rider, Auth, Account, admin/*
│       ├── components/      # Navbar, Footer, ProductCard, StatusBadge, Toasts
│       ├── store.jsx        # auth + cart state (localStorage-persisted)
│       ├── api.js           # fetch wrapper + loyalty helpers
│       └── styles.css
├── server/                  # Node.js + Express + Prisma + WebSockets
│   ├── prisma/schema.prisma # User, Product, ProductSize, DeliveryZone, Order, OrderItem,
│   │                        # OrderPhoto, OrderEvent, Notification, Review, Promo, Setting
│   ├── src/
│   │   ├── routes/          # auth, products, orders, payments, promos, admin, uploads, zones, reviews, rider
│   │   ├── services/        # paystack, email, sms, whatsapp, storage, loyalty, realtime (WS), orderEvents, settings
│   │   └── seed.js
│   └── test-e2e.mjs         # 47-assertion feature test
├── scripts/                 # setup.sh (macOS/Linux/WSL) + setup.ps1 (Windows)
├── RENDER_DEPLOY.md         # step-by-step Render + Postgres deployment
└── WINDOWS_SETUP.md         # Windows / VS Code instructions
```

---

## 🚀 Deployment

See **[RENDER_DEPLOY.md](RENDER_DEPLOY.md)** for a full step-by-step: GitHub → Render PostgreSQL → Render Web Service → env vars → integrations.

Key points:
- One service runs both API and built frontend (build command installs, builds, and migrates).
- Use **Cloudinary** for photo storage (Render's disk is ephemeral).
- Free tier sleeps after inactivity (~30–60 s wake); upgrade to Starter to avoid it.

---

## 🧭 How a payment flows

1. Customer builds an order → `POST /api/orders` (validates zone, size price, promo, loyalty points).
2. Server initialises Paystack in **pesewas** (`GHS × 100`) with `mobile_money` provider + phone or card.
3. Customer is redirected to Paystack's hosted checkout (or the simulated MoMo screen without keys).
4. Paystack confirms via HMAC-verified **webhook** and/or the return URL verify call.
5. Order → `CONFIRMED`, payment → `PAID`, loyalty points awarded, customer notified (email + SMS + WhatsApp), and the tracking page updates **live via WebSocket**.

Status pipeline: `PENDING → CONFIRMED → IN_PROGRESS → READY → OUT_FOR_DELIVERY (deliveries) → DELIVERED` or `CANCELLED`.

---

## 💡 Future ideas

- WhatsApp templates + a proper rider login/role, delivery zones beyond Accra, size-based *per-product* pricing refinements, order photo print/spec sheets, automated marketing emails, multi-vendor support.

Built as a full-stack upgrade of the original single-page mockup — © 2026 Homely Treats Service Limited.
