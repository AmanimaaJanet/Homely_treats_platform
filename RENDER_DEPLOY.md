# 🚀 Deploying Homely Treats to Render

This guide walks you through hosting the full app (React + Node API + PostgreSQL) on [Render](https://render.com) — free tier is enough to start.

---

## 1. Push your code to GitHub

1. Create a private GitHub repository.
2. Commit and push this project:

```bash
cd homely-treats
git init
git add .
git commit -m "Homely Treats full-stack app"
git branch -M main
git remote add origin https://github.com/<you>/homely-treats.git
git push -u origin main
```

> ⚠️ **Never commit your `.env` files.** `.gitignore` already excludes them — double-check with `git status` before pushing.

---

## 2. Create the PostgreSQL database on Render

1. Log in to [render.com](https://render.com) → **New → PostgreSQL**.
2. Name it `homely-treats-db`, pick a region, choose **Free** plan.
3. After creation, Render gives you an **Internal Database URL** — copy it.
   - It looks like: `postgresql://user:password@host:5432/homely_treats_db`
4. You don't need to create tables manually — Prisma migrations do that automatically on first deploy.

---

## 3. Create the Web Service (the app)

1. Render → **New → Web Service** → connect your GitHub repo.
2. Configure the service:

| Field | Value |
|---|---|
| **Name** | `homely-treats` |
| **Runtime** | Node |
| **Root Directory** | (leave empty — repo root) |
| **Build Command** | `cd server && npm install && npx prisma generate && npx prisma migrate deploy && node src/seed.js && cd ../client && npm install && npm run build` |
| **Start Command** | `cd server && npm start` |
| **Plan** | Free (or Starter for no cold-start) |

> **How it works:** the build step installs both apps, applies your database migrations, creates the admin account (idempotent — safe to run on every deploy), and builds the React frontend into `client/dist`. The start command runs the Node server, which serves **both** the API and the built frontend on one port.

---

## 4. Set the environment variables

On the Web Service, open **Environment** and add:

| Key | Value |
|---|---|
| `PORT` | `5000` |
| `DATABASE_URL` | *(the Internal Database URL from step 2)* |
| `JWT_SECRET` | a long random string (e.g. from https://1password.com/password-generator) |
| `CLIENT_URL` | `https://<your-service>.onrender.com` |
| `PAYSTACK_SECRET_KEY` | *(leave blank to start in simulated-payment demo mode)* |
| `PAYSTACK_PUBLIC_KEY` | *(leave blank for now)* |
| `RESEND_API_KEY` | *(leave blank to log emails to console)* |
| `EMAIL_FROM` | `Homely Treats <onboarding@resend.dev>` |
| `SMS_PROVIDER` | `textbelt` |
| `TEXTBELT_API_KEY` | `textbelt` |
| `CLOUDINARY_CLOUD_NAME` | *(see step 6 — required for photo uploads on Render)* |
| `CLOUDINARY_API_KEY` | *(see step 6)* |
| `CLOUDINARY_API_SECRET` | *(see step 6)* |

---

## 5. Turn on the integrations (when ready)

| Integration | Where | Cost |
|---|---|---|
| **Paystack** | [dashboard.paystack.com](https://dashboard.paystack.com) — test keys need **no business documents** | Free to test |
| **Resend** | [resend.com](https://resend.com) — free 100 emails/day | Free tier |
| **Arkesel SMS** (recommended for Ghana) | [sms.arkesel.com](https://sms.arkesel.com) — Ghana-based, free trial credits | Free trial |
| **WhatsApp** | [developers.facebook.com](https://developers.facebook.com) → Create App → WhatsApp → add a **test phone number** | Free 1,000 conversations/month |

For each, paste the keys into the Render environment variables and **Deploy** again.

> **Note on Paystack going live:** test mode works instantly with just an email. Going *live* later requires business verification. Until then you can run on test keys or rely on the built-in **Cash on Delivery** option.

---

## 6. Photo uploads on Render ⚠️ important

Render's file system is **ephemeral** — files in `server/uploads` disappear on every deploy. So enable **Cloudinary** (free tier):

1. Sign up at [cloudinary.com](https://cloudinary.com).
2. Copy your **Cloud name**, **API key**, **API secret**.
3. Paste them into the Render env vars (`CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`).
4. Redeploy — customer design photos now store permanently on Cloudinary.

---

## 7. First login

After deploy completes, open `https://<your-service>.onrender.com`:

| Role | Email | Password |
|---|---|---|
| Admin | `admin@homelytreats.gh` | `admin123` |

> 🔒 **Change the admin password immediately** (Sign in → My Account → Change Password) and set a strong `JWT_SECRET`. The storefront starts empty — add your products, delivery zones and promos from the Admin Dashboard.

---

## Render free-tier tips

- Free web services **sleep** after ~15 min of inactivity and take ~30–60 s to wake on the next request. Upgrade to Starter to avoid cold starts.
- The free Postgres expires after 30 days — back up before then (Render dashboard → Database → Export/Backup) or move to a paid plan.
