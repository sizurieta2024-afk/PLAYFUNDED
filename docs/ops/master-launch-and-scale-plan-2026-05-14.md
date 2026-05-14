# PlayFunded Master Launch And Scale Plan

Date: 2026-05-14

Purpose: organize the work from "almost launch-ready" into a real operating business with clean legal/payment alignment, reliable production operations, mobile app distribution, growth loops, and the ability to support thousands of users without breaking trust.

This is an engineering and operations plan, not legal advice. Legal wording and regulated-market decisions must follow counsel's final guidance.

## North Star

PlayFunded should launch as a serious, trusted product:

- users understand exactly what they are buying
- payments, challenge access, payouts, KYC, and support work predictably
- public claims match the actual product
- Spanish, English, and Portuguese experiences are consistent
- the team can detect, debug, and recover from production incidents
- the product can grow from early launch to thousands of users without emergency rewrites
- the future mobile apps are planned correctly instead of rushed into store-review problems

## Current Baseline

Already strong:

- production domain is `https://playfunded.lat`
- production source of truth is GitHub `main`
- GitHub repo is `sizurieta2024-afk/PLAYFUNDED`
- Vercel account is `sizurieta2024-4707`
- CI, launch smokes, and production deploys have passed
- Discord incident alert path has been proven through GitHub Actions
- auth, member, admin, payout/KYC, affiliate, groups, and public locale routes are mostly in place
- PostHog public envs are configured
- Mercado Pago public claims were removed and the provider remains disabled for launch
- affiliate is live as a public apply flow and approved-only dashboard flow
- email/password verification and reset flows exist
- proof tooling is materially stronger than before

Known launch gates:

- legal classification and approved wording
- Stripe live approval and live payment rehearsal
- paid odds plans and final odds/settlement rehearsal
- final launch-day production rehearsal
- optional Bing verification and Search Console operational confirmation
- production ClamAV/KYC scanning decision
- app-store strategy before mobile submissions

## Guiding Principles

- Do not add exciting features while legal/payment launch blockers are unresolved.
- Ship launch-critical fixes in small, verified batches.
- Do not deploy from a dirty worktree.
- Keep social automation, legal docs, app code, and production ops as separate workstreams.
- Every public claim must match real runtime behavior.
- If a flow touches money, auth, payout, KYC, admin permissions, or webhooks, treat it as high-risk.
- Mobile apps should be prepared early but submitted only after legal wording and payment strategy are stable.

## Phase 0: Workspace And Source-Of-Truth Control

Goal: keep the repo clean enough that we can move fast without accidentally deploying unrelated work.

### Steps

1. Keep `main` as production source of truth.
2. Keep feature work on branches or explicit small commits.
3. Maintain `docs/ops/workspace-hygiene.md` after each major pass.
4. Classify remaining dirty files:
   - social automation: review separately
   - legal explainer artifacts: archive or commit intentionally
   - fixture purge script: review as an ops utility before committing
   - `.env.example` social additions: commit only with social automation changes
5. Before any deploy:
   - run `git status --short`
   - stage only intended files
   - verify CI/deploy after push

### Verification

- `git status --short`
- `git log --oneline --decorate -5`
- GitHub Actions `CI`
- GitHub Actions `Deploy Production`

### Exit Criteria

- no accidental production deploy includes social/legal scratch work
- all launch-critical commits are small and explainable

## Phase 1: Legal-To-Product Alignment

Goal: once counsel responds, make the live product match the approved business model exactly.

### Steps

1. Convert lawyer feedback into product rules:
   - what PlayFunded can call the product
   - what it cannot call the product
   - whether words like funded, challenge, payout, profit, simulated balance, trader, and capital need restrictions
   - which countries can see checkout
   - which countries can request payouts
   - what refund policy applies
   - what KYC language is required
2. Create a legal wording matrix:
   - Spanish source wording
   - English equivalent
   - Portuguese equivalent
   - where each phrase appears
3. Update public pages:
   - landing
   - challenges/pricing
   - FAQ
   - affiliate landing
   - auth/signup hints
   - footer/legal links
   - SEO metadata and structured data
4. Update in-app operational copy:
   - checkout warnings
   - dashboard status messages
   - payout request messages
   - KYC upload/review messages
   - failed challenge/funded challenge language
