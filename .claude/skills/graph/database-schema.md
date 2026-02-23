---
title: Database Schema
description: Prisma entities, key relationships, monetary conventions, and Prisma 7 setup specifics.
related: [challenge-lifecycle, risk-rules, payment-flow, money-convention, known-gotchas]
---

# Database Schema

Schema lives in `prisma/schema.prisma`. Prisma 7 (pg adapter) — see [[known-gotchas]] for the config differences from earlier Prisma versions.

## Core Entity Map
```
User ──< Challenge ──< Pick ──< ParlayLeg
User ──< Payment (one per purchase)
User ──< Payout (one per withdrawal request)
User ── KycSubmission (one, triggered at first payout)
User ── Affiliate ──< AffiliateClick
Challenge ──< Payout (links payout to challenge context)
OddsCache (standalone — no user FK)
Follow (self-referencing User join table)
MarketRequest (user suggestions, admin queue)
```

## Key Constraints
- All IDs: UUID (`@id @default(uuid())`)
- All timestamps: UTC
- `Tier.name` is `@unique` — required for seed upsert idempotency
- `OddsCache` has composite unique on `[sport, league, event, startTime]`
- `Follow` has unique on `[followerId, followingId]` — no duplicate follows
- `User.supabaseId` links Prisma User to Supabase Auth `auth.users`

## Monetary Fields
Every monetary field is **integer cents**. See [[money-convention]] for full rules.
- `Tier.fee` = challenge price in cents (2000 = $20)
- `Challenge.balance` = current simulated balance in cents
- `Pick.stake` = wagered amount in cents
- `Pick.potentialPayout` = pre-calculated win amount in cents
- Exception: `Pick.odds` is a float (decimal odds like 2.50) — the only float in the schema

## Prisma 7 Config
- `prisma/schema.prisma`: datasource block has only `provider = "postgresql"` — NO url
- `prisma.config.ts`: `datasource: { url: process.env.DATABASE_URL! }` for migrations
- `src/lib/prisma.ts`: runtime uses `PrismaPg` adapter with `pg.Pool`
- Run `npm run db:migrate` for migrations, `npm run db:seed` for tier data

## Gotchas
- `@supabase/auth-helpers-nextjs` is removed — use `@supabase/ssr` only
- Three Supabase clients exist: `createClient()` (browser), `createServerClient()` (server/cookies), `createServiceClient()` (service role, bypasses RLS)
- Service client is for webhooks and admin actions only — never expose to frontend
