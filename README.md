# PlayFunded — Master Specification
Version 1.0 | February 2026

> **Spanish-first sports prop trading firm platform for Latin America and Spain.**
> Users buy challenges, trade sports props, pass phases, get funded accounts.

## Build Order Quick Reference
| # | Step | Status |
|---|------|--------|
| 1 | Infrastructure: Supabase, Prisma schema, Auth | TODO |
| 2 | i18n: next-intl, es-419 + en message files | TODO |
| 3 | Design system: Tailwind config, shadcn/ui theme | TODO |
| 4 | Authentication: Google, Apple, email, geo-block USA | TODO |
| 5 | Payment integration: Stripe, Mercado Pago, NOWPayments | TODO |
| 6 | Odds feed integration | TODO |
| 7 | Challenge engine: phases, drawdown, stake cap, auto-fail | TODO |
| 8 | Pick placement interface | TODO |
| 9 | Pick settlement engine | TODO |
| 10 | User dashboard: balance, progress, pick history, charts | TODO |
| 11 | Payout system: request, KYC, admin queue, rollover | TODO |
| 12 | Affiliate program | TODO |
| 13 | Community: leaderboard, pick feed, follow system | TODO |
| 14 | Gift vouchers | TODO |
| 15 | Chatbot: Claude API, system prompt, modular | TODO |
| 16 | Admin panel: all sections, KPIs, queues | TODO |
| 17 | Responsible gambling: self-exclusion, deposit limits | TODO |
| 18 | All public pages: landing, how it works, FAQ, legal | TODO |
| 19 | Email system: 12 trigger emails via Resend | TODO |
| 20 | Backup system: script, Vercel Cron, RESTORE_PLAYBOOK | TODO |
| 21 | Security audit: RLS, auth checks, rate limiting, webhooks | TODO |
| 22 | Deploy to Vercel | TODO |

---

## 1. PROJECT IDENTITY & MISSION
PlayFunded allows sports bettors to prove their skill through paid challenges with simulated bankrolls, then earn real money when they get funded. Inspired by PlayerProfit.com but architecturally, ethically, and strategically superior.

**Core Mission**
- Reward genuinely skilled sports bettors with access to funded capital
- Cap user financial risk at the challenge entry fee ($20–$500)
- Phase 2 business model: copy-bet top funded traders on real sportsbook accounts

**Key Differentiators vs PlayerProfit**
- Business model aligned with users: you profit from winners (copy betting), not just losers
- Spanish es-419 first, English second — built for LATAM/Spain
- Fútbol-first: Liga MX, Copa Libertadores, Liga Argentina, LaLiga
- Bet365-mirrored odds (more relevant than DraftKings for target market)
- Lower entry point ($20 vs ~$49 minimum at PlayerProfit)
- Streak bonuses, personal analytics, leaderboard, pick gifting

---

## 2. TECH STACK — NON-NEGOTIABLE
- **Framework:** Next.js 14 App Router, TypeScript strict (no `any`)
- **Styling:** Tailwind CSS + shadcn/ui
- **Database:** Supabase (Postgres) + Prisma ORM
- **Auth:** Supabase Auth (Google OAuth, Apple Sign-In, email/password)
- **Payments:** Stripe (international), Mercado Pago (LATAM), NOWPayments (crypto)
- **i18n:** next-intl — ALL user-facing strings via t(), never hardcoded
- **Email:** Resend
- **AI Chatbot:** Claude API (claude-haiku-4-5)
- **Charts:** Recharts | **Animations:** Framer Motion

---

## 3. ODDS FEED
Research and decide before writing any odds code. Document in docs/decisions/ODDS_DECISION.md.

**Required leagues:** Liga MX, LaLiga, EPL, Serie A, Bundesliga, UCL, Copa Libertadores, Liga Argentina, Liga BetPlay Colombia, MLS, NBA, NFL, UFC, Tennis ATP/WTA

**Providers to evaluate:** The Odds API, Sportradar, API-Football, BetsAPI, SportsDataIO

**Standard:** Mirror Bet365. Decimal default, American toggle. Poll 60s live / 10min pre-game.

**Parlay:** multiply decimal odds × stake. Max 6 legs. 5% stake cap on total parlay. Mixed-sport allowed.

---

## 4. DATABASE SCHEMA
UUID PKs. All timestamps UTC. Monetary amounts in integer cents always.

**Entities:** User, Challenge, Tier, Pick, ParlayLeg, Payout, Payment, Affiliate, AffiliateClick, MarketRequest, OddsCache

**Enums:** AttemptStatus (active/passed/failed/funded), PhaseType (phase1/phase2/funded), PaymentProvider (card/usdt/usdc/btc/mercadopago), TradeStatus (pending/won/lost/void/push)

---

## 5. AUTHENTICATION
Google OAuth (primary), Apple Sign-In (iOS), Email+password (fallback). Supabase Auth JWT.

**Geo-block USA:** Check IP on signup + every non-auth page load. US → full-page block bilingual. Don't block US IPs already logged in. Cache ipapi.co/json for 1 hour.

---

## 6. TIERS & CHALLENGE RULES

**Phase structure:** Phase 1 (Evaluation) → Phase 2 (Confirmation) → Funded. Each phase: reach +20% of starting balance.

**Risk rules (all phases):**
- Max daily loss: 10% of starting balance (resets 00:00 UTC)
- Max overall drawdown: 15% from highest balance ever (auto-fails immediately)
- Stake cap: 5% of current balance per bet (single or total parlay)
- Max parlay legs: 6
- Minimum picks per phase: 15
- One 48-hour pause per attempt
- No upgrades after start. Full price to retry.

