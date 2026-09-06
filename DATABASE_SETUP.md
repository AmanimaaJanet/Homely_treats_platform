# 🗄️ Homely Treats — PostgreSQL & Database (Render)

This document covers **only the database**: what it is, how to create it on Render,
how to connect it, and how to recreate the tables. Nothing else.

---

## 1. The database of this system

Homely Treats uses **PostgreSQL** with **13 tables**. The exact schema lives in two places
in the project — both describe the *same* database:

| File | What it is | Used by |
|---|---|---|
| `server/prisma/schema.prisma` | Data model in Prisma's language | The app (generates the DB client) |
| `server/prisma/migrations/` | 3 SQL migration files (`init`, `features_v2`, `product_icon`) | `prisma migrate deploy` |
| `database/schema.sql` | One plain SQL file with **all 13 tables** (exact dump) | Manual import via psql/pgAdmin |

### The 13 tables

| # | Table | What it stores |
|---|---|---|
| 1 | `User` | Admins & customers — `fullName`, `email`, `phone`, `passwordHash`, `role` (CUSTOMER/ADMIN), `loyaltyPoints` |
| 2 | `Product` | Catalog items — `name`, `description`, `category`, `basePrice`, `icon`, `flavors[]`, `sizes[]`, `stock`, `featured`, `isActive` |
| 3 | `ProductSize` | Size-based pricing per product — `label` ("8 inch (serves 14)"), `serves`, `price` |
| 4 | `DeliveryZone` | Accra delivery zones — `name` (unique), `fee`, `active` |
| 5 | `Order` | Every order — status, payment status/method, totals, delivery details, rider, dates, promo |
| 6 | `OrderItem` | Line items — `name`, `price`, `quantity`, `flavor`, `size`, `icing`, `inscription` |
| 7 | `OrderPhoto` | Customer design photos — `url` |
| 8 | `OrderEvent` | Order timeline — `status`, `note`, timestamp |
| 9 | `Notification` | Outbound messages log — `channel` (SMS/EMAIL/WHATSAPP), `type`, `status` |
| 10 | `Review` | Post-delivery reviews — `rating` (1–5), `comment` |
| 11 | `Promo` | Promo codes — `code` (unique), `type`, `value`, `usageLimit`, `usageCount` |
| 12 | `Setting` | Key/value store for admin settings (JSON values) |
| 13 | `_prisma_migrations` | Migration bookkeeping (created by Prisma) |

> All IDs are Prisma `cuid()` strings (e.g. `cmtfqyhq9…`) and order IDs are custom
> codes like `HT-20260830-0001`. There are no auto-increment `serial` columns.

---

## 2. Create the PostgreSQL database on Render (click by click)

1. Go to **https://render.com** → **Sign in with GitHub** → authorize.
2. Dashboard → **New +** (top right) → **PostgreSQL**.
3. Fill in the form:
   - **Name:** `homely-treats-db`
   - **Database / User:** leave the auto-generated values
   - **Region:** pick one (e.g. **Frankfurt**). Remember it — your web service must use the same region.
   - **Instance Type:** **Free**
4. Click **Create Database** and wait ~30–60 s until the status shows **"Available"**.

### The two connection strings

Open the database → **Connections** tab. There are two URLs:

| URL | Where it works | Use it for |
|---|---|---|
| **Internal Database URL** | Only from inside Render (your web service) | The app's `DATABASE_URL` — this is the one you need |
| **External Database URL** | From your computer (pgAdmin, psql) | Connecting tools on your machine |

**Internal URL looks like:**
```
postgresql://homely_treats_db_user:AbCd1234XyZ@dpg-xxxxxxxxxxxx-a.oregon-postgres.render.com/homely_treats_db
```

**External URL looks the same but with a `_...-external...` host and an `ssl` requirement:**
```
postgresql://homely_treats_db_user:AbCd1234XyZ@dpg-xxxxxxxxxxxx-a.oregon-postgres.render.com/homely_treats_db?ssl=true
```

