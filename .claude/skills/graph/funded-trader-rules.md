---
title: Funded Trader Rules
description: Extra rules that only apply once a challenge reaches funded status — the 30-min lock, streak bonus, payouts, and rollover.
related: [challenge-lifecycle, risk-rules, pick-settlement, payment-flow]
---

# Funded Trader Rules

Funded traders still obey all [[risk-rules]] (drawdown, stake cap, daily loss). These are additional rules layered on top.

## 30-Minute Pre-Event Lock
Funded users cannot place picks within 30 minutes of an event's scheduled start time. This window exists to enable the Phase 2 business model: copy-betting funded traders on real sportsbook accounts. Without the lock, copy-bet infrastructure cannot react in time.

- Checked in `placePick()` before any risk rule checks
- `eventStart - now() < 30 minutes` → reject with `{ error: "30-minute lock active", code: "EVENT_LOCK" }`
- Does NOT apply to challenge users (phase1 or phase2) — only `phase = funded`
- Live betting is therefore unavailable to funded users

## Profit Split & Payout Cycle
- Split percentage is set at tier level: 70% (Starter), 75% (Pro), 80% (Elite + Champion)
- Streak bonus can increase this — see below. Hard cap: 90%
- Payout available on rolling 30-day cycle from `Challenge.fundedAt`
- Admin manually approves each payout — 1-2 business days processing
- KYC required before the **first** payout only (never at signup)

## Streak Bonus
After 3 consecutive profitable funded months, the user's permanent split increases by +2%. Tracked in `Challenge.currentStreak` and `Challenge.bonusSplitPct`. The effective split is `tier.profitSplitPct + bonusSplitPct`, capped at 90.

## Rollover Option
Instead of withdrawing, a funded user can roll profits back into their bankroll. `applyRollover()` increases `Challenge.balance` by the profit amount and recalculates `highestBalance`. This expands the drawdown buffer proportionally.

## Public Pick Feed Eligibility
Funded traders can opt in to make picks visible publicly **after** placement. Picks are never shown pre-placement (prevents front-running). Copy-bet eligibility requires: ≥30 picks placed AND ≥8% ROI in funded phase.

## Gotchas
- The 30-minute lock is based on `OddsCache.startTime`, not the actual event start. Keep the odds cache fresh.
- Streak counts **calendar months**, not 30-day rolling periods. A user funded on Feb 15 who is profitable in Feb, Mar, Apr has a 3-month streak even if Feb only had 14 days.
