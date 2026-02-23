---
title: Challenge Lifecycle
description: How a challenge moves from purchase through Phase 1, Phase 2, and into funded status.
related: [risk-rules, pick-settlement, funded-trader-rules, database-schema]
---

# Challenge Lifecycle

A challenge is the core product. A user buys a tier (see [[database-schema]] Tier model), which sets their simulated starting bankroll and the entry fee in USD cents. The challenge then moves through three phases, governed entirely by [[risk-rules]].

**Phase 1 (Evaluation):** User must grow balance by +20% of their starting bankroll while placing a minimum of 15 picks. The daily loss and overall drawdown limits apply from the first pick. Failing either limit auto-fails the challenge immediately — no grace period.

**Phase 2 (Confirmation):** Identical rules to Phase 1. The purpose is consistency: anyone can get lucky once. The starting balance for Phase 2 drawdown calculations resets to whatever balance the user had when they passed Phase 1.

**Funded Phase:** User earns their tier's profit split % (70–80%) on simulated profits, paid on a rolling 30-day cycle. Additional rules kick in — see [[funded-trader-rules]] for the 30-minute lock, streak bonuses, and rollover option.

## Key Details
- `Challenge.status` enum: `active | passed | failed | funded`
- `Challenge.phase` enum: `phase1 | phase2 | funded`
- `highestBalance` tracks the all-time peak — drawdown is calculated from this, not from starting balance
- `startBalance` resets at each phase transition for daily loss calculations
- One 48-hour pause is allowed per challenge attempt (user-triggered, not admin)
- Retry after failure costs full price — no discounts

## Gotchas
- "passed" status means Phase 1 complete, waiting to start Phase 2. "funded" means fully through Phase 2.
- If a user pauses, `pausedUntil` is set and middleware must block pick placement until that datetime
- `peakBalance` and `highestBalance` are the same field kept for semantic clarity — do not create two separate tracking columns
