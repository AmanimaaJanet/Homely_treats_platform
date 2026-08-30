# ============================================================================
# Homely Treats — Windows PowerShell bootstrap
#
# Prerequisites (one-time):
#   1. Node.js 20 LTS  (https://nodejs.org)
#   2. PostgreSQL 16+  (https://www.postgresql.org/download/windows/)
#   3. A database created:
#        CREATE ROLE homely LOGIN PASSWORD 'homely' CREATEDB;
#        CREATE DATABASE homely OWNER homely;
#
# Usage (from the repo root):
#   powershell -ExecutionPolicy Bypass -File scripts\setup.ps1
# ============================================================================
$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")
$Root = (Get-Location).Path

Write-Host "`n🛠️  Homely Treats setup (Windows) — starting…" -ForegroundColor Cyan

# ---------- 1. Server ----------
Write-Host "📦 Installing server dependencies…"
Push-Location "$Root\server"
npm install --no-audit --no-fund | Out-Null
if (-not (Test-Path "$Root\server\.env")) {
    Copy-Item "$Root\.env.example" "$Root\server\.env"
    Write-Host "   Created server\.env (edit it to set your DATABASE_URL and keys)"
}

Write-Host "🗄️  Applying database migrations…"
npx prisma migrate deploy

Write-Host "🌱 Seeding database…"
npm run db:seed
Pop-Location

# ---------- 2. Client ----------
Write-Host "📦 Installing client dependencies…"
Push-Location "$Root\client"
npm install --no-audit --no-fund | Out-Null
Write-Host "🏗️  Building frontend…"
npm run build | Out-Null
Pop-Location

Write-Host ""
Write-Host "✅ Setup complete. Starting the app on http://localhost:5000 …" -ForegroundColor Green
Write-Host "   👤 Admin: admin@homelytreats.gh / admin123  (change the password after first login)"
Write-Host ""
Push-Location "$Root\server"
npm run start
