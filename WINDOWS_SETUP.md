# 🪟 Running Homely Treats on Windows (VS Code)

**Short answer:** `scripts/setup.sh` is a Linux/macOS bash script and **will not run on Windows** (unless you use WSL — see the WSL option below). On Windows you can either use the provided PowerShell script `scripts/setup.ps1`, or follow the manual steps.

---

## Option A — WSL (recommended if you already use it)

If you have **WSL2 + Ubuntu** installed, the whole app runs exactly like Linux:

```bash
wsl
cd /mnt/c/path/to/homely-treats
bash scripts/setup.sh
```

That's it — the Linux script handles Postgres, dependencies, migrations, seed and build.

---

## Option B — PowerShell (native Windows)

### 1. Prerequisites

Install these first (one-time):

1. **Node.js 20 LTS** → https://nodejs.org (includes npm)
2. **PostgreSQL 16+** → https://www.postgresql.org/download/windows/
   - During install, remember the **postgres superuser password** you set.
3. **Git** → https://git-scm.com (optional, for GitHub)

Open VS Code → open the `homely-treats` folder.

### 2. Create the database

Open **pgAdmin** (installed with PostgreSQL) or a terminal:

```powershell
# in PowerShell (psql is usually at C:\Program Files\PostgreSQL\16\bin)
& "C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres
```

Then inside psql:

```sql
CREATE ROLE homely LOGIN PASSWORD 'homely' CREATEDB;
CREATE DATABASE homely OWNER homely;
\q
```

### 3. Configure the environment

In VS Code, create `server\.env` (copy from `.env.example`):

```powershell
Copy-Item .env.example server\.env
```

Edit `server\.env` so `DATABASE_URL` matches your machine:

```env
DATABASE_URL=postgresql://homely:homely@localhost:5432/homely?schema=public
```

> If you used a different Postgres password, change `homely:homely@` accordingly.

### 4. Install, migrate, seed, build

In the VS Code terminal (PowerShell):

```powershell
cd server
npm install
npx prisma migrate deploy
npm run db:seed

cd ..\client
npm install
npm run build
```

### 5. Run it

```powershell
cd ..\server
npm run start
```

Open **http://localhost:5000** in your browser. ✅

### Dev mode (hot reload)

Two terminals:

```powershell
# terminal 1
cd server
npm run dev

# terminal 2
cd client
npm run dev
```

Then open **http://localhost:5173**.

---

## Option C — one PowerShell script

If you've done the prerequisites and created the database, run:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/setup.ps1
```

The script installs dependencies, applies migrations, seeds, builds the frontend, and starts the server. (It does **not** install Node or PostgreSQL for you.)

---

## Setting `.env` values on Windows

- `server\.env` is a plain text file — open it in VS Code and edit the values.
- Do **not** put quotes around values, e.g. `JWT_SECRET=my-super-secret-123` (no quotes).
- Leave a key **blank** to run that integration in simulation mode (payments, email, WhatsApp all still work in demo mode with blank keys).

### The most common `.env` keys

```env
PORT=5000
DATABASE_URL=postgresql://homely:homely@localhost:5432/homely?schema=public
JWT_SECRET=change-me-to-a-long-random-string
CLIENT_URL=http://localhost:5173

PAYSTACK_SECRET_KEY=            # blank = simulated payments
PAYSTACK_PUBLIC_KEY=
RESEND_API_KEY=                 # blank = emails logged to console
EMAIL_FROM=Homely Treats <onboarding@resend.dev>
WHATSAPP_TOKEN=                 # blank = WhatsApp logged to console
WHATSAPP_PHONE_NUMBER_ID=
SMS_PROVIDER=textbelt           # or 'arkesel'
SMS_SENDER=HomelyTreats
TEXTBELT_API_KEY=textbelt
ARKESEL_API_KEY=
CLOUDINARY_CLOUD_NAME=          # blank = photos saved to server/uploads
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
CLOUDINARY_UPLOAD_PRESET=
```

---

## Common Windows issues

| Problem | Fix |
|---|---|
| `npx prisma ...` fails with connection refused | PostgreSQL service not running — start it in **Services** (`services.msc`) → `postgresql-x64-16` |
| Port 5432/5000 already in use | Stop the conflicting app, or change `PORT` in `.env` |
| PowerShell blocks scripts | `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` |
| `npm` not recognised | Reinstall Node.js and restart VS Code |
