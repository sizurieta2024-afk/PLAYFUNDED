# PlayFunded Task Tracker

## Session 1 — Infrastructure ✅ DONE
- [x] .env.example with all required variable names
- [x] prisma/schema.prisma — all entities, enums, indexes
- [x] prisma/seed.ts — 4 challenge tiers
- [x] src/lib/prisma.ts — singleton Prisma client (Prisma 7 + pg adapter)
- [x] src/lib/supabase.ts — browser + server + service-role clients (@supabase/ssr only)
- [x] src/middleware.ts — protect /dashboard and /admin, webhook passthrough
- [x] .claude/memory/ODDS_DECISION.md — 5-provider analysis (OPEN)

---

## ⚠️ BEFORE SESSION 2 — You must do this first (manual, takes 10 min)
See .claude/memory/before-session-2.md for exact step-by-step instructions.

## Session 2 — Supabase Setup + Authentication
Goal: working login. You can't test anything until this session is done.
- [ ] Create Supabase project and run first migration (`npm run db:migrate`)
- [ ] Run seed (`npm run db:seed`) — creates the 4 tiers in DB
- [ ] Configure Google OAuth in Supabase dashboard
- [ ] Configure Apple Sign-In in Supabase dashboard
- [ ] src/app/auth/login/page.tsx — login page with Google, Apple, email buttons
- [ ] src/app/auth/signup/page.tsx — signup page
- [ ] src/app/auth/verify/page.tsx — email verification page
- [ ] src/app/actions/auth.ts — signIn, signUp, signOut server actions
- [ ] src/lib/geo.ts — USA geo-block via ipapi.co (cache in session 1 hour)
- [ ] Add geo-block check to middleware for non-authenticated routes
- [ ] src/components/auth/GeoBlock.tsx — full-page block component (bilingual)
- [ ] Test full auth flow: sign up → verify → sign in → redirect to /dashboard
- [ ] RLS policies: users can only read/write own rows in User table
- [ ] Commit: "feat(auth): supabase auth, google oauth, geo-block"

