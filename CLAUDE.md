# PlayFunded — Claude Code Context

## Skill Graph
Read `.claude/skills/graph/index.md` at the start of every session before writing any code. It maps all domain concepts, architecture decisions, and gotchas across 13 linked files.

## What This Is
Spanish-first sports prop trading firm platform for Latin America.
Users buy challenges, trade sports props, pass phases, get funded accounts.
Full spec in README.md. Task tracker in .claude/plans/todo.md.

## Stack (Non-Negotiable)
- Next.js 14 App Router, TypeScript strict (no `any`)
- Tailwind CSS + shadcn/ui
- Supabase (Postgres) + Prisma ORM (v7, pg adapter)
- Payments: Stripe (intl), Mercado Pago (LATAM), NOWPayments (crypto)
- i18n: next-intl — ALL user-facing strings via t(), never hardcoded
- Email: Resend | AI chatbot: Claude API (claude-haiku-4-5)
- Charts: Recharts | Animations: Framer Motion

## Project Layout
- Full spec: README.md (read-only reference)
- Tasks: .claude/plans/todo.md
- Lessons: .claude/memory/lessons.md
- Decisions: .claude/memory/ODDS_DECISION.md
- Session logs: .claude/memory/sessions.md

## Build Status
| Session | Section | Status |
|---------|---------|--------|
| 1 | Infrastructure: Prisma, Supabase libs, middleware | ✅ DONE |
| 2 | Supabase setup + full authentication + geo-block | TODO |
| 3 | Design system + layout shell + i18n wired up | TODO |
| 4 | Challenge purchase flow (Stripe) | TODO |
| 5 | Mercado Pago + NOWPayments + exchange rates | TODO |
| 6 | Odds feed integration | TODO |
| 7a | Challenge engine: phase logic + balance | TODO |
| 7b | Challenge engine: drawdown + stake cap + auto-fail | TODO |
| 7c | Challenge engine: pause + streak + funded rules | TODO |
| 8 | Pick placement interface | TODO |
| 9 | Pick settlement engine | TODO |
| 10 | User dashboard + analytics | TODO |
| 11 | Payout system + KYC | TODO |
| 12 | Admin panel | TODO |
| 13 | Affiliate program | TODO |
| 14 | Community features + gift vouchers | TODO |
| 15 | Chatbot | TODO |
| 16 | Responsible gambling + settings | TODO |
| 17 | Public pages + all 12 emails | TODO |
| 18 | Backup + deploy | TODO |

## Current Session Scope
Working on: Session 2 — Authentication implementation
Infrastructure complete: DB migrated, tiers seeded, Google OAuth configured, .env.local filled
Remaining: DB password → .env.local, then build login/signup pages + geo-block

## File Conventions
- API routes: src/app/api/[resource]/route.ts
- Server actions: src/app/actions/[domain].ts
- Components: src/components/[domain]/ComponentName.tsx
- i18n messages: messages/es-419.json, messages/en.json
- Lib utilities: src/lib/[domain].ts
- Types: src/types/[domain].ts

## Hard Rules
- No raw SQL in app code — Prisma only (except complex analytics)
- Monetary amounts ALWAYS stored as integer cents, NEVER floats
- Admin role checks ALWAYS server-side, NEVER client-side
- All payment credentials via env vars only
- All user-facing text via next-intl t() — no hardcoded strings
- Error format: `{ error: string, code: string }`
- RLS policies written alongside the code that needs them (not audited later)
- Security is not a separate session — it ships with each feature

## OneContext Strategy
Search before writing code each session:
- Session 2: 'PlayFunded supabase auth'
- Session 4+: 'PlayFunded payment integration'
- Session 7+: 'PlayFunded challenge rules drawdown'
- Session 6: 'PlayFunded odds data source'
At session end: summarize to .claude/memory/sessions.md
