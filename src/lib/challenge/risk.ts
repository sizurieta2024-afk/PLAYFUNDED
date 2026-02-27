// ============================================================
// RISK RULES — the three financial guardrails
// All math uses integer cents. NO floats, NO *, use Math.floor.
// These are called after every pick settles (see settlement engine).
// ============================================================

import type { Challenge } from "@prisma/client";

export interface RiskViolation {
  rule: "drawdown" | "daily_loss" | "stake_cap";
  code: "DRAWDOWN_BREACH" | "DAILY_LOSS_BREACH" | "STAKE_CAP_EXCEEDED";
  error: string;
}

// ── 1. Overall Drawdown ──────────────────────────────────────
// Fail if: balance < highestBalance * 0.85
// Use integer math to avoid float precision errors.
export function checkDrawdown(challenge: Challenge): RiskViolation | null {
  const floor = Math.floor((challenge.highestBalance * 85) / 100);
  if (challenge.balance < floor) {
    return {
      rule: "drawdown",
      code: "DRAWDOWN_BREACH",
      error: `Balance dropped more than 15% from peak ($${(challenge.highestBalance / 100).toFixed(2)})`,
    };
  }
  return null;
}

// ── 2. Daily Loss ────────────────────────────────────────────
// Daily limit = 10% of PHASE start balance (fixed — does not change as balance grows)
// Fail if: (dailyStartBalance - balance) > startBalance * 0.10
// i.e.  if: balance < dailyStartBalance - (startBalance * 10 / 100)
export function checkDailyLoss(challenge: Challenge): RiskViolation | null {
  const dailyLimit = Math.floor((challenge.startBalance * 10) / 100);
  const floor = challenge.dailyStartBalance - dailyLimit;
  if (challenge.balance < floor) {
    return {
      rule: "daily_loss",
      code: "DAILY_LOSS_BREACH",
      error: `Daily loss limit reached (max $${(dailyLimit / 100).toFixed(2)}/day)`,
    };
  }
  return null;
}

// ── 3. Stake Cap ─────────────────────────────────────────────
// Max stake = 5% of CURRENT balance (shrinks as user loses)
export function checkStakeCap(
  challenge: Challenge,
  proposedStakeCents: number,
): RiskViolation | null {
  const maxStake = Math.floor((challenge.balance * 5) / 100);
  if (proposedStakeCents > maxStake) {
    return {
      rule: "stake_cap",
      code: "STAKE_CAP_EXCEEDED",
      error: `Stake exceeds 5% limit. Max allowed: $${(maxStake / 100).toFixed(2)}`,
    };
  }
  return null;
}

// Convenience: run all post-settlement checks (drawdown + daily loss)
// Returns the first violation found, or null if all clear.
export function checkPostSettlement(challenge: Challenge): RiskViolation | null {
  return checkDrawdown(challenge) ?? checkDailyLoss(challenge);
}
