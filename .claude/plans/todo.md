# PlayFunded Task Tracker

## Session 1 — Infrastructure
- [ ] .env.example with all required variable names
- [ ] prisma/schema.prisma — all entities, enums, indexes
- [ ] src/lib/prisma.ts — singleton client
- [ ] src/lib/supabase.ts — client + server + service helpers
- [ ] src/middleware.ts — protect /dashboard and /admin routes
- [ ] docs/decisions/ODDS_DECISION.md — document providers, leave decision OPEN
- [ ] Commit: "feat(infra): prisma schema, supabase auth, middleware"

## Session 2 — i18n
- [ ] next-intl configuration
- [ ] messages/es-419.json — base Spanish strings
- [ ] messages/en.json — base English strings
- [ ] Language toggle component
- [ ] Browser language detection on first visit

## Session 3 — Design System
- [ ] tailwind.config.ts — custom colors (#0a0a0f, #1a1a2e, #2d6a4f, #f4a261)
- [ ] Dark/light mode setup
- [ ] Inter font via next/font
- [ ] shadcn/ui component theme
- [ ] Base layout with navbar + footer

## Session 4 — Authentication
- [ ] Supabase Google OAuth
- [ ] Apple Sign-In
- [ ] Email + password with verification
- [ ] USA geo-block (ipapi.co)
- [ ] Country detection on signup
- [ ] Language detection on first login

## Session 5 — Payments
- [ ] Stripe integration (cards)
- [ ] Mercado Pago integration (LATAM)
- [ ] NOWPayments integration (crypto TRC-20)
- [ ] Exchange rate fetching (exchangerate-api.com)
- [ ] Currency display toggle
- [ ] Checkout flow
- [ ] Webhook handlers for all 3 providers

## Session 6 — Odds Feed
- [ ] Review ODDS_DECISION.md and finalize provider choice
- [ ] Odds provider interface/adapter
- [ ] OddsCache table implementation
- [ ] Polling service (60s live, 10min pre-game)
- [ ] Admin odds monitor endpoint

## Session 7 — Challenge Engine
- [ ] Phase progression logic (1 → 2 → funded)
- [ ] Balance tracking
- [ ] Daily loss limit enforcement (10% reset at 00:00 UTC)
- [ ] Overall drawdown enforcement (15% — auto-fail)
- [ ] Stake cap enforcement (5%)
- [ ] Minimum picks counter (15)
- [ ] Pause system (48-hour, one per attempt)
- [ ] Unit tests: drawdown, stake cap, auto-fail
- [ ] Streak bonus calculation

## Session 8 — Pick Placement
- [ ] Sport → league → event → market selector
- [ ] Odds display (decimal/American toggle)
- [ ] Stake input with 5% cap enforcement UI
- [ ] Parlay builder (up to 6 legs)
- [ ] 30-minute pre-event lock for funded users
- [ ] Pick confirmation modal
- [ ] Pending picks list

## Session 9 — Pick Settlement
- [ ] Poll odds provider for results
- [ ] Auto-grade picks (won/lost/void/push)
- [ ] Balance update after settlement
- [ ] Phase completion check (+20%?)
- [ ] Auto-fail check after each settlement

## Session 10 — User Dashboard
- [ ] /dashboard overview
- [ ] /dashboard/challenge/[id] — balance chart, drawdown meters
- [ ] Progress bars
- [ ] Pick history with filters
- [ ] /dashboard/analytics — Recharts charts

## Session 11 — Payout System
- [ ] Payout request flow
- [ ] KYC trigger on first payout
- [ ] KYC document upload (private bucket)
- [ ] Rollover option
- [ ] Admin payout approval queue

## Session 12 — Affiliate Program
- [ ] Auto-generate PF-[6char] code on signup
- [ ] ?ref= cookie tracking (30-day)
- [ ] Commission calculation on purchase
- [ ] /dashboard/affiliate page
- [ ] Admin affiliate management

## Session 13 — Community
- [ ] /leaderboard (public, top 50, filters)
- [ ] Opt-out setting
- [ ] Public pick feed (funded traders, opt-in)
- [ ] Follow system

## Session 14 — Gift Vouchers
- [ ] Gift purchase flow
- [ ] Redemption link generation
- [ ] Recipient email
- [ ] /redeem/[token] page

## Session 15 — Chatbot
- [ ] ChatProvider interface
- [ ] Claude API implementation (claude-haiku-4-5)
- [ ] Vercel AI SDK streaming
- [ ] System prompt injection
- [ ] Floating button component

## Session 16 — Admin Panel
- [ ] All 7 admin sections
- [ ] KPI dashboard

## Sessions 17-22
- [ ] Responsible gambling
- [ ] Public pages
- [ ] Email system (12 bilingual templates)
- [ ] Backup system
- [ ] Security audit
- [ ] Deploy to Vercel
