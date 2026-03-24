# Staging Smoke Checklist

Use this before a release candidate or production deploy.

## 1. Core App

- Home page loads without `500`
- Locale routes load: `/`, `/en`, `/pt-BR`
- Dashboard unauthenticated routes redirect to login
- Non-admin user is blocked from admin routes

## 2. Auth

- Email login succeeds with a real test account
- Logout returns to login screen
- Redirect target after login is preserved

## 3. Challenges And Picks

- Challenge list loads
- Country-policy restrictions are visible in review/blocked markets
- Pick placement rejects events inside the pre-start lock window
- Pick placement uses server-side odds validation

## 4. Payments And Webhooks

- Stripe checkout route returns a session for an allowed country
- Stripe Pix checkout returns a session for an allowed Brazil flow
- NOWPayments checkout returns an invoice and persists exactly one pending `Payment`
- Mercado Pago checkout returns the explicit disabled-provider response (`410 PAYMENT_METHOD_DISABLED`) and is not exposed as a launch payment rail
- Blocked country cannot create checkout
- Users without a paid fulfillment still have `0` accessible challenges after checkout initiation
- Webhook signature failures are rejected
- Duplicate webhook replay does not create a second challenge

## 5. Settlement And Cron

- `/api/odds/sync` succeeds with `CRON_SECRET`
- `/api/settle` succeeds with `CRON_SECRET`
- `/api/ops/health` returns healthy after recent sync and settle runs
- GitHub Actions cron workflows are green

## 6. KYC And Payouts

- KYC upload accepts a safe PDF/JPG/PNG file
- If scanner is enabled, malware test file is blocked and quarantined
- If production scanning is not armed, uploads block with `scan_unavailable`
- First payout request is blocked without approved KYC
- Allowed payout methods match country policy

## 7. Admin

- Admin dashboard loads for a real admin
- KYC queue loads
- Launch checklist page loads
- Manual settlement endpoint rate limit still applies
- `npm run smoke:admin` passes
- `npm run smoke:payments` passes
- `npm run smoke:kyc-strict` passes for production-like strict mode
- `npm run smoke:payout-kyc` passes
- `npm run smoke:admin-support` passes

## 8. Ops And Secrets

- Env audit reviewed
- Backup drill completed and archive manifest stored
- Alert webhook configured if live alerting is expected
- Required Vercel runtime envs present
- Staging/internal KYC mode is acceptable as `best_effort` unless you are intentionally simulating production strict mode
- Production KYC mode remains strict by default and should only accept uploads once scanning is armed
