# Masatoshi Store — Supabase + Vercel

React (Vite) storefront + admin panel + Express API, now on **Supabase (Postgres)** and deployable on **Vercel**.

```
api/index.js        Vercel serverless entry (wraps server/app.js)
server/             Express API (Supabase)
frontend/           Storefront (/) and Admin (/admin/) — one Vite build
supabase/schema.sql Database tables, atomic points function, RLS, storage bucket
vercel.json         Build + routing
```

## 1. Supabase (5 min)
1. Create a project at supabase.com.
2. **SQL Editor → New query →** paste `supabase/schema.sql` → **Run**.
3. **Project Settings → API:** copy the **Project URL** and the **service_role** key.

## 2. Run locally (Windows / VS Code)
```powershell
copy .env.example .env      # then fill SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, JWT_SECRET
npm install
npm run dev
```
Storefront http://localhost:5173 · Admin http://localhost:5173/admin/admin-dashboard (served by the same dev server at `/admin/`) · API http://localhost:5000/api/health

## 3. Deploy on Vercel
1. Push this folder to GitHub → **Vercel → Add New → Project** → import it. Leave framework preset as detected; `vercel.json` sets everything.
2. **Settings → Environment Variables** (Production): `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `JWT_SECRET`, `ADMIN_EMAIL`, `GOOGLE_CLIENT_ID` (see `.env.example`).
3. Google Cloud Console → your OAuth client → add your Vercel domain to **Authorized JavaScript origins**.
4. Deploy. Check `https://YOUR-APP.vercel.app/api/health` → all `true`.
5. Open `/admin/`, sign in **with Google** using the admin email → Dashboard → **🧪 Bakong Tester**.

## Bakong tester (Dashboard → Bakong Tester)
* **Connection check:** account, merchant, token expiry date, and whether this server can reach NBC.
* **Test payment:** creates a real KHQR (default ៛100 / $0.01). Pay it, and the page tells you if verification detected it. Test payments never credit points.

### Bakong on Vercel — important
NBC's `check_transaction_by_md5` is normally restricted to **servers in Cambodia**. Vercel has no Cambodia region (`vercel.json` uses Singapore `sin1`, the closest). If the tester shows **HTTP 403/451**, auto-confirm can't work from Vercel: run only the verification call from a Cambodian VPS/relay, or keep the manual slip top-up. The tester exists to tell you this before customers do.

Vercel can't run the old background poller. Customers' open page still polls every few seconds. Optional safety net: set `CRON_SECRET` and call `GET /api/cron/bakong-poll` with `Authorization: Bearer <CRON_SECRET>` from any scheduler (Vercel Cron on Pro, or a free pinger). Vercel Hobby only allows daily crons, so none is configured by default.

## Product labels
Admin → Upload / Edit product → **Label**: *New Arrival*, *Limited Edition*, *Out of Stock*. Out-of-stock products show a red badge, a dimmed image, a disabled buy button, and the API refuses the purchase.

## What changed for Vercel
* MongoDB → Supabase tables (same JSON shapes, so the UI is unchanged).
* No disk writes: banner & product images go to Supabase Storage (bucket `store-images`); the browser shrinks photos first (Vercel's request limit is 4.5 MB).
* All `http://localhost:5000` URLs → relative `/api`.
* Admin API is now protected: Google sign-in is verified on the server and returns a signed token. Before, anyone could call admin routes (including reading the Bakong token).
* Admin panel lives at `/admin/` of the same site.

## Security notes
* The original zip contained `backend/.env` with real secrets. If that was ever pushed to GitHub, **rotate** the MongoDB password, Google client secret and Bakong token. `.env` is now git-ignored.
* Customer endpoints still identify the user by the email sent from the browser (as before). For production hardening, issue user tokens the same way as admin tokens.
