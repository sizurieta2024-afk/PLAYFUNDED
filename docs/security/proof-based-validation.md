# Proof-Based Validation Workflow

This workflow adapts the useful part of the Shannon mindset to Playfunded:

- state a concrete claim
- prove it with source evidence or an executable scenario
- label anything not proven as unverified
- avoid "looks good" language

## What Counts As Proof

Three proof types are currently supported:

1. Source proof
   A check scans the real Playfunded source for required guardrails such as:
   - signature verification before webhook processing
   - owner-scoped database queries
   - server-side admin role checks
   - audit logging on admin mutations

2. Runtime scenario proof
   A check executes deterministic business-rule code and asserts an exact outcome, such as:
   - drawdown and daily-loss breaches
   - payout amount and remaining balance math
   - settlement grading for moneyline, spread, and totals

3. DB-backed mutation proof
   A check executes shared Prisma workflows against a real Postgres database and asserts persisted outcomes, such as:
   - payout row creation and funded-balance debiting
   - duplicate pending-payout rejection from persisted state
   - admin payout review writing an audit log in the same transaction
   - admin KYC review writing an audit log in the same transaction
   - live RLS catalog inspection for public tables and policies

## What Does Not Count As Proof

- UI-only restrictions without a server-side guard
- architectural opinions with no matching code evidence
- assumptions about Supabase, Vercel, Stripe, Mercado Pago, or NOWPayments console settings
- assumptions about production behavior across multiple instances when code only proves per-process behavior

## How To Run

```bash
npm run validate:proof
```

```bash
npm run validate:proof:db
```

If your development database URL already lives in `.env.local`, use:

```bash
npm run validate:proof:db:local
```

The command writes a durable artifact to:

`docs/security/proof-based-validation-report.md`

The DB mode is intentionally opt-in. If it is not enabled, or if `DATABASE_URL` is missing, the report marks DB-backed claims as unverified instead of claiming coverage.

## Current Scope

The workflow is intentionally focused on the riskiest Playfunded surfaces:

- auth and session handling
- payments and webhooks
- challenge risk rules
- pick settlement logic
- payout flows
- admin authorization
- geo-blocking and rate limiting

## Why This Exists

Playfunded has money-moving and trust-boundary-sensitive flows. For those paths, vague review language is low value. This workflow forces each important claim into one of three buckets:

- verified
- failed
- unverified
