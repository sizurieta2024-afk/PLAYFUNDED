# PlayFunded — Claude Code Context

## Skill Graph
Read `.claude/skills/graph/index.md` at the start of every session before writing any code. It maps all domain concepts, architecture decisions, and gotchas across 13 linked files.

## What This Is
Spanish-first sports prop trading firm platform for Latin America.
Users buy challenges, trade sports props, pass phases, get funded accounts.
Full spec in README.md. Task tracker in .claude/plans/todo.md.

## Stack (Non-Negotiable)
- Next.js 15 App Router, TypeScript strict (no `any`)
- Tailwind CSS + shadcn/ui
- Supabase (Postgres) + Prisma ORM (v6, pg adapter)
- Payments: Stripe (intl), Mercado Pago (LATAM), NOWPayments (crypto)
- i18n: next-intl — ALL user-facing strings via t(), never hardcoded
- Email: Nodemailer (SMTP) | AI chatbot: Claude API (claude-haiku-4-5)
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
| 11 | Payout system + KYC | ✅ DONE |
| 12 | Admin panel | ✅ DONE |
| 13 | Affiliate program | ✅ DONE |
| 14 | Community features + gift vouchers | ✅ DONE |
| 15 | Chatbot | ✅ DONE |
| 16 | Responsible gambling + settings | ✅ DONE |
| 17 | Public pages + all 12 emails | ✅ DONE |
| 18 | Backup + deploy | ✅ DONE |

## Current State
Sessions 1–18 substantially complete. Platform is live at playfunded.lat with auto-deploy from main.

### What's Built
- Full auth (email + Google OAuth), geo-blocking, i18n (es-419, en, pt-BR)
- Challenge purchase (Stripe live, MP disabled for launch, NOWPayments crypto)
- Odds feed, pick placement, settlement engine, challenge engine (phases, risk, drawdown)
- User dashboard with analytics, balance/win-rate charts, picks table
- Payout system: request-service with serializable transactions, KYC form + upload, admin review queues
- Admin panel: 15 pages (dashboard, users, challenges, picks, payments, payouts, KYC, affiliates, odds, risk, revenue, markets, blast, launch)
- Affiliate program: attribution, conversions, codes, admin management (user-facing dashboard redirects to /dashboard — affiliate apply flow at /affiliate)
- Community: leaderboard, trader profiles, follow button, gift vouchers, redeem flow
- Chatbot: Claude Haiku API with chat widget
- 16 email templates via Nodemailer/SMTP
- Sentry error tracking, cron backup, daily reset
- Security: CSP, HSTS, X-Frame-Options, proper robots.txt, sitemap with hreflang

### Remaining Gaps
- **Mercado Pago disabled** ("disabled for launch") — enable when processor approval is complete

### Dev Environment
- Dev server: PORT 3001 — `tmux new-session -d -s playfunded "node_modules/.bin/next dev -p 3001"`
- Odds sync: POST /api/odds/sync with Authorization: Bearer CRON_SECRET
- Stripe CLI: ~/stripe — forward to localhost:3001/api/webhooks/stripe
- Test user: sizurieta2024@gmail.com

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
