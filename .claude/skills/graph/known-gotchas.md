---
title: Known Gotchas
description: Non-obvious decisions, constraints, and traps that a future Claude session must know before writing any code.
related: [database-schema, risk-rules, i18n-pattern, security-model, payment-flow]
---

# Known Gotchas

These are the things that are NOT in the README but will cause bugs or confusion if missed.

## Prisma 7 Setup (different from every Prisma tutorial online)
- `datasource db {}` in `schema.prisma` has ONLY `provider = "postgresql"` — no `url`, no `directUrl`
- Connection URL lives in `prisma.config.ts` under `datasource: { url: ... }`
- Runtime client requires `PrismaPg` adapter from `@prisma/adapter-pg` — see `src/lib/prisma.ts`
- `npm run db:migrate` = `prisma migrate dev`, `npm run db:seed` = ts-node seed script
- All Prisma tutorials showing `url = env("DATABASE_URL")` in schema.prisma are for Prisma ≤6

## Supabase Client Split (three clients, each with a specific use)
- `createClient()` — browser only ('use client' components)
- `createServerClient()` — Server Components, Route Handlers, Server Actions (reads session from cookies)
- `createServiceClient()` — server-only, bypasses RLS, for admin operations and webhooks only
- `@supabase/auth-helpers-nextjs` is REMOVED — `@supabase/ssr` only

## File Hook Constraint (this repo)
- A global Claude Code hook blocks creating `.md` files outside of: `README.md`, `CLAUDE.md`, `AGENTS.md`, `CONTRIBUTING.md`, and files in `.claude/` subdirectories
- Task files, decisions, session logs, and the skill graph all live under `.claude/`
- The spec lives in `README.md` (not `SPEC.md`)

## next-intl Version Warning
`next-intl@4.x` targets Next.js 15. This project is Next.js 14. If locale routing behaves unexpectedly, pin to `next-intl@3.x`.

## Risk Rules — Math Edge Cases
- Daily loss is 10% of **phase starting balance**, not current balance. See [[risk-rules]].
- Drawdown is from **all-time highest balance**, not phase start. See [[risk-rules]].
- All risk rule math uses `Math.floor(a * b / 100)` pattern, never `a * 0.xx` — see [[money-convention]].

## Payment Webhooks — Body Parsing
Webhook handlers must read the raw body with `req.text()` before any parsing. Stripe and NOWPayments signature verification requires the raw bytes — JSON.parse first destroys the signature.

## Settlement Idempotency
The settlement cron can run overlapping. Always filter picks with `status = pending` AND `settledAt IS NULL`. Update status atomically. Never settle a pick twice.

## Geo-Block Scope
The USA block applies to signup and non-authenticated page loads only. Do NOT block authenticated US users — they are grandfathered. Checking `session` in middleware before running geo-block is required.

## Challenge Engine Sessions Are Split
Sessions 7a, 7b, 7c each require unit tests before moving to the next. The challenge engine handles real money. Do not combine them into one session.

## Odds Decision Is Still Open
`.claude/memory/ODDS_DECISION.md` has a provider recommendation but it is marked OPEN. Confirm the decision and update the file before writing any odds integration code in Session 6.