5. Update legal pages only after counsel approves final language.
6. Search the repo for banned/ambiguous terms.
7. Verify all three locales.

### Verification

- `rg "Mercado Pago|guaranteed|deposit|investment|betting|gambling|free|risk-free|apostar|apuesta|garantizado|depósito" src messages docs`
- `npm run lint`
- `npm run build`
- manual browser checks in `/`, `/en`, `/pt-BR`
- mobile Safari check for public pages and checkout copy

### Exit Criteria

- no unsupported payment method claims
- no legally ambiguous claims remain in public copy
- Spanish, English, and Portuguese say the same thing operationally

## Phase 2: Stripe Live Readiness

Goal: turn payments from technically prepared into launch-operational, without granting access incorrectly.

### Steps

1. Wait for legal approval before enabling live charge collection.
2. Confirm Stripe business account status:
   - account verified
   - live mode enabled
   - business details accepted
   - payout/bank settings complete
3. Configure live environment:
   - `STRIPE_SECRET_KEY`
   - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
   - `STRIPE_WEBHOOK_SECRET`
4. Confirm product/price mapping:
   - Starter
   - Pro
   - Elite
   - Master
   - Legend
5. Confirm checkout behavior:
   - checkout creation does not create challenge access
   - challenge is granted only after confirmed webhook
   - duplicate webhook does not duplicate challenge/payment fulfillment
   - failed/canceled checkout leaves no active challenge
6. Confirm blocked-country behavior.
7. Confirm support/admin visibility:
   - payment appears in admin
   - user email and challenge tier are correct
   - support can inspect payment status
8. Run a real low-value live payment if Stripe/legal allow it.
9. Run refund/cancel test if legally and operationally safe.

### Verification

- `npm run proof:payment-webhooks`
- `npm run proof:hardening`
- `npm run validate:proof`
- `BASE_URL=https://playfunded.lat node --env-file=.env.local scripts/run-live-payment-smoke.mjs`
- Stripe dashboard webhook event inspection

### Exit Criteria

- challenge access is impossible before confirmed payment
- live checkout works in allowed countries
- disabled/blocked providers fail clearly
- admin can diagnose payment issues

## Phase 3: Odds, Settlement, And Challenge Integrity

Goal: make the actual gameplay loop reliable before launch traffic arrives.

### Steps

1. Buy the paid odds plans right before final rehearsal.
2. Confirm odds provider keys in production.
3. Run fresh odds sync.
4. Run settlement.
5. Confirm `/api/ops/health` stays green after recency windows.
6. Verify picks cannot use stale/hidden/test odds.
7. Verify concurrent pick placement does not corrupt balances.
8. Verify challenge rules:
   - min/max stake
   - balance changes
   - win/loss/push
   - failure condition
   - funded condition
   - payout eligibility
9. Verify admin-funded-trader displays only true funded/eligible users.
10. Run multilingual dashboard checks.

### Verification

- `/api/odds/sync` with `CRON_SECRET`
- `/api/settle` with `CRON_SECRET`
- `/api/ops/health`
- `npm run proof:hardening`
- `npm run validate:proof:db`
- member smoke across all locales

### Exit Criteria

- odds sync is not quota-blocked
- settlement is recent
- no test/fixture accounts appear as real funded users
- user dashboard and admin dashboard agree

## Phase 4: Auth, KYC, Payout, And Support Rehearsal

Goal: prove the trust-sensitive flows as a full business operation, not isolated screens.

### Steps

1. Email signup rehearsal:
   - signup sends verification email
   - unverified login shows the verify-email guidance
   - verified email creates session and user record
2. Password reset rehearsal:
   - forgot password success message does not reveal account existence
   - reset link opens correct domain
   - reset completes and returns to login
3. Google login rehearsal in a normal browser.
4. KYC upload decision:
   - if KYC uploads are live at launch, configure ClamAV/KYC envs
   - if not live, make sure the UI does not promise instant upload clearance
5. Payout flow rehearsal:
   - eligible user requests payout
   - ineligible user is blocked clearly
   - admin reviews payout
   - audit log is created
   - support workflow sees the relevant user/payment/payout state
6. Support macros:
   - verification email issue
   - payment pending
   - failed challenge explanation
   - payout review pending
   - country unavailable
