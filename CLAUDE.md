# PlayFunded — Claude Code Context

## What This Is
Spanish-first sports prop trading firm platform for Latin America.
Users buy challenges, trade sports props, pass phases, get funded accounts.
Full spec in README.md. Task tracker in tasks/todo.md.

## Stack (Non-Negotiable)
- Next.js 14 App Router, TypeScript strict (no `any`)
- Tailwind CSS + shadcn/ui
- Supabase (Postgres) + Prisma ORM
- Payments: Stripe (intl), Mercado Pago (LATAM), NOWPayments (crypto)
- i18n: next-intl — ALL user-facing strings via t(), never hardcoded
- Email: Resend | AI chatbot: Claude API (claude-haiku-4-5)
- Charts: Recharts | Animations: Framer Motion

## Project Layout
- Full spec: README.md (read-only reference)
- Tasks: tasks/todo.md
- Lessons: tasks/lessons.md
- Decisions: docs/decisions/
- Session logs: tasks/sessions/

## Build Status
| Step | Section | Status | Session |
|------|---------|--------|---------|
| 1 | Infrastructure: Supabase, Prisma, Auth | TODO | — |
| 2 | i18n setup | TODO | — |
| 3 | Design system | TODO | — |
| 4 | Authentication + geo-block | TODO | — |
| 5 | Payments: Stripe, Mercado Pago, NOWPayments | TODO | — |
| 6 | Odds feed integration | TODO | — |
| 7 | Challenge engine | TODO | — |
| 8 | Pick placement interface | TODO | — |
| 9 | Pick settlement engine | TODO | — |
| 10 | User dashboard | TODO | — |
| 11 | Payout system | TODO | — |
| 12 | Affiliate program | TODO | — |
| 13 | Community features | TODO | — |
| 14 | Gift vouchers | TODO | — |
| 15 | Chatbot | TODO | — |
| 16 | Admin panel | TODO | — |
| 17 | Responsible gambling | TODO | — |
| 18 | Public pages | TODO | — |
| 19 | Email system | TODO | — |
| 20 | Backup system | TODO | — |
| 21 | Security audit | TODO | — |
| 22 | Deploy to Vercel | TODO | — |

## Current Session Scope
[UPDATE BEFORE EACH SESSION]
Working on: Step 1 — Infrastructure
Goal: Prisma schema, Supabase connection, auth middleware, env vars

## File Conventions
- API routes: src/app/api/[resource]/route.ts
- Server actions: src/app/actions/[domain].ts
- Components: src/components/[domain]/ComponentName.tsx
- i18n messages: messages/es-419.json, messages/en.json
- Lib utilities: src/lib/[domain].ts
- Types: src/types/[domain].ts

## Hard Rules
- No raw SQL in app code — Prisma only (except complex analytics)
- Monetary amounts always stored as integer cents, never floats
- Admin role checks always server-side, never client-side
- All payment credentials via env vars only
- All user-facing text via next-intl t() — no hardcoded strings
- Error format: `{ error: string, code: string }`

## OneContext Strategy
Search before writing code each session:
- Session 1: 'PlayFunded prisma schema decisions'
- Sessions 5+: 'PlayFunded payment integration decisions'
- Sessions 7+: 'PlayFunded challenge rules'
- Session 6: 'PlayFunded odds data source'
At session end: summarize and save to tasks/sessions/session-00N.md
