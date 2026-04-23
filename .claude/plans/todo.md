# PlayFunded — Current Status

## What's Built (Complete)

| Area | Status |
|------|--------|
| Infrastructure (Prisma, Supabase, middleware) | ✅ |
| Authentication (email, Google OAuth, geo-block) | ✅ |
| Design system + i18n (es-419, pt-BR, en) | ✅ |
| Challenge purchase (Stripe, Mercado Pago, NOWPayments/crypto) | ✅ |
| Odds feed (OddsAPI + API-Football) | ✅ |
| Challenge engine (balance, risk, phases, pause, streak, rollover) | ✅ |
| Pick placement (parlay + straight, stake guard, event browser) | ✅ |
| Pick settlement engine | ✅ |
| User dashboard + analytics + charts | ✅ |
| Payout system + KYC | ✅ |
| Admin panel (KPI, users, challenges, payouts, KYC, affiliates, odds, risk, revenue) | ✅ |
| Affiliate program (referral codes, commission, tracking) | ✅ |
| Leaderboard + trader profiles + follows | ✅ |
| Gift vouchers | ✅ |
| Chatbot (Claude Haiku) | ✅ |
| Responsible gambling settings | ✅ |
| Public pages (homepage, how-it-works, FAQ, contact, legal) | ✅ |
| 12 transactional emails (Resend) | ✅ |
| SEO (sitemap, robots, JSON-LD, OG image) | ✅ |
| UI redesign (gold/pink/black design system, new fonts) | ✅ |
| Security hardening + rate limiting | ✅ |
| CI pipeline (gitleaks, lint-build, smoke tests) | ✅ |
| Sentry monitoring + Codex autofix pipeline | ✅ |
| Ops health check (every 5 min) | ✅ |
| Country policy layer (geo compliance) | ✅ |
| Production deploy (playfunded.lat on Vercel) | ✅ |

---

## Open Items

### Blocking for real users
- [ ] **OddsAPI quota** — upgrade plan (OUT_OF_USAGE_CREDITS on all leagues). No live odds until resolved.

### Quality / polish
- [x] Full i18n audit on dashboard + admin pages — done (PicksTable, WinRateChart, error.tsx fixed)
- [x] Light mode QA — N/A: site is intentionally dark-only (`<html className="dark">` hardcoded)

### Nice to have
- [ ] Apple Sign-In (deferred, web-first)
- [ ] Push notifications
- [ ] TikTok / social marketing automation