7. Incident drill:
   - force ops alert
   - confirm staff-only Discord alert receives it
   - document response owner and rollback action

### Verification

- `npm run smoke:password-reset`
- `npm run smoke:admin`
- `npm run smoke:payout-kyc`
- `npm run smoke:admin-support`
- controlled `ops-health-5m` alert workflow dispatch

### Exit Criteria

- support can handle the top 10 expected issues without engineering intervention
- payout and KYC gates fail safely
- incident alerts reach staff

## Phase 5: Public Web Launch

Goal: launch the web app with controlled risk and measurable user acquisition.

### Steps

1. Freeze launch scope:
   - no new features except blockers
   - no visual/logo experiments unless critical
   - no payment provider additions
2. Final launch copy audit:
   - landing
   - FAQ
   - affiliate
   - checkout
   - legal pages
   - emails
   - metadata
3. Final technical checklist:
   - CI green
   - production deploy green
   - ops health green
   - odds sync green
   - settlement green
   - Stripe live ready
   - Discord alerts proven
4. PostHog launch dashboard:
   - visitor to signup
   - signup to verify
   - verify to challenge view
   - challenge view to checkout
   - checkout started to paid
   - paid to first pick
   - first pick to active challenge
   - affiliate apply funnel
   - status: event instrumentation exists; PostHog UI dashboard still needs to be built
5. Launch-day monitoring:
   - watch payments
   - watch Sentry
   - watch ops health
   - watch support inbox
   - watch Discord alerts
   - watch conversion funnel
6. Soft-launch first:
   - small audience
   - manual support available
   - no broad paid ads until first real users complete checkout and challenge flows
7. Then increase traffic:
   - TikTok bio
   - affiliate partners
   - small paid test
   - founder-led posts
   - retargeting later

### Verification

- launch-day checklist
- live smoke set
- manual mobile Safari and Chrome checks
- PostHog event sanity check

### Exit Criteria

- first real payments complete
- no challenge access bugs
- support issues are understandable
- no public claim mismatch

## Phase 6: Mobile App Strategy

Goal: prepare App Store and Google Play without creating store-review/legal problems.

### Recommended Direction

Start with a mobile MVP that reuses the existing web platform through a controlled app shell or native wrapper only if store-review/payment rules allow it. Do not rebuild the entire product natively before the web business model is proven.

### Why

- fastest path to mobile presence
- lowest engineering risk
- same backend, auth, challenge logic, payments, and admin tooling
- easier to keep Spanish/English/Portuguese consistent
- lets us learn app-store objections before building expensive native features

### App Store Risk

Apple and Google may scrutinize:

- real-world payouts
- challenge fees
- simulated balances
- financial/trading language
- gambling-like wording
- external payment links or web checkout
- KYC and regional restrictions

The mobile app should be submitted only after legal wording is locked and payment strategy is store-compliant.

Official references to re-check before implementation:

- Apple App Store Connect workflow: `https://developer.apple.com/help/app-store-connect/get-started/app-store-connect-workflow/`
- Apple TestFlight: `https://developer.apple.com/testflight`
- Google Play release tracks: `https://play.google.com/console/about/releasesoverview`
- Google Play real-money gambling, games, and contests policy: `https://support.google.com/googleplay/android-developer/answer/9877032/`

### Steps

1. Decide mobile product scope:
   - view dashboard
   - view groups
   - view challenge progress
   - receive support/help
   - maybe create picks if compliant
   - avoid confusing payment/payout wording
2. Decide payment strategy with counsel:
   - web-only checkout
   - in-app purchase
   - restricted mobile checkout
   - read-only mobile app until store approval is clearer
3. Create app-store compliance package:
   - plain business model explanation
   - no user deposit wording
   - payout funding explanation
   - country availability
   - KYC policy
   - reviewer demo account
4. Create app assets:
   - app icon
   - splash screen
   - screenshots for Spanish/English/Portuguese if launching all locales
   - short and long descriptions
   - keywords
   - support URL
   - privacy policy URL
5. Apple setup:
   - Apple Developer Program
   - App Store Connect app record
   - bundle identifier
   - TestFlight build
   - internal testing
   - external beta if needed
   - App Review submission
