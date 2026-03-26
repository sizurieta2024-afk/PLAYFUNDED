# Launch-Day Checklist

Updated: 2026-03-25

Scope:

- excludes legal/compliance review items
- assumes paid odds plans are purchased right before launch
- treats ClamAV production activation, Apple Sign In, traffic analytics, and community expansion as post-launch work

## 1. Before You Start

- Confirm `playfunded.lat` resolves and loads in a normal browser
- Confirm the latest intended branch/commit is the version live on production
- Confirm the paid odds plans are active before public launch messaging depends on fresh odds
- Confirm the public Discord/community link is still valid

## 2. Run The Live Smoke Set

From the repo root:

```bash
BASE_URL=https://playfunded.lat node --env-file=.env.local scripts/run-locale-auth-public-smoke.mjs
BASE_URL=https://playfunded.lat node --env-file=.env.local scripts/run-live-member-smoke.mjs
BASE_URL=https://playfunded.lat node --env-file=.env.local scripts/run-admin-smoke.mjs
BASE_URL=https://playfunded.lat node --env-file=.env.local scripts/run-payout-kyc-ui-check.mjs
BASE_URL=https://playfunded.lat npm run smoke:admin-support
BASE_URL=https://playfunded.lat npm run smoke:password-reset
```

Pass criteria:

- all commands return `ok: true`
- signup lands on `/auth/verify`
- password reset lands on `/auth/reset-password`, then reaches `/auth/login?reset=success`
- member flow reaches the dashboard in default, English, and Portuguese
- admin, payout/KYC, and admin-support control-plane checks stay green

## 3. Manual Browser Checks

- Google login works in a real browser
- email/password signup shows the verify-email step
- forgot-password shows a generic success state and the reset link works
- logout works
- landing page copy is clean in `/`, `/en`, `/pt-BR`
- affiliate page exists in `/affiliate`, `/en/affiliate`, `/pt-BR/affiliate`
- FAQ does not advertise affiliate discovery beyond the public affiliate page

## 4. Payments And Availability

- Stripe card checkout initializes successfully
- Stripe Pix initializes successfully for Brazil-allowed paths
- NOWPayments initializes successfully
- Mercado Pago still returns the explicit disabled response
- blocked-country checkout still returns the expected rejection
- challenge access is not granted from checkout initiation alone

## 5. Ops And Health

- `/api/odds/sync` returns `200` with `CRON_SECRET`
- `/api/settle` returns `200` with `CRON_SECRET`
- `/api/ops/health` is green after fresh sync and settle
- GitHub CI is green on the final launch commit
- GitHub cron workflows are green

## 6. Auth, KYC, And Support Posture

- email verification is required before email/password login
- password reset succeeds without exposing whether an email exists
- Google login still works manually
- KYC/payout gating behaves as expected
- if production ClamAV is still not armed, do not promise live KYC upload clearance before that rollout

## 7. Public Claims Check

- no public Mercado Pago claim remains
- affiliate is public but softly launched
- sitemap excludes affiliate
- browser console is clean on core public pages

## 8. Optional But Recommended

- configure `PF_ALERT_WEBHOOK_URL`
- configure `PF_ALERT_WEBHOOK_KIND=discord`

This is only needed if you want automated Discord incident alerts before launch. It is separate from the public Discord/community link.

## Go / No-Go Rule

Go only if:

- live smokes pass
- manual Google login works
- ops health is green after fresh sync/settle
- the odds plans are active
- no public copy contradicts current launch reality

No-go if:

- checkout grants access incorrectly
- admin/control-plane smokes fail
- ops health stays red after a fresh sync/settle run
- public launch copy still promises disabled features
