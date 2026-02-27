// ============================================================
// ROLLOVER — funded trader reinvests profits instead of withdrawing
// Resets the balance baseline so the next period starts fresh.
// ============================================================

import type { Challenge, Tier } from "@prisma/client";
import { calcTraderPayout } from "./streak";

// Profit = current balance minus the funded-phase start balance.
export function calcFundedProfit(challenge: Challenge): number {
  return Math.max(0, challenge.balance - challenge.startBalance);
}

// The trader's share of profits (cents) — amount they would receive on payout.
export function calcRolloverAmount(challenge: Challenge, tier: Tier): number {
  const profit = calcFundedProfit(challenge);
  if (profit <= 0) return 0;
  return calcTraderPayout(profit, tier.profitSplitPct, challenge.bonusSplitPct);
}

// Returns Prisma update data when a funded trader opts to roll over.
// The current balance becomes the new start baseline; drawdown resets.
export function buildRollover(challenge: Challenge): {
  startBalance: number;
  dailyStartBalance: number;
  highestBalance: number;
  peakBalance: number;
} {
  return {
    startBalance: challenge.balance,
    dailyStartBalance: challenge.balance,
    highestBalance: challenge.balance,
    peakBalance: challenge.balance,
  };
}