> ⚠️ **Internal** = for the app on Render (no SSL config needed, stays inside Render's network).
> **External** = for *your* computer (pgAdmin/psql); it requires SSL.

---

## 3. Create the tables — two ways

### Way A — Automatic (recommended, what the app does)

The app creates the whole database for you. On Render, the **Build Command** runs:

```
cd server && npm install && npx prisma generate && npx prisma migrate deploy && node src/seed.js && cd ../client && npm install && npm run build
```

`npx prisma migrate deploy` reads `server/prisma/migrations/` and creates **all 13 tables**
in the Render PostgreSQL database, then `node src/seed.js` inserts the admin account
(`admin@homelytreats.gh / admin123`). You do nothing else.

To do the same on your computer:

```bash
cd server
npm install
npx prisma generate
npx prisma migrate deploy     # ← creates all 13 tables
npm run db:seed               # ← inserts the admin account
```

### Way B — Manual (import the SQL file)

If you prefer to create the structure yourself (e.g. via pgAdmin), use `database/schema.sql`:

**pgAdmin:**
1. Connect to the Render database using the **External** URL (see section 4).
2. Right-click the database → **Query Tool**.
3. **Open** `database/schema.sql` → click **Execute** (▶).

**psql (your computer):**

```bash
# Copy the file where postgres can read it, then:
psql "postgresql://homely_treats_db_user:AbCd1234XyZ@dpg-xxxxxxxxxxxx-a.oregon-postgres.render.com/homely_treats_db?ssl=true" -f database/schema.sql
```

**Local (if you created the DB in Part 5):**

```bash
psql -U homely -d homely -f database/schema.sql
```

After import you'll have the same 13 tables. Note: the admin account is **not** in
`schema.sql` (it's data, not structure) — create it by running `npm run db:seed`, or
register the first user through the app.

> ⚠️ If you use **Way B**, the `_prisma_migrations` table will be empty. The next time
> `prisma migrate deploy` runs it will try to apply migrations from scratch and may
> conflict with the tables you created. **Pick one way and stay with it** — Way A for
> normal use, Way B only for inspection or external tooling.

---

## 4. Connect pgAdmin / psql to the Render database

### psql (command line)

```bash
psql "postgresql://USER:PASSWORD@HOST/DATABASE?ssl=true"
```

Replace `USER`, `PASSWORD`, `HOST`, `DATABASE` with the values from the **External Database URL**.

### pgAdmin 4

1. Open pgAdmin → right-click **Servers** → **Register** → **Server…**.
2. **General** tab → Name: `Homely Treats (Render)`.
3. **Connection** tab:
   - **Host name/address:** the host from the External URL (e.g. `dpg-xxxxxxxxxxxx-a.oregon-postgres.render.com`)
   - **Port:** `5432`
   - **Maintenance database:** the database name (e.g. `homely_treats_db`)
   - **Username / Password:** from the External URL
4. **SSL** tab (pgAdmin 4 → **Parameters** tab on newer versions) → set **SSL mode** to `require`.
5. Click **Save**. You'll see the 13 tables under **Databases → your DB → Schemas → public → Tables**.

Useful queries once connected:

```sql
SELECT * FROM "User";            -- admins & customers
SELECT * FROM "Product";         -- catalog
SELECT * FROM "Order";           -- orders
SELECT * FROM "DeliveryZone";    -- delivery zones
```

---

## 5. Local database (running on your computer)

Create it once, before running the app locally:

```bash
sudo -u postgres psql -c "CREATE ROLE homely LOGIN PASSWORD 'homely' CREATEDB;"
sudo -u postgres psql -c "CREATE DATABASE homely OWNER homely;"
```

This matches the default connection string in `server/.env`:

```env
DATABASE_URL=postgresql://homely:homely@localhost:5432/homely?schema=public
```

Then apply the schema exactly as in **Way A**:

```bash
cd server && npm install && npx prisma generate && npx prisma migrate deploy && npm run db:seed
```

---

## 6. Environment variable (the one that matters)

The app reads a single variable for the database. On Render, set it in the web service's
**Environment** tab:

| Key | Value |
|---|---|
| `DATABASE_URL` | *(the Internal Database URL from section 2)* |

Locally, put it in `server/.env` (shown in section 5).

---

## 7. Backups & day-to-day

- **Render backups:** Render's PostgreSQL free tier does **not** include automatic backups.
  For real use, open the database → **Backups** → enable backups, or take manual snapshots.
- **Export a backup from your computer** (External URL):

```bash
pg_dump "postgresql://USER:PASSWORD@HOST/DATABASE?ssl=true" --no-owner -Fc > homely-backup.dump
```

- **Restore:**

```bash
pg_restore --no-owner -d "postgresql://USER:PASSWORD@HOST/DATABASE?ssl=true" homely-backup.dump
```

- **Reset everything locally** (wipe data, re-run migrations + seed):

```bash
cd server && npx prisma migrate reset --force
```
