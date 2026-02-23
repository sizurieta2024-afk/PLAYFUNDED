---
title: Pick & Settlement Engine
description: How picks are placed (with risk validation), and how they are graded when events settle.
related: [risk-rules, challenge-lifecycle, odds-feed, funded-trader-rules, database-schema]
---

# Pick & Settlement Engine

Pick placement and settlement are two separate flows. Placement is synchronous (user-initiated). Settlement is async (cron-driven, polls [[odds-feed]] for results).

## Pick Placement

The server action `src/app/actions/picks.ts → placePick()` is the single entry point. It runs every [[risk-rules]] check before inserting anything:

1. Verify challenge is `active` and not paused
2. Check 30-minute pre-event lock if challenge is in `funded` phase — see [[funded-trader-rules]]
3. Check stake cap (5% of current balance)
4. Check daily loss headroom — reject if this pick's potential loss would breach 10%
5. Check overall drawdown headroom
6. Insert Pick with status `pending`
7. Update `Challenge.balance` by subtracting stake (stake is locked out of balance immediately)

For parlays: all legs are inserted as `ParlayLeg` records linked to a single `Pick`. The entire parlay stake counts as one bet for the 5% cap.

## Pick Settlement (Cron)

`src/app/api/settle/route.ts` runs on a schedule. For each pending pick past its event start time:

1. Fetch result from odds provider via [[odds-feed]] interface
2. Grade: `won` → add `potentialPayout` to balance | `lost` → nothing (stake already deducted) | `void/push` → return stake
3. Update `Challenge.balance` and `highestBalance` if new balance is higher
4. Run drawdown check — auto-fail if 15% breached
5. Run phase completion check — advance phase if balance ≥ startBalance × 1.20 and picks ≥ 15

## Key Details
- `Pick.stake` is in integer cents — see [[money-convention]]
- `Pick.odds` is a **float** (decimal odds like 2.50) — this is the one field that is not cents
- `potentialPayout = Math.round(stake * odds)` — round to nearest cent
- Parlay payout: multiply all leg odds together first, then `Math.round(stake * combinedOdds)`
- Void picks: stake returned, pick does NOT count toward the 15-pick minimum

## Gotchas
- Balance is debited at placement time (stake locked). On loss, nothing changes at settlement. On win, `potentialPayout` is added (which includes the original stake already).
- Never deduct stake at settlement — it was already deducted at placement.
- Settlement must be idempotent — if the cron runs twice, the same pick must not settle twice. Check `status = pending` before processing.
