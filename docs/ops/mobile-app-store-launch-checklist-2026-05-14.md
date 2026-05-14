# Mobile App Store Launch Checklist

Date: 2026-05-14

Purpose: prepare PlayFunded for App Store and Google Play without rushing into avoidable review, payment, or policy problems.

Mobile app launch should happen after web legal/payment wording is stable.

## Recommended First Mobile Strategy

Start with a conservative mobile MVP:

- dashboard
- challenge progress
- groups/friends progress
- profile/settings
- support/help
- affiliate apply/status if already allowed

Avoid putting risky payment/payout flows into the first submission until counsel confirms the store strategy.

## Store-Policy Risk Areas

Apple and Google may scrutinize:

- real-money payouts
- challenge entry fees
- sports-event prediction language
- "funded" and "trader" wording
- simulated balances
- external checkout links
- country restrictions
- KYC/payout timing
- gambling-like or investment-like language

Official references:

- Apple App Store Connect workflow: `https://developer.apple.com/help/app-store-connect/get-started/app-store-connect-workflow/`
- Apple TestFlight: `https://developer.apple.com/testflight`
- Google Play releases: `https://play.google.com/console/about/releasesoverview`
- Google Play real-money gambling, games, and contests policy: `https://support.google.com/googleplay/android-developer/answer/9877032/`

## Required Business Decisions

| Decision | Recommended default | Owner | Status |
|---|---|---|---|
| App type | Mobile companion to the web product | Product/Legal | Pending |
| Payment flow | Decide with counsel before implementation | Legal/Product | Pending |
| Payout visibility | Show status carefully, avoid broad claims | Legal/Product | Pending |
| Countries | Match web availability rules | Legal/Ops | Pending |
| App language | Spanish first, English and Portuguese if polished | Product | Pending |
| Mobile tech | Capacitor wrapper first, native rebuild later only if justified | Engineering | Pending |

## Apple App Store Checklist

| Item | Notes | Status |
|---|---|---|
| Apple Developer Program | Required for distribution | Pending |
| App Store Connect app record | Name, SKU, bundle ID | Pending |
| Bundle identifier | Reserve stable ID | Pending |
| App icon | Final production icon, multiple sizes | Pending |
| Screenshots | iPhone sizes, localized if launching all locales | Pending |
| App description | Counsel-approved wording only | Pending |
| Keywords | Avoid risky betting/gambling/investment claims | Pending |
| Support URL | Public support page or email route | Pending |
| Privacy policy URL | Final legal page | Pending |
| App privacy questionnaire | Must match data collection reality | Pending |
| Reviewer account | Demo credentials with safe test data | Pending |
| Reviewer notes | Explain simulated balance and business model clearly | Pending |
| TestFlight internal test | Before external or App Review | Pending |
| External beta | Optional, useful before App Review | Pending |
| App Review submission | Only after web launch is stable | Pending |

## Google Play Checklist

| Item | Notes | Status |
|---|---|---|
| Google Play Console account | Required for publishing | Pending |
| App record | Name, package, category, contact details | Pending |
| Android App Bundle | `.aab` build | Pending |
| App signing | Configure Play App Signing | Pending |
| Store listing | Counsel-approved wording only | Pending |
| Graphics | icon, feature graphic, screenshots | Pending |
| Data Safety form | Must match data collection reality | Pending |
| App content declarations | Ads, financial features, real-money policy questions | Pending |
| Target countries | Match legal-approved launch countries | Pending |
| Internal testing | First device/tester pass | Pending |
| Closed testing | Prepare if Google account requires it | Pending |
| Production release | Only after testing and policy review | Pending |

## Technical Build Options

### Option A: Capacitor Web Shell

Best for first app-store probe.

Pros:

- fastest path
- reuses existing Next/Supabase backend
- one source of truth for product logic
- lower cost

Cons:

- less native feel
- store reviewers may dislike web-wrapper-only apps if value is unclear
- deep links/auth need care

### Option B: React Native / Expo MVP

Best if the app needs a stronger native experience.

Pros:

- better native UX
- easier push notifications later
- cleaner app-store story

Cons:

- more engineering work
- more duplicated UI
- more room for auth/payment mismatch

### Recommendation

Start with Option A unless app-store/legal review makes a native shell necessary. Build native only after web launch proves paid demand.

## Required Mobile QA

- install fresh app
- login with email/password
- login with Google if supported
- password reset deep link
- email verification deep link
- dashboard load
- challenge progress load
- groups create/join/read
- member profile privacy behavior
- affiliate apply/status
- logout
- bad network handling
- expired session handling
- Spanish/English/Portuguese language behavior

## Reviewer Notes Package

Prepare a one-page plain-English explanation:

- PlayFunded does not take user deposits for trading.
- Users pay an entry fee for a challenge/evaluation experience.
- Challenge balances are simulated.
- Real payouts, if available, come from PlayFunded's own operating funds and are subject to rules, KYC, and country availability.
- Test reviewer account has simulated/test data.
- Payment/payout flows may be disabled or limited by country.

Counsel must approve this before submission.

## Go / No-Go

Go only if:

- legal wording is locked
- web app has completed a soft launch
- store metadata matches the live product
- reviewer notes are clear
- demo account works
- privacy/data forms are accurate

No-go if:

- legal wording is still changing
- Stripe/payment strategy is uncertain
- app implies unsupported payouts or payment methods
- mobile auth/deep links are flaky
- screenshots show stale or risky wording
