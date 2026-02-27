// ============================================================
// PHASES — phase advancement and profit targets
// Phase 1: +20% from phase1StartBalance, min 15 picks
// Phase 2: +10% from phase2StartBalance, min 15 picks
// Funded: no profit target — drawdown rules apply
// All amounts in integer cents. Use Math.floor for percentage math.
// ============================================================

import type { Challenge, Tier } from "@prisma/client";

// Returns the balance the user must reach to pass the current phase.
// Returns Infinity for funded (no upper target).
export function getProfitTarget(challenge: Challenge): number {
  switch (challenge.phase) {
    case "phase1": {
      const base = challenge.phase1StartBalance ?? challenge.startBalance;
      return base + Math.floor((base * 20) / 100);
    }
    case "phase2": {
      const base = challenge.phase2StartBalance ?? challenge.startBalance;
      return base + Math.floor((base * 10) / 100);
    }
    case "funded":
      return Infinity;
    default:
      return Infinity;
  }
}

// Returns true if the current phase requirements are met.
// settledPickCount = number of settled (non-pending) picks for this challenge.
export function checkPhaseComplete(
  challenge: Challenge,
  tier: Tier,
  settledPickCount: number,
): boolean {
  if (challenge.phase === "funded") return false;
  if (settledPickCount < tier.minPicks) return false;
  const target = getProfitTarget(challenge);
  return challenge.balance >= target;
}

// Builds the Prisma update payload to advance to the next phase.
// Phase 1 → Phase 2: drawdown and daily loss limits reset to new balance.
// Phase 2 → Funded: marks challenge as funded.
export function buildPhaseAdvance(challenge: Challenge): {
  phase: "phase2" | "funded";
  status: "active" | "funded";
  startBalance: number;
  phase2StartBalance?: number;
  dailyStartBalance: number;
  highestBalance: number;
  peakBalance: number;
  completedAt?: Date;
  fundedAt?: Date;
} {
  if (challenge.phase === "phase1") {
    return {
      phase: "phase2",
      status: "active",
      startBalance: challenge.balance, // Phase 2 daily loss uses this as fixed base
      phase2StartBalance: challenge.balance,
      dailyStartBalance: challenge.balance,
      highestBalance: challenge.balance, // drawdown resets from new phase peak
      peakBalance: challenge.balance,
    };
  }

  // phase2 → funded
  return {
    phase: "funded",
    status: "funded",
    startBalance: challenge.balance,
    dailyStartBalance: challenge.balance,
    highestBalance: challenge.balance,
    peakBalance: challenge.balance,
    completedAt: new Date(),
    fundedAt: new Date(),
  };
}
