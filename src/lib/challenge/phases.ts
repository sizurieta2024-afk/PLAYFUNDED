// ============================================================
// PHASES — phase advancement and profit targets
// Phase 1: +20% from phase1StartBalance, min 15 picks
// Phase 2: +20% from phase2StartBalance (reset to fundedBankroll), min 15 picks
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
      return base + Math.floor((base * 20) / 100);
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
// Phase 1 → Phase 2: balance resets to fundedBankroll; drawdown/daily limits reset.
// Phase 2 → Funded: balance resets to fundedBankroll; marks challenge as funded.
export function buildPhaseAdvance(
  challenge: Challenge,
  fundedBankroll: number,
): {
  phase: "phase2" | "funded";
  status: "active" | "funded";
  balance: number;
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
      balance: fundedBankroll,
      startBalance: fundedBankroll,
      phase2StartBalance: fundedBankroll,
      dailyStartBalance: fundedBankroll,
      highestBalance: fundedBankroll,
      peakBalance: fundedBankroll,
    };
  }

  // phase2 → funded
  return {
    phase: "funded",
    status: "funded",
    balance: fundedBankroll,
    startBalance: fundedBankroll,
    dailyStartBalance: fundedBankroll,
    highestBalance: fundedBankroll,
    peakBalance: fundedBankroll,
    completedAt: new Date(),
    fundedAt: new Date(),
  };
}
