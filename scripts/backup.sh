#!/usr/bin/env bash
#
# Database backup.
#
#   ./scripts/backup.sh                 # dump to ./backups/homely-YYYY-MM-DD_HHMM.sql.gz
#   BACKUP_DIR=/var/backups ./scripts/backup.sh
#   KEEP_DAYS=30 ./scripts/backup.sh    # prune dumps older than 30 days (default 14)
#
# Reads DATABASE_URL from server/.env unless it is already set in the environment, so it
# works the same on a laptop, a VPS and (with the URL pasted from Render) against the
# hosted database.
#
# What it does NOT do: copy uploaded photos. Design photos live in server/uploads (or
# Cloudinary). The script reminds you at the end — see BACKUP_AND_RESTORE.md.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-$ROOT/backups}"
KEEP_DAYS="${KEEP_DAYS:-14}"

# --- work out which database we are dumping -------------------------------------------
if [[ -z "${DATABASE_URL:-}" ]]; then
  if [[ -f "$ROOT/server/.env" ]]; then
    DATABASE_URL="$(grep -E '^DATABASE_URL=' "$ROOT/server/.env" | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")"
  fi
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "❌ No DATABASE_URL. Set it in the environment or in server/.env." >&2
  exit 1
fi

# Prisma appends ?schema=public to the URL; pg_dump rejects unknown query parameters.
# Drop the query string — the dump always targets the connection's default schema.
PGURL="${DATABASE_URL%%\?*}"

if ! command -v pg_dump >/dev/null 2>&1; then
  echo "❌ pg_dump not found. Install the PostgreSQL client tools:" >&2
  echo "   macOS:  brew install libpq && brew link --force libpq" >&2
  echo "   Linux:  sudo apt-get install postgresql-client" >&2
  echo "   Windows: install PostgreSQL from postgresql.org (adds pg_dump to PATH)" >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"
STAMP="$(date +%Y-%m-%d_%H%M)"
HOST_HINT="$(printf '%s' "$PGURL" | sed -E 's#.*@([^/:]+).*#\1#')"
FILE="$BACKUP_DIR/homely-${STAMP}.sql.gz"

echo "→ Dumping database (host: ${HOST_HINT}) to $(basename "$FILE")"

# --no-owner / --no-privileges keep the dump portable: it restores into a database whose
# role is named differently (Render's managed Postgres uses generated role names).
pg_dump "$PGURL" \
  --no-owner \
  --no-privileges \
  --clean \
  --if-exists \
  --format=plain \
  | gzip -9 > "$FILE"

SIZE="$(du -h "$FILE" | cut -f1)"
echo "✅ Backup written: $FILE ($SIZE)"

# --- verify the dump is readable (a backup you cannot read is not a backup) ------------
if gzip -t "$FILE" 2>/dev/null; then
  TABLES="$(gzip -dc "$FILE" | grep -c 'CREATE TABLE' || true)"
  echo "✅ Integrity check passed — $TABLES table definitions found in the dump"
else
  echo "❌ The dump failed its integrity check. Do not rely on it." >&2
  exit 1
fi

# --- prune old dumps ------------------------------------------------------------------
if [[ "$KEEP_DAYS" -gt 0 ]]; then
  # shellcheck disable=SC2012
  REMOVED="$(find "$BACKUP_DIR" -name 'homely-*.sql.gz' -type f -mtime "+$KEEP_DAYS" -print -delete | wc -l | tr -d ' ')"
  [[ "$REMOVED" != "0" ]] && echo "🧹 Removed $REMOVED dump(s) older than $KEEP_DAYS days"
fi

echo
echo "Next steps:"
echo "  • Copy this file off the machine — a backup on the same disk is not a backup."
echo "    scp $(basename "$FILE") you@another-machine:/backups/"
echo "  • Uploaded design photos live in server/uploads (or Cloudinary) and are NOT in this"
echo "    dump. See BACKUP_AND_RESTORE.md for the one-line rsync."
echo "  • Once a month, rehearse a restore: scripts/restore.sh $FILE --target homely_drill"
