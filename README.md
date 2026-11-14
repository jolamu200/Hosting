# Bmb Tech Hosting

WhatsApp bot hosting platform (TX coins, Pterodactyl panel shop, social boosting, referrals, coupons, public API, full admin dashboard) — the Toxic Hosting feature set and layout, branded for Bmb Tech.

## Stack
React 19 + Vite + Tailwind (frontend) · Express + MongoDB/Mongoose (backend) · Heroku API (bots) · Paystack / SpeedPesa (payments)

## Setup
1. Fill `.env` (every key is read from it — nothing to enter on the host). The two REQUIRED blanks: `MONGODB_URI` and `ADMIN_EMAIL`.
2. `npm install`
3. Dev: `npm run dev` (frontend) and `npm run dev:server` (backend).
4. Production: `npm run build` then `npm start` (Express serves the built site from `dist/`).
   `VITE_*` values are baked in at build time, so `.env` must exist when you run the build.

## Admin
Sign up/login with the e-mail set in `ADMIN_EMAIL` — that account is the super admin. Admin dashboard login also uses `ADMIN_USERNAME` / `ADMIN_PASSWORD`.

## SpeedPesa webhook
Set the callback URL in SpeedPesa to `https://<your-domain>/webhook/speedpesa` (and `SPEEDPESA_WEBHOOK_SECRET` in `.env`).

## Notes
`_bmb-original-backup/` holds the previous Supabase/Vercel version of the site for reference. It is not part of the build and can be deleted.
