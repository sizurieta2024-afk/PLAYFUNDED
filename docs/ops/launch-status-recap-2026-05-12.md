# PlayFunded launch status recap

Date: 2026-05-12

## Context

Current work is intentionally paused on the engineering side while the legal and Stripe approval process moves forward. This is not abandonment. Legal classification, compliant launch wording, and payment approval are now the real launch gates.

## Current state

PlayFunded is technically much closer to launch than before. Core app, auth, dashboard, admin, payments plumbing, payouts/KYC gating, multilingual pages, PostHog, Sentry/ops, Discord alerts, groups/community-lite feature, proof scripts, and production deployment are mostly in place.

The biggest blocker is no longer whether the app can work. The blocker is whether the exact business model, payout wording, market availability, and payment processing can be approved legally and commercially.

## Launch blockers

- Legal classification and approved wording for the model.
- Stripe live approval/account readiness.
- Final decision on which countries/markets can launch with payouts enabled.
- Final payout terms: timing, minimums, methods, KYC requirements, refund/retry policy.
- Odds provider paid plan right before launch.
- One final production rehearsal after Stripe/legal/odds are ready.

## Deferred until after launch

- ClamAV production file scanning.
- Apple Sign In.
- More complete traffic/product analytics beyond the current PostHog base.
- Larger community features beyond the current groups feature.
- Mercado Pago re-enable.
- Broader affiliate discovery/promotion if needed later.
- More advanced logo/brand refinement if needed.

## Things to recheck before launch

- Full Spanish/English/Portuguese walkthrough.
- Stripe live checkout and webhook end-to-end.
- Email verification/password reset live flow.
- Payout request/admin approval flow with final legal rules.
- `/api/ops/health`, Sentry alerts, Discord alerts.
- Public claims: no unsupported payment methods, no misleading payout promises.
- SEO basics: Search Console/Bing tokens if not already placed.
- Mobile Safari smoke test, especially language switching/auth/dashboard.

## Recommended next engineering pass

Once the lawyer gives direction, do a legal-to-product alignment pass:

- Update copy, FAQ, legal pages, checkout language, payout language, country rules, and Stripe-facing descriptions so the live app exactly matches what counsel approved.
- Then run a final launch rehearsal.
