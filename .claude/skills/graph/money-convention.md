---
title: Money Convention
description: Integer cents everywhere, never floats. The single most important data convention in a real-money platform.
related: [risk-rules, pick-settlement, payment-flow, database-schema]
---

# Money Convention

Every monetary amount in the database and in server-side logic is stored and calculated as **integer cents** (USD). No floats. This is non-negotiable because floating-point arithmetic produces errors that compound — on a real-money platform, `0.1 + 0.2 = 0.30000000000000004` is unacceptable.

## The Rule
- `$20` → stored as `2000`
- `$1,000` → stored as `100000`
- `$0.50` → stored as `50`

Prisma schema: all monetary fields use `Int`. If you see a monetary field typed as `Float` or `Decimal`, that is a bug.

## Arithmetic Pattern
Use integer math and divide only for display:
```typescript
// Correct
const maxStake = Math.floor(challenge.balance * 5 / 100)

// Wrong — floating point error risk
const maxStake = Math.floor(challenge.balance * 0.05)

// Display only (cents to dollars string)
const display = (cents / 100).toFixed(2)  // "$20.00"
```

For drawdown thresholds, always use integer math:
```typescript
// 15% drawdown check
const failThreshold = Math.floor(challenge.highestBalance * 85 / 100)
if (challenge.balance < failThreshold) autoFail()
```

## The One Exception
`Pick.odds` is a `Float` — decimal odds like `2.50`. This is intentional: odds are not a monetary amount, they are a multiplier. Payout calculation converts back to cents immediately:
```typescript
const potentialPayout = Math.round(pick.stake * pick.odds)  // cents × multiplier → cents
```

## Display to User
Prices display as `$20 USD (~$340 MXN)`. The local currency equivalent uses exchange rates from `src/lib/exchangerates.ts`. Exchange rates themselves are floats — that's fine because they are display-only and never stored as financial amounts.

## Gotchas
- Parlay payout: multiply all decimal odds together first, then `Math.round(stake * combinedOdds)`. Rounding happens once at the end, not leg by leg.
- Affiliate commission: `Math.floor(paymentAmount * commissionRate / 100)` — floor, not round, so the platform never overpays.
- Payout amounts are always the exact integer stored in `Payout.amount` — no re-calculation at approval time.
