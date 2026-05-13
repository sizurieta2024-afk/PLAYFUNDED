# Production Readiness Audit

Updated: 2026-05-13

Scope:

- engineering, operations, security posture, and launch execution
- excludes legal/compliance wording beyond obvious product-claim mismatches
- assumes Stripe live activation and paid odds plans are intentionally pending until legal approval

## Current State

PlayFunded is in final operational tightening, not foundation-building. The core app builds, the schema validates, the hardening proof suite passes, and the DB-backed proof suite confirms the highest-risk flows still behave correctly.

Green checks from this pass:

- `npm run lint`
- `npm run build`
- `npx prisma validate`
- `npm run proof:hardening`
- `VALIDATE_PROOF_DB=1 ... scripts/validate-proof-based.js`
- `npm run audit:launch-env` completes with explicit connector/env reporting

The DB-backed proof result is strong: 53 verified checks, 0 failed checks, 3 unverified external/runtime claims.

## Fixed In This Pass

- Patched launch-critical dependencies within the current major framework line:
  - `next` to `15.5.18`
  - `eslint-config-next` to `15.5.18`
  - `next-intl` to `4.11.2`
  - `postcss` to `8.5.14`
  - `posthog-js` to `1.373.4`
  - `@sentry/nextjs` to `10.53.1`
- Improved `scripts/audit-launch-env.mjs` so it no longer crashes when GitHub or Vercel CLI access is broken. It returns explicit connector errors instead of pretending a live audit happened.
- Synced the missing GitHub Actions provider/SMTP secrets needed by CI launch smokes and Sentry autofix validation.
- Added a Vercel env fallback to the audit script. If Vercel CLI is unauthenticated, the script uses `.vercel/.env.production.local` and labels that source clearly instead of pretending it performed a live Vercel API audit.
- Hid obvious local-only generated clutter from Git status through `.git/info/exclude`, without deleting files or changing shared repo ignore behavior.

## Remaining External Blockers

- Stripe live account and live checkout keys are pending legal/business approval.
- Paid odds plans are pending and should be bought immediately before launch validation.
- Vercel CLI is authenticated to the correct production account (`sizurieta2024-4707`) and can list production env keys for this project.
- GitHub secret audit is clean: required and recommended workflow secrets currently report no missing keys.
- Vercel production has `GOOGLE_SITE_VERIFICATION`, `INDEXNOW_KEY`, and PostHog public env keys configured.
- `BING_SITE_VERIFICATION` was not present in the checked Vercel production env list.
- Google Search Console and Bing Webmaster Tools still require operational console-side confirmation outside the repo.
- GitHub alert webhook secrets are present; final Discord delivery should still be re-tested with a controlled failing-health run before launch.
- Production ClamAV remains a post-launch or pre-launch operational decision. The pulled Vercel env snapshot does not include `CLAMAV_*`, `KYC_SCAN_MODE`, or `KYC_QUARANTINE_BUCKET`. If KYC uploads are enabled at launch, scanner behavior must be explicitly configured and confirmed.

## Security And Abuse Posture

Currently strong:

- protected routes require Supabase session checks
- admin routes use server-side role lookup
- Stripe and NOWPayments webhooks require signature verification
- duplicate webhook fulfillment is locked and DB-proven
- payout and KYC review flows use transactional audit writes
- pick placement uses optimistic concurrency
- RLS is enabled on sensitive public tables and DB-backed proof verified owner policies
- rate limiting exists for launch-critical webhook/manual-settlement paths

Still worth watching under real traffic:

- rate limiting is proven in source but not load-tested across production regions
- geo-IP correctness depends on provider headers and real network behavior
- signup/login/reset flows should be manually rehearsed once final production email settings are locked

## Capacity Notes

The database has useful indexes on core launch paths: users, challenges, picks, payments, payouts, ops logs, odds cache, affiliate records, and trading groups.

Known scale risks before thousands of users:

- `/api/cron/backup` exports full tables into memory and uploads JSON. This is acceptable only as an early-stage safety copy. For real scale, use provider-native Postgres backups or a streaming `pg_dump` flow.
- Admin list pages should be watched for broad `findMany` queries as volume grows. Pagination/filtering must be mandatory once real user/payment/pick volume increases.
- Rate-limit writes use shared database state. This is good for multi-instance correctness, but OpsEventLog and RateLimitBucket growth should be monitored after launch.
- Analytics and dashboard queries are user-scoped and acceptable now, but the next scale pass should profile picks/challenges with production-like row counts.

## Dependency Audit

`npm audit --omit=dev` is reduced to 2 moderate findings after patching. The remaining advisory is Next's bundled internal `postcss@8.4.31`; the direct `postcss` package is patched to `8.5.14`.

Practical decision:

- do not jump to Next 16 solely for this before launch unless a full regression pass is scheduled
- keep the current Next 15 line because build/proof checks are green
- re-check after the Next 15 patch line ships a bundled PostCSS update, or schedule a deliberate Next 16 upgrade after launch stabilization

## Launch Go/No-Go

Go only if:

- live `playfunded.lat` smoke suite passes
- Google login works manually in a real browser
- email signup verification and password reset work against production email settings
- Stripe live checkout initializes only after legal approval
- odds plans are active and sync/settlement are green
- `/api/ops/health` is green after fresh odds sync and settlement
- Discord/admin incident alerts are confirmed if you want on-call alerts before launch
- no public page promises disabled payment methods or unavailable launch features

No-go if:

- checkout grants challenge access before confirmed payment
- admin/payment/KYC control-plane smokes fail
- provider webhooks cannot be verified
- Vercel production env cannot be audited from either CLI or CI before the final deploy
- ops health stays red after manual sync/settlement