## Session 3 — Design System + Layout Shell
Goal: shared layout, dark/light mode, Inter font, i18n wired up. All in one session because i18n without pages to put strings in is wasted effort.
- [ ] tailwind.config.ts — custom color tokens (bg #0a0a0f, surface #1a1a2e, green #2d6a4f, gold #f4a261)
- [ ] Dark/light mode setup via next-themes
- [ ] Inter font via next/font/google
- [ ] Install and configure next-intl (locale routing src/app/[locale]/)
- [ ] messages/es-419.json — strings for: navbar, footer, auth pages, dashboard shell
- [ ] messages/en.json — same keys, English values
- [ ] Update middleware to add next-intl locale detection alongside Supabase auth
- [ ] src/components/layout/Navbar.tsx — logo, nav links, language toggle, auth state
- [ ] src/components/layout/Footer.tsx — links, responsible gambling disclaimer, language toggle
- [ ] src/components/layout/LanguageToggle.tsx
- [ ] src/components/layout/ThemeToggle.tsx
- [ ] src/app/[locale]/layout.tsx — root layout with Navbar + Footer
- [ ] Test: dark mode toggle works, language toggle switches Spanish↔English, auth-aware nav
- [ ] Commit: "feat(design): tailwind tokens, dark mode, i18n, layout shell"

## Session 4 — Challenge Purchase Flow (Stripe first)
Goal: a user can browse tiers and buy a challenge with a card. Revenue from day 1.
- [ ] src/app/[locale]/challenges/page.tsx — tier cards with price, rules, buy CTA
- [ ] src/app/[locale]/challenges/[tierId]/page.tsx — tier detail page
- [ ] src/lib/stripe.ts — Stripe client, createCheckoutSession()
- [ ] src/app/api/checkout/stripe/route.ts — create Stripe checkout session
- [ ] src/app/api/webhooks/stripe/route.ts — handle payment.succeeded → create Challenge in DB
- [ ] src/app/[locale]/checkout/success/page.tsx — post-payment confirmation
- [ ] src/app/[locale]/checkout/cancel/page.tsx
- [ ] Stripe webhook: validate signature, idempotency (no double challenges)
- [ ] RLS: users can only read their own payments
- [ ] Test with Stripe CLI: `stripe listen --forward-to localhost:3000/api/webhooks/stripe`
- [ ] Commit: "feat(payments): stripe checkout, webhook, challenge creation"

## Session 5 — Mercado Pago + NOWPayments
- [ ] src/lib/mercadopago.ts — MP client, createPreference()
- [ ] src/app/api/checkout/mercadopago/route.ts
- [ ] src/app/api/webhooks/mercadopago/route.ts — validate + create Challenge
- [ ] src/lib/nowpayments.ts — NP client, createPayment(), validateHmac()
- [ ] src/app/api/checkout/crypto/route.ts — create NP payment, return wallet address
- [ ] src/app/api/webhooks/nowpayments/route.ts — HMAC validation + create Challenge
- [ ] src/components/checkout/CryptoCheckout.tsx — QR code + address + 20min countdown timer
- [ ] Exchange rate fetching: src/lib/exchangerates.ts — daily fetch, cache in DB or memory
- [ ] Currency display component: '$20 USD (~$340 MXN)'
- [ ] RLS: webhooks use service client (bypasses RLS)
- [ ] Test NOWPayments sandbox flow end to end
- [ ] Commit: "feat(payments): mercadopago, nowpayments, exchange rates"

## Session 6 — Odds Feed Integration
- [ ] Finalize ODDS_DECISION.md — confirm provider choice before writing any code
- [ ] src/lib/odds/types.ts — OddsProvider interface (swap-friendly)
- [ ] src/lib/odds/odds-api.ts — The Odds API adapter
- [ ] src/lib/odds/api-football.ts — API-Football adapter (LATAM supplement)
- [ ] src/app/api/odds/sync/route.ts — cron endpoint to poll and cache odds (protected by CRON_SECRET)
- [ ] Polling logic: 60s for live events, 10min for pre-game (Vercel Cron)
- [ ] OddsCache population: save to DB with composite unique constraint
- [ ] src/app/api/odds/events/route.ts — serve cached events to frontend
- [ ] Admin odds monitor: last fetch time per provider, health status
- [ ] Test: all required leagues return events with moneyline + spread + total markets
- [ ] Commit: "feat(odds): odds feed integration, caching, admin monitor"

## Session 7 — Challenge Engine: Phase Logic + Balance
Goal: the financial rules engine. Split into 3 sub-sessions for safety.

### 7a — Phase Logic + Balance Tracking
- [ ] src/lib/challenge/phases.ts — advancePhase(), checkPhaseComplete(), getProfitTarget()
- [ ] src/lib/challenge/balance.ts — applyPickResult(), recalcHighestBalance()
- [ ] Unit tests: phase 1 → phase 2 → funded progression
- [ ] Unit tests: balance updates on won/lost/void/push picks
- [ ] Commit: "feat(engine): phase logic and balance tracking"

### 7b — Risk Rules: Drawdown + Stake Cap + Auto-fail
- [ ] src/lib/challenge/risk.ts — checkDailyLoss(), checkOverallDrawdown(), checkStakeCap()
- [ ] Auto-fail: immediately fail challenge if 15% drawdown breached (no grace period)
- [ ] Daily loss reset: cron at 00:00 UTC resets dailyStartBalance
- [ ] Stake cap: enforced server-side on pick placement (5% of current balance)
- [ ] Unit tests: exact drawdown thresholds (e.g. $10,000 balance → fail at $8,500)
- [ ] Unit tests: stake cap exactly 5% (no floating point rounding errors — use integer math)
- [ ] Unit tests: daily loss exactly 10%
- [ ] RLS: challenge balance fields are read-only from client
- [ ] Commit: "feat(engine): risk rules — drawdown, stake cap, auto-fail"

### 7c — Pause + Streak + Funded Rules
- [ ] src/lib/challenge/pause.ts — activatePause(), checkPauseExpired() (48h, one per attempt)
- [ ] 30-minute pre-event lock for funded users
- [ ] Streak bonus: calculateStreakBonus(), cap at 90%
- [ ] Profit rollover: applyRollover() — increases balance + recalculates drawdown buffer
- [ ] Unit tests: pause logic, streak accumulation, rollover math
- [ ] Commit: "feat(engine): pause, streak bonus, funded rules"

## Session 8 — Pick Placement Interface
- [ ] src/app/[locale]/dashboard/place-pick/page.tsx — pick placement UI
- [ ] Sport → league → event → market → selection flow
- [ ] Stake input: enforce 5% cap in UI (show max allowed, auto-cap if over)
- [ ] Parlay builder: add legs (up to 6), calculate combined odds, show potential payout
- [ ] 30-minute lock warning for funded users (show countdown)
- [ ] Pick confirmation modal (bilingual)
- [ ] src/app/actions/picks.ts — placePick() server action: validate all risk rules server-side before inserting
- [ ] Odds display toggle: decimal ↔ American
- [ ] RLS: users can only place picks on their own active challenges
- [ ] Test: place a 3-leg parlay, verify stake cap, verify odds calculation
- [ ] Commit: "feat(picks): pick placement interface and server action"

## Session 9 — Pick Settlement Engine
- [ ] src/lib/settlement/settle.ts — settlePick(): grade won/lost/void/push, update balance
- [ ] src/app/api/settle/route.ts — cron endpoint: poll odds provider for results (every 5 min)
- [ ] Parlay settlement: all legs must settle before parlay grades
- [ ] Push handling: return stake to balance
- [ ] Void handling: return stake, don't count as a pick toward minimum
- [ ] Phase completion check after each settlement: did user reach +20%?
- [ ] Auto-fail check after each settlement: did drawdown breach 15%?
- [ ] Unit tests: every settlement outcome (won/lost/void/push for single and parlay)
- [ ] Test with real past events (hardcode a settled event in test fixtures)
- [ ] Commit: "feat(settlement): pick settlement engine, phase completion, auto-fail"

## Session 10 — User Dashboard
- [ ] src/app/[locale]/dashboard/page.tsx — overview (active challenges, recent picks, stats)
- [ ] src/app/[locale]/dashboard/challenge/[id]/page.tsx — challenge detail
- [ ] Balance history chart (Recharts line graph)
- [ ] Drawdown meter: animated bar showing current drawdown % vs 15% limit
- [ ] Daily loss meter: animated bar showing today's P&L vs 10% limit
- [ ] Profit target progress bar: current % toward +20% goal
- [ ] Picks count: X of 15 minimum completed
- [ ] src/app/[locale]/dashboard/analytics/page.tsx — win rate by sport/league/bet type
- [ ] Recharts charts: ROI over time, win rate breakdown
- [ ] Picks history table with filters (date, sport, status)
- [ ] Commit: "feat(dashboard): user dashboard, analytics, progress meters"

## Session 11 — Payout System
- [ ] src/app/[locale]/dashboard/payouts/page.tsx — payout history, request payout, rollover button
- [ ] src/app/actions/payouts.ts — requestPayout(), rolloverProfits()
- [ ] KYC trigger: first payout request → show KYC form if not approved
- [ ] src/components/kyc/KycForm.tsx — legal name, DOB, country, ID type, file upload
- [ ] KYC file upload: private Supabase Storage bucket (not publicly accessible)
- [ ] src/app/api/admin/payouts/route.ts — admin approve/reject
- [ ] src/app/api/admin/kyc/route.ts — admin KYC review
- [ ] RLS: payout records readable only by owner + admin service role
- [ ] Test: full payout request → KYC → admin approve → payout marked paid
- [ ] Commit: "feat(payouts): payout system, KYC, admin approval"

## Session 12 — Admin Panel
- [ ] src/app/[locale]/admin/page.tsx — KPI dashboard (revenue, active challenges, pass rate, funded traders, payouts, new users)
- [ ] src/app/[locale]/admin/users/page.tsx — search, view, ban/unban, KYC approval
- [ ] src/app/[locale]/admin/challenges/page.tsx — view all, manual override (logged)
- [ ] src/app/[locale]/admin/payouts/page.tsx — approval queue
- [ ] src/app/[locale]/admin/kyc/page.tsx — document review with approve/reject
- [ ] src/app/[locale]/admin/affiliates/page.tsx — commission rate management
- [ ] src/app/[locale]/admin/markets/page.tsx — market request queue
- [ ] src/app/[locale]/admin/odds/page.tsx — feed health monitor
- [ ] All admin mutations: server-side role check, audit log entry
- [ ] Commit: "feat(admin): admin panel, KPI dashboard, all queue pages"

## Session 13 — Affiliate Program
- [ ] Auto-generate PF-[6char] code on signup
- [ ] ?ref= cookie: set on visit, cleared on first purchase attribution
- [ ] src/app/[locale]/dashboard/affiliate/page.tsx — mini-dashboard (clicks, conversions, earned, pending)
- [ ] Commission calculation on webhook payment success
- [ ] Affiliate attribution on gift purchases
- [ ] Admin affiliate management (commission rate toggle: 5% ↔ 10%)
- [ ] Commit: "feat(affiliates): affiliate program, tracking, commission"

## Session 14 — Community Features
- [ ] src/app/[locale]/leaderboard/page.tsx — top 50 funded traders, ROI %, filters
- [ ] Leaderboard opt-out setting in user profile
- [ ] Public pick feed: opt-in for funded traders, picks shown only after placement
- [ ] Follow system: follow funded traders, personalized feed
- [ ] src/app/[locale]/dashboard/feed/page.tsx — followed trader picks
- [ ] Gift vouchers: purchase flow, email delivery, /redeem/[token] page
- [ ] Commit: "feat(community): leaderboard, pick feed, follow, gift vouchers"

## Session 15 — Chatbot
- [ ] src/lib/chatbot/types.ts — ChatProvider interface
- [ ] src/lib/chatbot/claude.ts — Claude API implementation (claude-haiku-4-5), Vercel AI SDK streaming
- [ ] System prompt: inject full challenge rules, payout rules, KYC rules, affiliate rules
- [ ] src/components/chatbot/ChatButton.tsx — floating bottom-right button
- [ ] src/components/chatbot/ChatWindow.tsx — conversation UI, language detection
- [ ] Out-of-scope handler: redirect to support@playfunded.com
- [ ] Architecture: provider-agnostic (swap to Intercom/Zendesk by only changing claude.ts)
- [ ] Commit: "feat(chatbot): Claude API chatbot, modular architecture"

## Session 16 — Responsible Gambling + Settings
- [ ] src/app/[locale]/dashboard/settings/page.tsx — language, currency display, notifications
- [ ] Self-exclusion flow: 30d/60d/90d/permanent options
- [ ] On exclusion: account locked, active challenges paused (status = paused, not failed), no refunds
- [ ] Re-entry: email support required (not automatic re-entry)
- [ ] Weekly deposit limit: enforced on payment checkout
- [ ] Commit: "feat(responsible): self-exclusion, deposit limits, settings"

## Session 17 — Public Pages + Email System
- [ ] src/app/[locale]/page.tsx — landing page (hero, how it works, tier cards, leaderboard preview, FAQ)
- [ ] src/app/[locale]/how-it-works/page.tsx
- [ ] src/app/[locale]/faq/page.tsx
- [ ] src/app/[locale]/legal/page.tsx — terms + privacy (both languages)
- [ ] src/app/[locale]/blog/page.tsx — placeholder
- [ ] src/lib/email.ts — Resend client, sendEmail() wrapper
- [ ] 12 email templates in src/emails/ — bilingual, React Email components
- [ ] Wire all 12 triggers to their respective flows
- [ ] Test every email trigger in development
- [ ] Commit: "feat(pages): public pages, all 12 email templates"

## Session 18 — Backup + Deploy
- [ ] src/scripts/backup.ts — export all tables to JSON → Supabase Storage 'backups' bucket
- [ ] Vercel Cron: backup at 03:00 UTC, settlement at 05:00 UTC
- [ ] vercel.json — cron configuration
- [ ] RESTORE_PLAYBOOK steps in .claude/memory/restore.md
- [ ] Deploy to Vercel: production env vars, custom domain playfunded.com
- [ ] Verify all webhooks reachable from production domain
- [ ] Run full smoke test: sign up → buy challenge → place pick → view dashboard
- [ ] Commit: "feat(deploy): backup cron, vercel deploy, smoke test"
