# Live Validation Status

Updated: 2026-05-13

## Proven Live

- Auth and member flows on `playfunded.lat`:
  - public auth pages load in default, English, and Portuguese
  - email signup now lands on `/auth/verify`
  - member smokes passed in default, English, and Portuguese
  - callback fallback behavior was verified after the auth hardening pass
- Admin/control-plane flows on `playfunded.lat`:
  - admin smoke passed
  - payout/KYC smoke passed
  - admin/support smoke passed
- Public affiliate surface:
  - `/affiliate`, `/en/affiliate`, and `/pt-BR/affiliate` render the public apply/landing flow
  - `/dashboard/affiliate` lets non-affiliates apply and pending applicants see status
  - only active approved affiliates see referral code, dashboard, conversion, and code-management tools
  - dashboard sidebar shows affiliate only for active approved affiliates
  - affiliate is removed from sitemap discovery
  - FAQ does not broadly promote affiliate discovery yet
- Public payment claims:
  - Mercado Pago is intentionally disabled for launch
  - no public Mercado Pago claim remained on the checked public pages
- Browser/runtime health:
  - CSP was fixed so Sentry browser reporting is no longer blocked
  - checked public pages had a clean browser console after the fix
- Ops health alerting:
  - live deploy returned a real unhealthy `/api/ops/health` response
  - GitHub Actions workflow dispatched successfully
  - temporary receiver captured the real alert body
- KYC malware quarantine path:
  - real `clamd` daemon scanned uploads
  - authenticated upload returned `file_malware_detected`
  - object was written to `kyc-quarantine`
  - quarantine event was persisted in `OpsEventLog`
- GitHub CI and launch smokes:
  - `workflow_dispatch` is proven on the remote repository
  - remote launch-smokes passed on GitHub
- Payment checkout guardrails on `playfunded.lat`:
  - blocked countries cannot create Stripe or NOWPayments checkouts
  - starting checkout does not create a `Challenge`
  - live NOWPayments checkout returns a real invoice and persists one pending `Payment`
  - Mercado Pago returns the explicit disabled-provider response
- Proof state:
  - source-level proof passed
  - DB-backed proof passed with `53 verified / 0 failed / 3 unverified`

## Proven By Archive Validation

- Logical Postgres backup creation
- Archive readability via `pg_restore --list`
- Full restore into a disposable local Postgres target
- Restored key application table counts matched the backup snapshot

## Still Not Fully Proven

- Permanent Discord incident alert destination:
  - public Discord/community access is live
  - GitHub Actions has `PF_ALERT_WEBHOOK_URL` and `PF_ALERT_WEBHOOK_KIND`
  - controlled delivery to the final staff-only Discord channel should still be re-tested before launch
- SEO/search console ownership:
  - Vercel production has `GOOGLE_SITE_VERIFICATION` and `INDEXNOW_KEY`
  - `BING_SITE_VERIFICATION` is not present in the checked Vercel production env list
- Paid odds-plan freshness:
  - `/api/odds/sync` works
  - The Odds API account still hits quota/frequency limits until the paid plans are active
  - because of that, `/api/ops/health` can drift red again on stale sync windows even though the handlers themselves are healthy
- Production Vercel KYC scanning:
  - production runtime still lacks `CLAMAV_*` and `KYC_*` scan env vars
- Full Supabase platform restore outside the application `public` schema
- Automated Google login:
  - manual Google login was verified in a normal browser
  - bot-driven Google login is still blocked by Google anti-automation behavior

## Explicit Current KYC Runtime Status

- Intended production behavior: strict
- Default behavior by environment:
  - production => `require_clean`
  - staging / preview / development => `best_effort`
- Effective production behavior without ClamAV envs: uploads block, they do not silently pass
- Admin launch view should be read as:
  - `production · mode require_clean`
  - `Scanner not configured`
