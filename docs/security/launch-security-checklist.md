# Launch Security Checklist

This is the concrete minimum bar for PlayFunded. If one of these is false, call it out directly instead of hand-waving.

## Code And Infra Controls

- `Secrets not exposed`
  - `gitleaks` is green in CI.
  - no provider keys are present in public client bundles.
- `RLS on`
  - Supabase public tables are covered by `supabase-rls-policies.sql`.
  - live hardening SQL has been applied to service-only tables.
- `Rate limits on`
  - checkout, webhook, chat, and admin mutate routes use the shared DB-backed limiter.
- `Webhook signatures on`
  - Stripe verifies `stripe-signature`.
  - NOWPayments verifies `x-nowpayments-sig`.
- `Admin checks server-side`
  - middleware protects admin pages.
  - admin APIs and server actions still verify admin role server-side.
- `CSP sane`
  - `next.config.mjs` sets CSP, frame restrictions, and core security headers.
- `Sentry live`
  - production Sentry DSN is configured and captures server/runtime errors.
- `Alerts sane`
  - ops health cron exists.
  - real alert destination is configured if paging is expected.
- `Audit clean enough`
  - CI audit is green under the current approved suppressions.

## Operational Reality Checks

- `Outgoing crypto payouts`
  - not launch-ready until NOWPayments whitelist, custody funding, and production-safe egress are solved.
- `KYC uploads`
  - safe to launch only if you accept strict blocking until ClamAV is armed.
- `Odds/scores providers`
  - quota exhaustion is still a live business risk until the provider plan is upgraded.
- `Autofix safety`
  - AI/Sentry autofix should not merge without human review and meaningful verification.

## Future Traffic Prep

These are not day-one blockers, but they should exist before growth pushes real load:

- route latency by endpoint
- DB connection pressure visibility
- provider success/failure and quota trend visibility
- cron duration/failure visibility
- short-cache strategy for hot public reads
- durable async handling for retries and provider syncs

## Repeat This Checklist When

- a new payment rail is added
- a new admin route is added
- auth changes materially
- webhook logic changes
- a new third-party provider is introduced
