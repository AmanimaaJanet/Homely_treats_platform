# Backups and restoring the bakery's data

**The one rule:** a backup you have never restored is not a backup. This document gives
you the two scripts, the schedule, and a restore drill you can run in about a minute.

Everything the business cares about — orders, customers, loyalty points, reviews, stock,
delivery zones, admin accounts — lives in one PostgreSQL database. Uploaded cake photos
live on disk (or on Cloudinary) and are handled separately at the bottom of this page.

---

## 1. Why the database is the whole business

The app is deliberately built so that the database is the only place where anything is
stored. There is no second source of truth to reconcile:

| What | Where it lives | Covered by `backup.sh`? |
|---|---|---|
| Orders, order items, refunds, print data | PostgreSQL | ✅ |
| Customers, guests, loyalty points, addresses | PostgreSQL | ✅ |
| Reviews, ratings, moderation flags | PostgreSQL | ✅ |
| Products, sizes, prices, stock counts | PostgreSQL | ✅ |
| Delivery zones, fees, collection windows, blackout dates | PostgreSQL | ✅ |
| Admins, riders, audit log, notifications sent | PostgreSQL | ✅ |
| Uploaded design photos | `server/uploads/` or Cloudinary | ❌ (see §6) |
| The `.env` file (keys, secrets) | Server disk / Render dashboard | ❌ (see §6) |

---

## 2. Taking a backup

From the project root:

```bash
./scripts/backup.sh
```

Writes `backups/homely-YYYY-MM-DD_HHMM.sql.gz`, checks the file is readable (`gzip -t`),
counts the tables it found, and deletes dumps older than 14 days.

Useful variations:

```bash
BACKUP_DIR=/var/backups/homely ./scripts/backup.sh   # somewhere else
KEEP_DAYS=30 ./scripts/backup.sh                     # keep a month
DATABASE_URL="postgresql://…" ./scripts/backup.sh    # a specific database
```

The script reads `DATABASE_URL` from `server/.env` if it is not already set, so the same
command works on a laptop and against Render (paste the **External Database URL**).

> **Windows note:** run it from **Git Bash** (installed with Git for Windows) or WSL.
> `pg_dump.exe` ships with PostgreSQL and must be on `PATH` — the script tells you if it
> is not. In PowerShell the equivalent single command is:
> ```powershell
> & "C:\Program Files\PostgreSQL\17\bin\pg_dump.exe" $env:DATABASE_URL --no-owner --no-privileges --clean --if-exists | gzip > homely.sql.gz
> ```

**A dump on the same disk is not a backup.** After it runs, copy the file somewhere else:

```bash
scp backups/homely-*.sql.gz you@another-machine:/backups/
```
or upload it to Google Drive / Dropbox. Render's own database snapshots (if your plan has
them) are a second, independent copy — good, but never the only one.

---

## 3. When to run it

| Situation | What to do |
|---|---|
| **Before any risky change** — migration, `prisma migrate deploy`, bulk price edit, CSV import | Back up first. Always. |
| **Before you restore anything** | Take one *now*, called something like `pre-restore`. |
| **Done something destructive by accident?** | Stop using the app, take a backup of what is left, then restore. |
| **Routine** | Daily automated dump (below) + a copy kept off the server. |
| **Monthly** | Rehearse a restore (§4). Five minutes that will save you hours. |

### Automated daily backup on a VPS (Linux)

```bash
crontab -e
```
```cron
# Every day at 02:30 — dump, prune, then sync off the machine.
30 2 * * * cd /srv/homely-treats && ./scripts/backup.sh >> /var/log/homely-backup.log 2>&1
45 2 * * * rsync -az /srv/homely-treats/backups/ backup-host:/backups/homely/ >> /var/log/homely-backup.log 2>&1
```

### On Render

Render's managed Postgres has **Daily Backups** on paid plans (Dashboard → your database
→ Backups; you can restore to a new database from there). For a free-tier database, run
`backup.sh` locally against the **External Database URL** weekly and keep the file — that
is your safety net.

---

## 4. Restoring — rehearse first, always

### The drill (safe: never touches live data)

```bash
# 1. Rehearse into a scratch database
./scripts/restore.sh backups/homely-2026-09-18_0855.sql.gz --target homely_drill

# 2. Compare the copy against production, side by side
./scripts/restore.sh --verify-only --target homely_drill

# 3. Throw the scratch database away
psql "$DATABASE_URL" -c 'DROP DATABASE "homely_drill";'
```

