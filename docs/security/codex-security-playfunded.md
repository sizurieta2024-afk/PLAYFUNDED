# Playfunded Codex Security Context

Use this document as the seed context for Codex Security scans on Playfunded.

## Product Summary

Playfunded is a sports challenge platform. Users buy challenges, place picks, pass evaluation phases, and may become funded traders eligible for payouts.

The app handles money-moving and compliance-sensitive flows:
- challenge purchases
- payment webhooks
- payout requests
- KYC submissions and review
- affiliate commissions
- admin review and approval actions

## Stack

- Next.js App Router
- TypeScript
- Supabase Auth
- Supabase Postgres + Prisma
- Stripe
- Mercado Pago
- NOWPayments
- Vercel

## Critical Assets

- user sessions and Supabase auth state
- admin role and admin-only actions
- payout eligibility and payout amounts
- challenge balances, funded status, and profit-split calculations
- payment fulfillment state
- KYC documents and KYC status
- affiliate commission attribution
- service-role credentials and any path that bypasses RLS

## Main Trust Boundaries

- public user -> Next.js routes and server actions
- browser -> authenticated dashboard routes
- authenticated user -> admin-only routes and actions
- external payment providers -> webhook handlers
- Supabase user-scoped client -> service-role client
- KYC/private data -> support/admin surfaces

## Threat Model

Assume attackers will try to:
- access admin actions as a normal user
- read or modify another user's data
- fake or replay payment webhooks
- create challenges or credits without real payment
- bypass KYC or payout windows
- request larger payouts than allowed
- exploit race conditions around payout creation or payment fulfillment
- abuse affiliate conversion logic
- use redirect or callback parameters for open redirect or auth confusion

Treat UI restrictions as non-security boundaries. Only server-side checks count.

## Highest-Priority Review Areas

1. Authentication and authorization
   Focus on middleware, admin route protection, server actions, and any role checks.
2. Payment and webhook handling
   Focus on signature validation, idempotency, metadata trust, replay handling, and fulfillment.
3. Payout logic
   Focus on KYC gating, profit math, duplicate payout prevention, rollover logic, and race conditions.
4. Data isolation
   Focus on Supabase RLS assumptions, service-role use, and cross-user data access.
5. Sensitive documents and auditability
   Focus on KYC upload/access paths, private storage assumptions, and admin audit logs.

## Initial File Scope

Start scans with these files:

- `src/middleware.ts`
- `src/lib/supabase.ts`
- `src/app/auth/callback/route.ts`
- `src/app/actions/payouts.ts`
- `src/app/actions/admin.ts`
- `src/app/api/webhooks/stripe/route.ts`
- `src/app/api/webhooks/nowpayments/route.ts`
- `src/app/api/webhooks/mercadopago/route.ts`
- `src/app/api/checkout/stripe/route.ts`
- `src/app/api/checkout/nowpayments/route.ts`
- `src/app/api/checkout/mercadopago/route.ts`
- `src/app/api/admin/payouts/route.ts`
- `src/app/api/admin/kyc/route.ts`
- `src/app/api/admin/picks/settle/route.ts`
- `src/app/api/kyc/upload/route.ts`
- `prisma/schema.prisma`

## Important Business Rules

Codex Security should treat violations of these as security-relevant:

- only admins may perform admin mutations
- only paid checkout completion should create a challenge or unlock a gift flow
- payout requests require approved KYC
- payout requests must only be possible for the owning funded challenge
- payout amount must never exceed allowed profit share
- duplicate pending payouts must be prevented
- KYC files must not be public
- service-role access must never be reachable from client code

## Environment Notes

Best validation environment:
- staging deployment with test payment providers
- seeded admin user
- seeded normal user
- test funded challenge with profit
- test payout-ready user with approved KYC

Useful test scenarios:
- normal user hitting `/admin`
- forged webhook signature
- replayed webhook event
- payout race with duplicate submissions
- payout request for another user's challenge id
- callback redirect manipulation

## How To Use In Codex Security

1. Connect the GitHub repository to Codex Security.
2. Select this repo and the target branch.
3. Paste the sections above into the threat model or project context field.
4. Run the first scan on auth, admin, webhooks, and payouts before scanning the full repo.
5. If the tool supports validation, give it a staging environment with test credentials only.
