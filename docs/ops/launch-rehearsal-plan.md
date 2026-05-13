# Launch Rehearsal Plan

Updated: 2026-05-13

This is the final pre-launch dry run for the live production domain.

## Goal

Prove that the critical user journey, admin control plane, and ops health all behave correctly on `playfunded.lat` before the real launch window.

## Duration

- 30 to 45 minutes

## Inputs

- access to the repo and `.env.local`
- a real browser for manual Google login
- `CRON_SECRET`
- paid odds plans active if you want the freshness/health check to represent launch reality

## Rehearsal Steps

### Step 1. Baseline

- open `https://playfunded.lat`
- confirm homepage, `/en`, and `/pt-BR` load
- confirm the public Discord link works

### Step 2. Run Live Smoke Commands

```bash
BASE_URL=https://playfunded.lat node --env-file=.env.local scripts/run-locale-auth-public-smoke.mjs
BASE_URL=https://playfunded.lat node --env-file=.env.local scripts/run-live-member-smoke.mjs
BASE_URL=https://playfunded.lat node --env-file=.env.local scripts/run-admin-smoke.mjs
BASE_URL=https://playfunded.lat node --env-file=.env.local scripts/run-payout-kyc-ui-check.mjs
BASE_URL=https://playfunded.lat npm run smoke:admin-support
BASE_URL=https://playfunded.lat npm run smoke:password-reset
```

Record:

- pass/fail
- command output
- exact failing route if anything breaks

### Step 3. Manual Auth Check

- log in with Google in a normal browser
- confirm forgot-password shows the generic success state
- confirm a recovery link lands on the reset-password form and returns to login after password update
- confirm dashboard loads
- refresh and confirm the session persists
- log out

### Step 4. Payments Check

- confirm Stripe card and Pix initiation still work
- confirm NOWPayments initiation still works
- confirm Mercado Pago still returns the disabled-provider response

### Step 5. Health Check

- hit `/api/odds/sync` with `CRON_SECRET`
- hit `/api/settle` with `CRON_SECRET`
- confirm `/api/ops/health` goes green afterward

### Step 6. Public Copy Check

- public affiliate pages render in Spanish, English, and Portuguese
- non-affiliates can apply and pending applicants see application status
- only approved affiliates see referral code/dashboard/conversion tools
- FAQ and sitemap do not broadly promote affiliate discovery yet
- no public Mercado Pago copy remains
- browser console is clean on core public pages

## Stop Conditions

Pause launch if any of these happen:

- auth smoke fails
- admin smoke fails
- checkout creates access without fulfillment
- `/api/ops/health` stays red after fresh sync and settle
- browser console shows a real production JS/CSP error on the public site

## Output

At the end of the rehearsal, write down:

- final commit deployed
- smoke commands that passed
- manual checks that passed
- any intentionally deferred external items:
  - odds plans
  - Discord incident webhook
  - production ClamAV/KYC activation