Step 1 prints row counts for orders, order items, products, users, reviews and zones,
then step 2 shows them next to production. If the numbers match, your backup is real.
If they do not, you have found out in a scratch database instead of during an emergency.

**This drill has been run on this project and passes** — a marker order created in
production came back complete after a wipe-and-restore, with its line item, totals,
payment status and foreign key intact (see §7).

### Restoring for real

```bash
./scripts/restore.sh backups/homely-2026-09-18_0855.sql.gz            # refuses: warns you
./scripts/restore.sh backups/homely-2026-09-18_0855.sql.gz --confirm  # does it
```

The script refuses to touch the live database without `--confirm`, because the dump
contains `DROP` statements — restoring replaces everything currently there.

Then, in order:

1. **Restart the API** so it reconnects (on Render: Manual Deploy → Restart, or push any
   commit). A running server holds open connections to the dropped tables.
2. **Sign in to the admin portal** and spot-check three things: the newest order under
   *Orders*, today's revenue under *Reports*, and that product photos still load.
3. **Restore the uploaded photos** if the disk was lost (§6).

### What a restore does *not* undo

- **Photographs uploaded after the dump** are gone unless §6 covers them.
- **Payments taken after the dump**: Paystack still has the money, but the orders that
  recorded it are gone. Check the Paystack dashboard for transactions in the gap and
  re-enter anything missing. That gap is the real cost of relying on a stale backup —
  which is why the drill matters more than the dump.

---

## 5. Common failure modes

| Symptom | Cause and fix |
|---|---|
| `pg_dump: error: invalid URI query parameter: "schema"` | A Prisma-style URL with `?schema=public`. The scripts strip it; if you paste the URL into a tool by hand, remove that part. |
| `pg_dump: error: server version mismatch` | Your client is older than the server. `sudo apt-get install postgresql-client-17` (or the matching major version). |
| `permission denied for schema public` when restoring into Render | Restore into a database the same role owns, or add `--no-owner` (the scripts already do). |
| `FATAL: database "homely_drill" does not exist` | Harmless on the first rehearsal — the script creates it. If it fails, check the role can `CREATEDB`. |
| Restore finishes but the app shows no data | You restored into the wrong database. Compare `--verify-only` output against the app's row counts. |

---

## 6. The parts a database dump misses

### Uploaded photos

```bash
# Copy the uploads folder next to your backup file — same discipline, same schedule.
tar czf "backups/uploads-$(date +%F).tar.gz" -C server uploads

# Restore:
tar xzf backups/uploads-2026-09-18.tar.gz -C server
```

If `CLOUDINARY_*` is configured in `.env`, product and review photos go to Cloudinary
instead and are safe there — but keep the database dump, because that is where the URLs
are stored.

### Your `.env` file

Never put `.env` in the dump folder and never commit it. Store a copy in a password
manager (1Password, Bitwarden). Losing `JWT_SECRET` is survivable — everyone is signed
out — but losing `PAYSTACK_SECRET_KEY` or the database URL costs you an afternoon.

---

## 7. Proof the drill works (this project, 2026-09-18)

```
--- 1. Marker order created in the live database -------------------------------
{"id":"drill-1789721742046","total":110,"items":1,"status":"CONFIRMED"}

--- 2. Backup taken -----------------------------------------------------------
✅ Backup written: backups/homely-2026-09-18_0855.sql.gz (12K)
✅ Integrity check passed — 20 table definitions found in the dump

--- 3. Scratch database destroyed (simulating a loss) -------------------------
DROP DATABASE

--- 4. Restore from the dump --------------------------------------------------
✅ Restore finished
   orders|1   order_items|1   products|6   users|16   zones|10

--- 5. The order came back whole ----------------------------------------------
guestName     | Restore Drill
total         | 110
paymentStatus | PAID
name          | Restore Drill Cake     price | 50    quantity | 2    size | 1.5 lb
fk_intact     | t
orphaned order items: 0        tables restored: 20
```

---

## 8. Cheat sheet

```bash
./scripts/backup.sh                                          # take one (now)
./scripts/backup.sh && scp backups/homely-*.sql.gz host:/backups/   # take one and move it
./scripts/restore.sh FILE --target homely_drill              # rehearse
./scripts/restore.sh --verify-only --target homely_drill     # compare with live
./scripts/restore.sh FILE --confirm                          # for real (warns first)
```