6. Google Play setup:
   - Play Console app
   - package name
   - Android App Bundle
   - app content declarations
   - Data Safety form
   - closed/internal testing track
   - production submission
7. Technical mobile decisions:
   - React Native / Expo if building native screens
   - Capacitor if wrapping the web app
   - native push notifications later
   - deep links for auth/reset/verify
8. Mobile QA matrix:
   - iPhone Safari and app
   - Android Chrome and app
   - Spanish/English/Portuguese
   - auth
   - reset password
   - groups
   - dashboard
   - challenge state
   - affiliate apply
   - support
9. Store-review rehearsal:
   - create reviewer credentials
   - write exact reviewer notes
   - record a short demo video if needed
   - make sure all external links work
10. Submit after web launch is stable.

### Exit Criteria

- mobile app has a clear compliant scope
- store metadata matches legal-approved language
- reviewer can understand the business model in under two minutes
- no payment/store-policy surprise blocks the web business

## Phase 7: Growth Engine

Goal: build acquisition channels that compound instead of relying on one viral post.

### Steps

1. Instrument growth funnels:
   - visitor source
   - landing variant
   - locale
   - signup
   - verified email
   - checkout start
   - payment success
   - challenge activation
   - first pick
   - current status: core signup, verification, checkout, payment, first pick, group, affiliate, and payout events are implemented
   - group creation/join
   - affiliate application
2. Build offer clarity:
   - what the challenge gives
   - who it is for
   - why PlayFunded is different
   - what payout means
   - what is simulated
3. Launch social content pipeline:
   - educational TikTok/Reels
   - founder explanation posts
   - challenge examples
   - transparent business-model posts
   - affiliate recruitment later
4. Affiliate soft launch:
   - approve only trusted affiliates first
   - verify conversion tracking
   - avoid broad public promotion until support capacity is ready
5. Email lifecycle:
   - signup verification reminder
   - checkout abandonment
   - challenge started
   - first pick guidance
   - challenge failed explanation
   - payout eligibility explanation
6. Community/groups:
   - friend groups are a retention loop
   - add invite prompts after purchase
   - show progress safely
   - protect privacy defaults
7. Paid acquisition only after:
   - real conversion funnel is measured
   - refund/support rate is manageable
   - payment success rate is stable

### Exit Criteria

- we can see which channel creates paid users
- users understand the product before paying
- support does not get overwhelmed by confused users

## Phase 8: Scale And Reliability

Goal: prepare for thousands of users before traffic exposes weak points.

### Steps

1. Database scale pass:
   - review indexes
   - profile dashboard queries
   - profile admin list queries
   - paginate broad admin lists
   - watch `OpsEventLog` and rate-limit table growth
2. Backup/restore maturity:
   - keep current backup proof
   - move toward provider-native Postgres backups or streaming dump for larger scale
   - rehearse restore quarterly
3. Incident response:
   - define severity levels
   - define rollback steps
   - define who answers support
   - define when to pause checkout
4. Abuse prevention:
   - watch signup rate
   - watch checkout attempts
   - watch reset-email abuse
   - watch suspicious picks/payout patterns
   - add stricter rate limits where real traffic shows abuse
5. Observability:
   - Sentry issue quality
   - PostHog funnels
   - ops health
   - payment webhooks
   - odds sync/settle logs
6. Cost controls:
   - odds API usage
   - database growth
   - Vercel usage
   - Sentry event volume
   - email volume
7. Security reviews:
   - auth
   - payments
   - admin permissions
   - payout approval
   - groups privacy
   - affiliate links

### Exit Criteria

- thousands of users do not require emergency architecture changes
- admins can operate the business from the dashboard
- support can diagnose user states quickly
- incidents are detected before users flood support

## Phase 9: Post-Launch Product Expansion

Goal: grow carefully after the core business is real.

### Candidate Features

Build first:

- stronger PostHog dashboards
- improved groups retention loop
- better admin search/filtering
- affiliate conversion dashboards
- mobile app MVP
- support macros and internal notes

Defer until after stable revenue:

- Apple Sign In
- Mercado Pago
- advanced community features
- more payment methods
- native mobile rewrites
- aggressive paid ads
- broad affiliate public promotion

Only build if metrics justify it:

