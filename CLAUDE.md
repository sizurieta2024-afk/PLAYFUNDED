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
| 2 | Supabase setup + full authentication + geo-block | ✅ DONE |
| 3 | Design system + layout shell + i18n wired up | ✅ DONE |
| 4 | Challenge purchase flow (Stripe) | ✅ DONE |
| 5 | Mercado Pago + NOWPayments + exchange rates | ✅ DONE |
| 6 | Odds feed integration | ✅ DONE |
| 7 | Challenge engine: balance, risk, phases, pause, streak, rollover | ✅ DONE |
| 8 | Pick placement interface | ✅ DONE |
| 9 | Pick settlement engine | ✅ DONE |
| 10 | User dashboard + analytics | ✅ DONE |
| 11 | Payout system + KYC | TODO |
| 12 | Admin panel | TODO |
| 13 | Affiliate program | TODO |
| 14 | Community features + gift vouchers | TODO |
| 15 | Chatbot | TODO |
| 16 | Responsible gambling + settings | TODO |
| 17 | Public pages + all 12 emails | TODO |
| 18 | Backup + deploy | TODO |

## Current Session Scope
Sessions 1–10 complete. Next: Session 11 — Payout System + KYC
Dashboard routes: /dashboard (overview), /dashboard/challenge/[id] (detail + charts), /dashboard/analytics (combined stats)
Dashboard components: src/components/dashboard/ — ChallengeCard, MetricBar, BalanceChart, WinRateChart, PicksTable
Dev server runs on PORT 3001 (not 3000) — NEXT_PUBLIC_APP_URL=http://localhost:3001
Dev server start: tmux new-session -d -s playfunded "node_modules/.bin/next dev -p 3001"
Odds sync (dev): POST /api/odds/sync with Authorization: Bearer CRON_SECRET
CRON_SECRET: set in .env.local (093822ad...)
Stripe CLI at ~/stripe — forward to localhost:3001/api/webhooks/stripe
Pick placement: /dashboard/picks — event browser, stake form, recent picks
Challenge engine: src/lib/challenge/ — balance, risk, phases, pause, streak, rollover, event-lock
Webhooks: /api/webhooks/stripe, /api/webhooks/mercadopago, /api/webhooks/nowpayments — all idempotent via providerRef
Test user: sizurieta2024@gmail.com — Pro tier challenge, $1,450 balance, 1 pending pick (Lakers @ 2.10)

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