**Funded extras:** 30-min pre-event lock. 70–80% profit split. Rollover option. Copy eligibility: 30 picks + 8% ROI.

**Streak bonus:** 3 consecutive profitable funded months → +2% split. Cap: 90%.

---

## 7. SPORTS & MARKETS
**Day 1:** ⚽ Football (10 leagues), 🏀 NBA, 🏈 NFL, 🥊 UFC, 🎾 Tennis ATP/WTA

**Bet types:** Moneyline, Spread, Totals, Player props, Parlays (6 legs max), Live betting

**Odds:** Decimal default, American toggle. USD always, local currency in parentheses.

---

## 8. PAYMENTS

**Incoming:** Stripe (cards), Mercado Pago (LATAM), NOWPayments (USDT/USDC/BTC TRC-20)

**Currency display:** MXN, ARS, COP, CLP, PEN, EUR, USD. Rates from exchangerate-api.com daily. Format: '$20 USD (~$340 MXN)'. NEVER charge in local currency.

**Crypto:** NOWPayments → wallet address + 20min expiry. QR + countdown timer. Webhook → unlock challenge.

**Outgoing:** Bank wire ($20 min), Crypto ($50 min). Rolling 30-day cycle. KYC before first payout only. Admin approves manually.

---

## 9. KYC
Triggered ONLY on first payout request. Admin reviews manually. NO banner or popup anywhere — only in FAQ + Legal pages.

---

## 10. AFFILIATE PROGRAM
Auto-generated code at signup: PF-[6 alphanumeric]. 5% default (admin can set 10%). $50 minimum payout. 30-day cookie tracking. Cleared after conversion.

---

## 11. BILINGUAL
es-419 default. en second. messages/es-419.json and messages/en.json. next-intl everywhere. No hardcoded strings.

---

## 12. CHATBOT
Claude API (claude-haiku-4-5), Vercel AI SDK. PlayFunded-only scope. Interface-driven architecture (swap to Intercom/Zendesk without touching frontend). No persistent history.

---

## 13. COMMUNITY
**Leaderboard:** Top 50 funded traders by ROI %, rolling 30d. Anonymized usernames. Opt-out available.

**Pick Feed:** Opt-in. Picks visible ONLY after placement confirmed. Follow funded traders.

**Gift Vouchers:** Select tier → recipient email → pay → redemption link. Affiliate commission applies.

---

## 14. RESPONSIBLE GAMBLING
Self-exclusion (30d/60d/90d/permanent) in Settings. Challenges paused (not failed). Re-entry: email support. Weekly deposit limit in Settings. Footer disclaimer only — NO popup.

---

## 15. ADMIN PANEL (/admin)
Role = admin. Architecture supports superadmin/support/finance later.

**KPIs:** Revenue, active challenges, pass rates, funded traders, payouts, affiliate earnings, new users.

**Sections:** Users, Challenges, Payouts, KYC Queue, Affiliates, Market Requests, Odds Monitor.

---

## 16. EMAILS (Resend, bilingual, 12 triggers)
Welcome, Challenge purchased, Phase passed, Challenge failed, Funded, Payout ready, Payout processed, KYC requested, KYC approved/rejected, Gift sent, Gift received, Self-exclusion confirmation.

---

## 17. BACKUP SYSTEM
Supabase built-in daily (7-day retention). /scripts/backup.ts exports to Supabase Storage 'backups' bucket. Vercel Cron 03:00 UTC. RESTORE_PLAYBOOK.md at root.

---

## 18. ALL ROUTES

**Public:** /, /challenges, /leaderboard, /how-it-works, /legal, /faq, /blog

**Auth:** /auth/login, /auth/signup, /auth/verify

**Dashboard:** /dashboard, /dashboard/challenge/[id], /dashboard/place-pick, /dashboard/analytics, /dashboard/payouts, /dashboard/affiliate, /dashboard/settings, /dashboard/leaderboard, /dashboard/feed

**Admin:** /admin, /admin/users, /admin/challenges, /admin/payouts, /admin/kyc, /admin/affiliates, /admin/markets, /admin/odds

---

## 19. UI/UX
Dark default. Light toggle. Dark: bg #0a0a0f, surface #1a1a2e, green #2d6a4f, gold #f4a261. Font: Inter. Mobile-first. Framer Motion. Recharts. 3-step onboarding modal (skip available).

---

## 20. SECURITY
RLS on ALL Supabase tables. Stripe + NOWPayments webhook signature validation. Admin routes: server-side only. KYC docs: private bucket. Rate limiting. CORS: production domain only. CSP via Next.js middleware.

---

## 21. CODE QUALITY
- TypeScript strict — no `any`
- Zod on all API routes
- Prisma for all DB — no raw SQL except complex analytics
- Error format: `{ error: string, code: string }`
- Monetary amounts: integer cents always
- All text through i18n — no hardcoded strings

**NOT to build:** No free trial, no WhatsApp/Telegram, no public pass rate stats, no copy-betting infra (Phase 2), no mobile app.

---

## 22. FINAL NOTE
PlayFunded is not a clone. The house wins when the players win. Target user: skilled bettor in CDMX, Bogotá, BA, or Madrid — burned by sportsbooks. Starting at $20.

*PlayFunded — Tu habilidad. Nuestro capital. / Your skill. Our capital.*
