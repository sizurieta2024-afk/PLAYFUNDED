---
title: Risk Rules
description: The three financial guardrails enforced on every pick — drawdown, stake cap, daily loss. These handle real money. Get them exactly right.
related: [challenge-lifecycle, pick-settlement, money-convention, known-gotchas]
---

# Risk Rules

These three rules apply to every phase including funded. They are enforced **server-side** on the pick placement action — the UI also shows them, but the server is the source of truth. See [[pick-settlement]] for where enforcement happens in code.

## 1. Overall Drawdown — 15% from peak
Auto-fails the challenge immediately if `currentBalance < highestBalance * 0.85`. There is no grace period, no override, no warning before failure. The check runs after every pick settles.

- Uses `Challenge.highestBalance`, not starting balance
- `highestBalance` updates upward whenever balance increases — never downward
- On auto-fail: set `status = failed`, `failedAt = now()`

## 2. Daily Loss — 10% of starting balance for that phase
Limits how much can be lost in a single UTC day. Resets at exactly 00:00 UTC — not the user's local timezone.

- Tracked as: `dailyStartBalance` (balance at the start of the current UTC day)
- Fail condition: `currentBalance < dailyStartBalance * 0.90`
- Reset via Vercel Cron at 00:00 UTC — updates `dailyStartBalance = currentBalance` for all active challenges

## 3. Stake Cap — 5% of current balance
Maximum stake per individual bet, or total stake across all legs of a parlay.

- Uses **current** balance, not starting balance — this shrinks as the user loses
- Example: balance = $800, max stake = $40 (not $50 if starting was $1,000)
- Enforced: stake > balance * 0.05 → reject pick with error `{ error: "Stake exceeds 5% limit", code: "STAKE_CAP_EXCEEDED" }`

## Key Details
- All calculations use integer cents — see [[money-convention]] for why floats are forbidden
- Error format for all rejections: `{ error: string, code: string }`
- The 30-minute pre-event lock for funded users is separate from these rules — see [[funded-trader-rules]]

## Gotchas
- Daily loss is 10% of the **phase starting balance**, not the current balance. A user who grows to $1,200 from $1,000 can still only lose $100/day (10% of $1,000), not $120.
- Drawdown is from the **all-time highest balance**. If user peaks at $1,400 then drops to $1,189, that's exactly 15% from peak — auto-fail triggers.
- Do not use JavaScript `0.85 * balance` — use `Math.floor(balance * 85 / 100)` to avoid float precision errors
