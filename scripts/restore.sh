#!/usr/bin/env bash
#
# Database restore — with a rehearsal mode, because the point of a restore drill is to
# find out *before* you need it that (a) the dump is readable and (b) you know the steps.
#
#   # Rehearse: restore the dump into a scratch database and verify the row counts.
#   # Never touches production data.
#   ./scripts/restore.sh backups/homely-2026-09-18_0830.sql.gz --target homely_drill
#
#   # Compare a rehearsal against the live database (counts side by side), then drop it.
#   ./scripts/restore.sh --verify-only --target homely_drill
#
#   # For real: restore into the database named in DATABASE_URL.
#   ./scripts/restore.sh backups/homely-2026-09-18_0830.sql.gz --confirm
#
# The dump contains DROP statements (it was made with --clean), so a wrong target wipes
# that database. That is why the real restore needs an explicit --confirm and why the
# rehearsal target is a separate database.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET=""
CONFIRM=false
VERIFY_ONLY=false
FILE=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --target) TARGET="$2"; shift 2 ;;
    --confirm) CONFIRM=true; shift ;;
    --verify-only) VERIFY_ONLY=true; shift ;;
    -h|--help) sed -n '2,25p' "$0"; exit 0 ;;
    *) FILE="$1"; shift ;;
  esac
done

if [[ -z "${DATABASE_URL:-}" && -f "$ROOT/server/.env" ]]; then
  DATABASE_URL="$(grep -E '^DATABASE_URL=' "$ROOT/server/.env" | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")"
fi
[[ -n "${DATABASE_URL:-}" ]] || { echo "❌ No DATABASE_URL (environment or server/.env)." >&2; exit 1; }

# Split the URL so a different database name can be substituted for the rehearsal.
# Prisma appends ?schema=public, which psql/pg_dump reject as an unknown parameter.
# sslmode is kept (re-attached below): hosted databases (Neon, Render) refuse
# connections without it, local ones ignore it harmlessly... except that psql on a
# machine without an SSL-capable local server errors on an explicit sslmode, so it is
# only re-attached for non-local hosts.
BASE="${DATABASE_URL%%\?*}"                 # strip ?schema=public
PREFIX="${BASE%/*}"                          # postgresql://user:pass@host:5432
# Hosted databases (Neon, Render) refuse connections without SSL; local ones do not
# need it. The suffix is appended after the database name, where a query string lives.
SSLMODE="$(printf '%s' "$DATABASE_URL" | grep -oE 'sslmode=[a-z]+' | head -1 || true)"
case "$PREFIX" in
  *localhost*|*127.0.0.1*) SSL_SUFFIX="" ;;
  *) SSL_SUFFIX="?${SSLMODE:-sslmode=require}" ;;
esac
LIVE_DB="${BASE##*/}"

if ! command -v psql >/dev/null 2>&1; then
  echo "❌ psql not found. Install the PostgreSQL client tools (see BACKUP_AND_RESTORE.md)." >&2
  exit 1
fi

url_for() { echo "${PREFIX}/$1${SSL_SUFFIX}"; }

count_rows() {
  local url="$1"
  psql "$url" -At -F'|' -c "
    SELECT 'orders', COUNT(*) FROM \"Order\"
    UNION ALL SELECT 'order_items', COUNT(*) FROM \"OrderItem\"
    UNION ALL SELECT 'products', COUNT(*) FROM \"Product\"
    UNION ALL SELECT 'users', COUNT(*) FROM \"User\"
    UNION ALL SELECT 'reviews', COUNT(*) FROM \"Review\"
    UNION ALL SELECT 'zones', COUNT(*) FROM \"DeliveryZone\"
    ORDER BY 1;" 2>/dev/null || echo "unavailable"
}

if [[ "$VERIFY_ONLY" == true ]]; then
  [[ -n "$TARGET" ]] || { echo "❌ --verify-only needs --target <database>." >&2; exit 1; }
  echo "Live database  ($LIVE_DB):"; count_rows "$(url_for "$LIVE_DB")" | sed 's/^/   /'
  echo "Restored copy  ($TARGET):"; count_rows "$(url_for "$TARGET")" | sed 's/^/   /'
  exit 0
fi

[[ -n "$FILE" ]] || { echo "❌ Point me at a dump file (see --help)." >&2; exit 1; }
[[ -f "$FILE" ]] || { echo "❌ No such file: $FILE" >&2; exit 1; }

RESTORE_DB="${TARGET:-$LIVE_DB}"

if [[ "$RESTORE_DB" == "$LIVE_DB" && "$CONFIRM" != true ]]; then
  cat >&2 <<EOF
⚠  That dump would be restored into the LIVE database "$LIVE_DB".
   It contains DROP statements, so existing data is replaced.

   Rehearse it somewhere safe first:
       ./scripts/restore.sh $FILE --target homely_drill
   Then, when you mean it:
       ./scripts/restore.sh $FILE --confirm
EOF
  exit 1
fi

gzip -t "$FILE" || { echo "❌ The dump is corrupt (gzip check failed)." >&2; exit 1; }
echo "→ Restoring $(basename "$FILE") into database: $RESTORE_DB"

if [[ "$RESTORE_DB" != "$LIVE_DB" ]]; then
  echo "→ Creating scratch database $RESTORE_DB (if it does not exist)"
  psql "$(url_for postgres)" -v ON_ERROR_STOP=0 -c "CREATE DATABASE \"$RESTORE_DB\";" 2>/dev/null \
    || echo "   (already exists — continuing)"
fi

gzip -dc "$FILE" | psql "$(url_for "$RESTORE_DB")" -v ON_ERROR_STOP=1 --quiet
echo "✅ Restore finished"

echo
echo "Row counts in $RESTORE_DB:"
count_rows "$(url_for "$RESTORE_DB")" | sed 's/^/   /'

if [[ "$RESTORE_DB" != "$LIVE_DB" ]]; then
  cat <<EOF

Drill complete. Compare against production with:
    ./scripts/restore.sh --verify-only --target $RESTORE_DB
Then drop the scratch database:
    psql "$(url_for postgres)" -c 'DROP DATABASE "$RESTORE_DB";'
EOF
else
  cat <<'EOF'

Live restore done. Next:
  1. Restart the API so Prisma reconnects:  (Render: Manual Deploy → Restart)
  2. Sign in to the admin portal and spot-check: Orders (count + newest order),
     Reports (revenue today), Products (count + one photo).
  3. Restore the uploaded photos if the disk was lost — see BACKUP_AND_RESTORE.md.
EOF
fi
