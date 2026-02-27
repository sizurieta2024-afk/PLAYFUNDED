// ============================================================
// BALANCE — apply pick results and maintain highestBalance
// All amounts in integer cents.
// ============================================================

import type { Challenge, Pick } from "@prisma/client";

// Apply a settled pick result to a challenge's balance.
// Returns the balance delta (positive = profit, negative = loss, 0 = void/push).
export function calcBalanceDelta(pick: Pick): number {
  switch (pick.status) {
    case "won":
      // Net gain = actualPayout - stake (stake was already deducted when pick was placed)
      return pick.actualPayout - pick.stake;
    case "lost":
      // Stake already deducted — no further change needed at settlement
      return 0;
    case "void":
    case "push":
      // Return stake to balance
      return pick.stake;
    default:
      return 0;
  }
}

// Recalculate highestBalance after a balance update.
// highestBalance only moves upward — never downward.
export function recalcHighestBalance(
  currentHighest: number,
  newBalance: number,
): number {
  return Math.max(currentHighest, newBalance);
}

// Full balance update object for Prisma after pick settlement.
export function buildBalanceUpdate(
  challenge: Challenge,
  pick: Pick,
): { balance: number; highestBalance: number; peakBalance: number } {
  const delta = calcBalanceDelta(pick);
  const newBalance = challenge.balance + delta;
  const newHighest = recalcHighestBalance(challenge.highestBalance, newBalance);

  return {
    balance: newBalance,
    highestBalance: newHighest,
    peakBalance: newHighest,
  };
}
