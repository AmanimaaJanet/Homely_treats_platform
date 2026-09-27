#!/usr/bin/env bash
# ============================================================================
# Homely Treats — one-command bootstrap
# Sets up PostgreSQL, installs dependencies, migrates + seeds the DB,
# builds the frontend, and starts the full stack on port 5000.
#
# Usage:  bash scripts/setup.sh
# ============================================================================
set -e
cd "$(dirname "$0")/.."
ROOT="$(pwd)"

echo "🛠️  Homely Treats setup — starting…"

# ---------- 1. PostgreSQL ----------
if ! command -v pg_ctlcluster >/dev/null 2>&1 && ! command -v psql >/dev/null 2>&1; then
  echo "📦 Installing PostgreSQL…"
  (sudo apt-get update -qq && sudo apt-get install -y -qq postgresql) >/dev/null
fi

if command -v pg_lsclusters >/dev/null 2>&1; then
  CLUSTER=$(pg_lsclusters -h | awk 'NR==2{print $1}')  # e.g. 17
  VER=$(pg_lsclusters -h | awk 'NR==2{print $2}')
  if [ -n "$CLUSTER" ] && ! pg_lsclusters | grep -q online; then
    sudo pg_ctlcluster "$VER" "$CLUSTER" start || true
  fi
fi
sleep 2

# Role + database (idempotent)
sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='homely'" | grep -q 1 \
  || sudo -u postgres psql -c "CREATE ROLE homely LOGIN PASSWORD 'homely' CREATEDB;"
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='homely'" | grep -q 1 \
  || sudo -u postgres createdb -O homely homely

# ---------- 2. Server ----------
echo "📦 Installing server dependencies…"
npm --prefix server install --no-audit --no-fund >/dev/null
if [ ! -f server/.env ]; then cp .env.example server/.env; fi

echo "🗄️  Applying database migrations…"
npm --prefix server run db:migrate

echo "🌱 Seeding database…"
npm --prefix server run db:seed || true

# ---------- 3. Client ----------
echo "📦 Installing client dependencies…"
npm --prefix client install --no-audit --no-fund >/dev/null
echo "🏗️  Building frontend…"
npm --prefix client run build >/dev/null

echo ""
echo "✅ Setup complete. Starting the app on http://localhost:5000 …"
echo "   👤 Admin: admin@homelytreats.gh / admin123  (change the password after first login)"
echo ""
npm --prefix server run start