- leaderboards
- public profiles
- social sharing
- referral competitions
- advanced analytics for users

## Week-By-Week Operating Plan

### Week 1: Legal + Wording Prep

- wait for counsel feedback
- build wording matrix
- update copy after approval
- run locale consistency audit
- avoid new features

### Week 2: Payments + Auth Rehearsal

- configure Stripe live after approval
- test live checkout and webhooks
- rehearse email verification/reset
- rehearse support/admin payment inspection

### Week 3: Odds + Full Product Rehearsal

- buy odds plans
- run odds sync and settlement
- test challenge lifecycle
- test payout/KYC/admin/support
- run final live smoke set

### Week 4: Soft Web Launch

- launch to small controlled audience
- monitor PostHog, Sentry, Discord, support, payments
- fix only real blockers
- collect first user questions
- tighten copy based on confusion

### Week 5: Growth Foundation

- improve funnels
- build email lifecycle
- approve first affiliates carefully
- publish educational content
- create app-store asset checklist

### Week 6: Mobile MVP Decision

- choose wrapper vs native MVP
- decide payment/store policy with counsel
- prepare Apple/Google accounts and app records
- create reviewer notes and demo account plan

### Weeks 7-8: Mobile Build And Beta

- implement mobile shell or MVP
- add deep-link handling for auth/reset/verify
- create screenshots and metadata
- run TestFlight/internal testing
- run Android internal/closed testing

### Weeks 9-10: App Store Submissions

- submit Apple review
- submit Google production review after required testing path
- answer reviewer questions
- patch metadata or wording if rejected
- do not change web business logic just to satisfy a reviewer without legal review

### Weeks 11-12: Scale Hardening

- profile production-like database volume
- improve admin pagination/search
- review backup strategy
- improve incident runbooks
- tune rate limits based on real traffic

## What Codex Should Do Next

Immediate next work before lawyer response:

1. Review and classify the remaining dirty files.
2. Prepare a legal-to-product wording matrix template.
   - Created: `docs/legal/legal-to-product-wording-matrix-2026-05-14.md`
3. Prepare Stripe live rehearsal checklist with exact steps and expected outcomes.
   - Created: `docs/ops/stripe-live-rehearsal-checklist-2026-05-14.md`
4. Prepare App Store / Google Play asset and compliance checklist.
   - Created: `docs/ops/mobile-app-store-launch-checklist-2026-05-14.md`
5. Audit current PostHog event coverage against the launch funnel.
   - Created: `docs/ops/posthog-launch-funnel-audit-2026-05-14.md`
6. Implement launch-critical PostHog product events.
   - Added: `src/lib/analytics/events.ts`
   - Added: `src/lib/analytics/posthog-client.ts`
   - Added: `src/lib/analytics/posthog-server.ts`
   - Added proof: `npm run proof:posthog-events`
7. Make PostHog launch dashboard setup repeatable.
   - Created: `docs/ops/posthog-launch-dashboard-setup-2026-05-14.md`
   - Added setup: `npm run posthog:dashboard:setup`
   - Added proof: `npm run proof:posthog-dashboard`
8. Stabilize odds-sync cadence.
   - Vercel Hobby cannot run every-10-minute cron jobs, so production stays on GitHub Actions for now.
   - GitHub `Odds Sync` now runs at minutes `3,13,23,33,43,53` instead of the crowded `*/10` boundary.
   - Upgrade Vercel to Pro before launch if we want Vercel-owned high-frequency cron.

Work to wait on:

- final legal copy changes
- Stripe live activation
- paid odds plan activation
- app-store submission wording

## Success Criteria For The Business Launch

- legal-approved wording is live
- Stripe live payment works
- challenge access requires confirmed payment
- odds and settlement are fresh
- ops health is green
- Discord alerts reach staff
- first real users can buy, play, and understand the product
- support can resolve common issues
- PostHog shows the acquisition funnel
- mobile plan is ready without risking app-store rejection

## Simple Summary

The next mission is not "add more stuff." The next mission is to turn PlayFunded into a launch machine:

1. lock the legal wording
2. activate Stripe safely
3. activate odds plans
4. rehearse the full product
5. soft-launch the web app
6. measure everything
7. prepare mobile apps carefully
8. scale only after the money flow is proven
