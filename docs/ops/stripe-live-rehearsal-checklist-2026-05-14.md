# Stripe Live Rehearsal Checklist

Date: 2026-05-14

Purpose: prepare the exact live Stripe rehearsal to run after legal approval and before public launch.

Do not run live charges until counsel confirms the launch wording and Stripe account setup is approved.

## Current Integration Shape

Stripe checkout is handled by:

- `src/app/api/checkout/stripe/route.ts`
- `src/app/api/webhooks/stripe/route.ts`
- `src/lib/stripe.ts`
- `scripts/run-live-payment-smoke.mjs`

Important current protections:

- logged-in user is required before checkout creation
- country policy is checked before checkout creation
- disabled Stripe configuration returns `PAYMENT_METHOD_DISABLED`
- challenge access is not created on checkout initiation
- challenge is created only from paid `checkout.session.completed`
- webhook signature is verified with `stripe.webhooks.constructEvent`
- duplicate webhook fulfillment is guarded
- Stripe `amount_total` is authoritative for charged amount
- checkout and webhook events write `OpsEventLog`

Official references:

- Stripe webhooks: `https://docs.stripe.com/webhooks`
- Stripe CLI: `https://docs.stripe.com/stripe-cli/use-cli`

## Phase 1: Account Readiness

| Check | Expected result | Status |
|---|---|---|
| Stripe account identity/business verification | Complete, no pending onboarding blocker | Pending legal/Stripe |
| Live mode access | Available | Pending |
| Bank/payout settings | Complete | Pending |
| Support email | Matches PlayFunded support address | Pending |
| Statement descriptor | Approved and recognizable | Pending |
| Allowed business description | Matches counsel-approved wording | Pending |

## Phase 2: Production Env Readiness

| Env var | Expected | Status |
|---|---|---|
| `STRIPE_SECRET_KEY` | Live key, starts with `sk_live_` | Pending |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Live key, starts with `pk_live_` | Pending |
| `STRIPE_WEBHOOK_SECRET` | Real endpoint secret, starts with `whsec_` | Pending |
| `NEXT_PUBLIC_APP_URL` | `https://playfunded.lat` | Verify |
| `APP_CANONICAL_URL` | `https://playfunded.lat` | Verify |

Never paste the actual secrets into docs, chat, Git, screenshots, or logs.

## Phase 3: Stripe Dashboard Setup

1. Create or confirm the live webhook endpoint:
   - URL: `https://playfunded.lat/api/webhooks/stripe`
   - event: `checkout.session.completed`
2. Confirm the endpoint signing secret is copied into Vercel production.
3. Confirm live products/prices map to active PlayFunded tiers:
   - Starter
   - Pro
   - Elite
   - Master
   - Legend
4. Confirm payment methods:
   - card where legally available
   - Pix only if Stripe account/country/legal setup supports it
5. Confirm live checkout branding:
   - PlayFunded name
   - support URL
   - support email
   - privacy/legal links

## Phase 4: Dry Run Before Live Charge

Run:

```bash
npm run proof:payment-webhooks
npm run proof:hardening
npm run validate:proof
BASE_URL=https://playfunded.lat node --env-file=.env.local scripts/run-live-payment-smoke.mjs
```

Expected:

- webhook proof passes
- hardening proof passes
- proof validation passes
- live payment smoke confirms checkout initiation
- no challenge is created before webhook fulfillment
- blocked-country and disabled-provider paths behave correctly

## Phase 5: Live Low-Value Charge Rehearsal

Only after legal approval:

1. Create a real user account with an email you control.
2. Buy the lowest tier using live Stripe checkout.
3. Confirm Stripe shows a successful live payment.
4. Confirm `Payment` row is completed.
5. Confirm exactly one `Challenge` row is created.
6. Confirm dashboard shows active challenge.
7. Confirm purchase email is sent.
8. Confirm admin payment/user/challenge views match.
9. Confirm `OpsEventLog` includes:
   - `checkout_created`
   - `webhook_payment_completed`
10. Replay or retry webhook safely if Stripe dashboard supports it:
   - expected result: no duplicate challenge
   - expected event: duplicate is logged or ignored safely

## Phase 6: Failure And Support Rehearsal

| Scenario | Expected result |
|---|---|
| User cancels checkout | No challenge, no completed payment |
| Country blocked | Clear 403 response, no checkout URL |
| Stripe config disabled | Clear 503 response, no checkout URL |
| Invalid discount | Clear validation error |
| Own affiliate discount | Clear validation error |
| Duplicate webhook | No duplicate challenge |
| Missing webhook signature | 400 response |
| Wrong webhook secret | 400 response |

## Phase 7: Go / No-Go

Go only if:

- live checkout creates a real Stripe checkout URL
- challenge access is granted only after paid webhook
- duplicate webhook does not duplicate access
- admin can diagnose the payment
- support can explain pending/canceled/failed states
- legal-approved wording is live

No-go if:

- challenge access appears before webhook fulfillment
- webhook signature verification fails in live mode
- user country/payment availability is wrong
- Stripe account is still onboarding-limited
- public copy contradicts Stripe/legal setup

## Output To Record

After rehearsal, record:

- date/time
- deployed commit
- Stripe event ID
- PlayFunded payment ID
- challenge ID
- smoke command output summary
- any support issue discovered
- decision: go, no-go, or retry after fixes
