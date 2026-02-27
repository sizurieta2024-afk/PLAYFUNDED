// ============================================================
// STREAK — funded trader monthly profit streak
// Each consecutive profitable month adds BONUS_PER_MONTH % to split.
// Total split is hard-capped at MAX_TOTAL_SPLIT_PCT.
// ============================================================

import type { Challenge, Tier } from "@prisma/client";

const BONUS_PER_MONTH = 5; // +5% per consecutive profitable month
const MAX_TOTAL_SPLIT_PCT = 90; // hard cap regardless of streak

// Returns the effective total split % for a funded trader.
// baseSplitPct comes from tier.profitSplitPct.
export function calcEffectiveSplit(
  baseSplitPct: number,
  currentStreak: number,
): number {
  const bonus = currentStreak * BONUS_PER_MONTH;
  return Math.min(baseSplitPct + bonus, MAX_TOTAL_SPLIT_PCT);
}

// Returns Prisma update data after a profitable month on the funded phase.
export function buildStreakIncrement(
  challenge: Challenge,
  tier: Tier,
): { currentStreak: number; bonusSplitPct: number } {
  const newStreak = challenge.currentStreak + 1;
  const totalSplit = calcEffectiveSplit(tier.profitSplitPct, newStreak);
  return {
    currentStreak: newStreak,
    bonusSplitPct: totalSplit - tier.profitSplitPct, // only the bonus portion
  };
}

// Returns Prisma update data after a losing month (streak resets to 0).
export function buildStreakReset(): { currentStreak: number; bonusSplitPct: number } {
  return { currentStreak: 0, bonusSplitPct: 0 };
}

// Returns the trader's share in cents for a given profit amount.
export function calcTraderPayout(
  profitCents: number,
  baseSplitPct: number,
  bonusSplitPct: number,
): number {
  const totalSplit = Math.min(baseSplitPct + bonusSplitPct, MAX_TOTAL_SPLIT_PCT);
  return Math.floor((profitCents * totalSplit) / 100);
}
