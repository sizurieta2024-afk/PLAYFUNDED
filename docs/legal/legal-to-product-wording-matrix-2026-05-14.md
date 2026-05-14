# Legal-To-Product Wording Matrix

Date: 2026-05-14

Purpose: convert counsel-approved legal/business language into exact product copy across Spanish, English, and Portuguese before launch.

This is a working template, not legal advice. Final wording must come from counsel.

## How To Use This

1. Put counsel's approved Spanish wording in the "Approved Spanish source" column.
2. Translate the same operational meaning into English and Portuguese.
3. Map every phrase to the exact app surface where it appears.
4. Search the repo for old wording before marking a row complete.
5. Do not launch until every blocker row is approved or intentionally removed.

## Required Decisions From Counsel

| Decision | Why it matters | Current owner | Status |
|---|---|---:|---|
| Product classification | Determines whether the app can describe itself as education, challenge, evaluation, simulated trading, contest, or another category. | Legal | Pending |
| Use of "funded" language | "Funded" can imply real capital access; counsel must approve the exact meaning. | Legal/Product | Pending |
| Use of "trader" language | Could imply financial trading instead of sports-event prediction evaluation. | Legal/Product | Pending |
| Use of "profit", "P&L", and "payout" | Must distinguish simulated performance from real approved payouts. | Legal/Product | Pending |
| Country availability | Controls checkout, payout, KYC, and public claims. | Legal/Ops | Pending |
| Refund policy | Must match checkout, FAQ, support, and legal pages. | Legal/Ops | Pending |
| KYC timing and requirement | Must match payout flow and support responses. | Legal/Ops | Pending |
| App-store wording | Apple/Google may require tighter wording than web. | Legal/Product | Pending |

## Wording Matrix

| Area | Approved Spanish source | English | Portuguese | Surfaces | Risk | Status |
|---|---|---|---|---|---|---|
| One-sentence business model | Pending counsel | Pending | Pending | Landing hero, SEO description, app-store description, Stripe descriptor support text | Blocker | Pending |
| What the user pays for | Pending counsel | Pending | Pending | Pricing cards, checkout, FAQ, emails | Blocker | Pending |
| What is simulated | Pending counsel | Pending | Pending | Landing, FAQ, dashboard, challenge detail, legal pages | Blocker | Pending |
| Where real payouts come from | Pending counsel | Pending | Pending | FAQ, payout page, legal pages, lawyer explainer | Blocker | Pending |
| No user deposit language | Pending counsel | Pending | Pending | Landing, checkout, legal pages, app-store reviewer notes | Blocker | Pending |
| Payout eligibility | Pending counsel | Pending | Pending | Dashboard, payout request, FAQ, support macros | Blocker | Pending |
| KYC requirement | Pending counsel | Pending | Pending | Payout request, KYC upload, FAQ, support macros | Blocker | Pending |
| Country restrictions | Pending counsel | Pending | Pending | Checkout errors, FAQ, legal pages, support macros | Blocker | Pending |
| Refund policy | Pending counsel | Pending | Pending | Checkout disclaimer, FAQ, legal pages, emails | Blocker | Pending |
| Affiliate program | Pending counsel | Pending | Pending | `/affiliate`, `/dashboard/affiliate`, affiliate emails | High | Pending |
| Groups/social visibility | Pending counsel | Pending | Pending | Groups page, member profiles, privacy language | High | Pending |
| Mobile app description | Pending counsel | Pending | Pending | App Store Connect, Google Play Console | High | Pending |

## Terms To Search Before Launch

Run this after counsel gives final language:

```bash
rg -n "Mercado Pago|guaranteed|risk-free|free|deposit|investment|broker|betting|gambling|casino|wager|stake your own|apostar|apuesta|garantizado|gratis|dep[oó]sito|inversi[oó]n" src messages docs README.md
```

Each match must be one of:

- approved final wording
- internal-only technical reference
- removed before launch

## Surfaces To Update

| Surface | Path or owner | Notes |
|---|---|---|
| Spanish messages | `messages/es-419.json` | Source locale for launch copy. |
| English messages | `messages/en.json` | Must preserve exact operational meaning. |
| Portuguese messages | `messages/pt-BR.json` | Must preserve exact operational meaning. |
| Landing/public routes | `src/app/[locale]/(main)` | Check hero, challenges, FAQ, affiliate, auth hints. |
| Structured metadata | `src/lib/schema.ts` and page metadata helpers | Must not imply disabled providers or unsupported legal claims. |
| Checkout routes/errors | `src/app/api/checkout/*` | Error language must match country/payment rules. |
| Dashboard/challenge copy | `src/app/[locale]/(main)/dashboard` | Must separate simulated balance from real payouts. |
| Payout/KYC copy | `src/app/actions/payouts.ts`, KYC routes, dashboard pages | Must match final KYC/payout policy. |
| Emails | `src/lib/email.ts` | Verification, reset, challenge purchase, payout/support emails. |
| Support macros | Docs or admin/support notes | Needed before real users arrive. |
| App-store metadata | Future app-store docs | Must use approved wording only. |

## Launch Approval Checklist

- [ ] Counsel approved the one-sentence business model.
- [ ] Counsel approved challenge/payment/payout vocabulary.
- [ ] Counsel approved country availability rules.
- [ ] Counsel approved refund language.
- [ ] Counsel approved KYC/payout timing language.
- [ ] Spanish, English, and Portuguese were updated together.
- [ ] Search found no stale risky wording.
- [ ] Public pages were manually checked on mobile.
- [ ] Checkout/payment support text matches Stripe live setup.
- [ ] App-store wording package is ready but not submitted until web wording is stable.
