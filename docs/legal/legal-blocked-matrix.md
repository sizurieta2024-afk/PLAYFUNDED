# Legal-Blocked Matrix

This is an internal product/compliance triage document, not legal advice.

Interpretation:
- `Safe to build now` means the team can implement or refine the product/control surface without waiting for counsel, not that launch is legally cleared.
- `Needs lawyer decision` means external counsel or processor/compliance approval is required before relying on the feature/copy in production.
- `Needs jurisdiction-specific wording` means the user-facing copy should vary by country or launch market.

| Topic | Current code/docs | Safe to build now | Needs lawyer decision | Needs jurisdiction-specific wording | Blocking surface | Owner | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Skill challenge vs gambling/betting classification | README positions PlayFunded as a paid sports-prediction challenge with real payouts; marketing copy says “not a gambling service” in [messages/en.json](../../messages/en.json); legal memos already flag classification risk in [docs/legal/market-entry-analysis-2026-03-07.md](./market-entry-analysis-2026-03-07.md) | No | Yes | Yes | README, Landing, FAQ, Legal, Checkout, PSP onboarding | Legal + Founder | This is the master blocker. Stripe/Mercado Pago/dLocal approval and country launchability all depend on it. |
| Live betting prohibition and event lock | Product now says no live betting and 5-minute pre-start lock in [README.md](../../README.md); code enforces lock in [src/lib/challenge/event-lock.ts](../../src/lib/challenge/event-lock.ts), [src/app/api/odds/events/route.ts](../../src/app/api/odds/events/route.ts), and [src/app/api/picks/route.ts](../../src/app/api/picks/route.ts) | Yes | No | Low | README, FAQ, Terms, Picks UI | Product | This is a risk-reducing rule and can be built now. Legal page and FAQ should eventually mention it explicitly. |
| Geo restrictions and launch-country allow/deny list | README still says “geo-block USA”; a dedicated blocked page exists in [src/app/[locale]/(main)/auth/geo-blocked/page.tsx](../../src/app/%5Blocale%5D/(main)/auth/geo-blocked/page.tsx); legal memo says do not launch current model in Spain/UK/Brazil/Colombia/Mexico without clearance | No | Yes | Yes | Middleware, Auth, Landing, Legal, Checkout | Legal + Engineering | Needs a real country matrix, not just a US block. |
| Self-exclusion periods and weekly deposit limits | Settings supports `30d/60d/90d/permanent` in [src/app/actions/settings.ts](../../src/app/actions/settings.ts) and [src/components/settings/SettingsClient.tsx](../../src/components/settings/SettingsClient.tsx); legal page mentions self-exclusion and weekly limits in [src/app/[locale]/(main)/legal/page.tsx](../../src/app/%5Blocale%5D/(main)/legal/page.tsx) | Yes | Yes | Yes | Settings, Legal, FAQ | Product + Legal | Controls are worth building now, but retention periods, cancellation rules, and disclosure language may vary by market. |
| KYC trigger before first payout | README and FAQ say KYC is required before first payout; payout and KYC surfaces exist in messages and admin pages; dLocal checklist flags KYC/AML work in [docs/legal/dlocal-launch-checklist.md](./dlocal-launch-checklist.md) | Yes | Yes | Yes | FAQ, Legal, Payouts, Admin KYC | Compliance + Legal | UX can ship, but what is collected, when, and how long it is retained needs formal review. |
| Payout thresholds, payout window, and payout methods | README says bank wire `$20 min`, crypto `$50 min`, monthly window; UI copy currently says minimum payout `$10` in [messages/en.json](../../messages/en.json) and [src/components/payout/PayoutsClient.tsx](../../src/components/payout/PayoutsClient.tsx) | No | Yes | Yes | README, FAQ, Payouts, Legal, Admin | Finance + Legal | There is already policy drift. Thresholds, timing, and rail availability should be normalized before launch. |
| Payment method availability by country and processor approvals | README lists Stripe, Mercado Pago, NOWPayments; checkout routes exist for all three; legal memo flags processor-policy risk, especially for Stripe and Mercado Pago | No | Yes | Yes | Checkout, Legal, Payments config, PSP onboarding | Payments + Legal | Availability should be driven by country and processor approval, not only product intent. |
| Refund / retry / non-refundable fee policy | README says “full price to retry”; legal page says entry fees are non-refundable in [src/app/[locale]/(main)/legal/page.tsx](../../src/app/%5Blocale%5D/(main)/legal/page.tsx); FAQ says retries are unlimited and each challenge requires its own fee in [messages/en.json](../../messages/en.json) | No | Yes | Yes | README, FAQ, Legal, Checkout success/cancel | Legal + Support | Consumer law, cooling-off rights, and chargeback handling will likely vary by jurisdiction. |
| Affiliate disclosures and promo restrictions | README says 5% default, 10% for top affiliates, 30-day cookies; FAQ and dashboard affiliate copy promise commissions; dLocal checklist explicitly calls out affiliate-marketing restrictions | No | Yes | Yes | Affiliate dashboard, Landing, FAQ, Terms | Legal + Growth | Needs disclosure rules, prohibited claim rules, and clawback language for fraud/refunds/chargebacks. |
| Gift vouchers / gifting paid challenges | Gift flow exists in checkout and redeem pages; FAQ and UI describe gifting; gifts are currently card-only in UI copy | Yes | Yes | Yes | Challenges, Checkout, Redeem, FAQ, Terms | Product + Legal | Product flow is safe to refine, but gift expiry, refundability, fraud, tax, and recipient-country rules need review. |
| Profit split, funded-account, and earnings claims | README and landing/FAQ copy promise “up to 80%” profit split and “real payouts”; funded account language appears across marketing and dashboard copy | No | Yes | Yes | Landing, How It Works, FAQ, Challenges, Dashboard | Legal + Growth | This is high-risk claims territory. Likely needs country-specific marketing language and substantiation rules. |
| Responsible gambling / responsible play disclaimer | Footer disclaimer says educational platform, not gambling, and payouts based on demonstrated performance in [messages/en.json](../../messages/en.json); legal page has a short responsible-gambling section | Yes | Yes | Yes | Footer, Legal, FAQ, Settings | Legal + Content | The control surfaces are fine to keep building, but disclaimer wording should be reviewed alongside model classification. |
| Privacy and payout/KYC data-sharing disclosures | Legal page has only high-level privacy text; dLocal checklist calls out payout processors, KYC documents, and retention obligations | No | Yes | Yes | Legal, Privacy, KYC, Payouts | Legal + Compliance | Current privacy copy is too thin for payout/KYC processing and third-party sharing. |

## Immediate Priorities

1. Resolve the master classification question: is the current paid-entry sports-pick product launchable at all in each target market?
2. Freeze a country launch list and payment-rail matrix based on counsel plus PSP written approval.
3. Normalize user-facing financial policy: payout minimums, payout timing, refundability, retry rules, and affiliate disclosures.
4. Expand legal/privacy copy so it matches the real product behavior before any public launch.

## Likely “Safe to Build Now” Workstreams

- Keep strengthening operational safeguards: no live betting, event locks, self-exclusion, deposit limits, KYC gating, payout audit trails.
- Keep moving hardcoded claims out of components and into localized message files so wording can be swapped per market later.
- Build configuration hooks for country-based payment availability, geo restrictions, and localized legal copy.

## Likely “Blocked Pending Counsel / Processor Approval”

- Any public assertion that the current model is outside gambling rules.
- Final launch into specific countries.
- Final PSP mix and payment-method availability.
- Final affiliate claims and promotional language.
- Final consumer terms for refunds, retries, and payout conditions.
