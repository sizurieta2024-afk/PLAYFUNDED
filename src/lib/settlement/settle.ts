// ============================================================
// SETTLEMENT ENGINE — pure grading logic
// No DB calls, no API calls — only pure functions.
// Called from the cron route and admin route.
// All amounts in integer cents.
// ============================================================

import type { Challenge, Pick, Tier } from "@prisma/client";
import {
  buildBalanceUpdate,
  checkPostSettlement,
  checkPhaseComplete,
  buildPhaseAdvance,
} from "@/lib/challenge";
import {
  gradePick,
  gradeMoneyline,
  gradeSpread,
  gradeTotal,
  type GameScores,
  type SettleStatus,
  type SettlementResult,
} from "../proof/settlement-rules";

export {
  gradePick,
  gradeMoneyline,
  gradeSpread,
  gradeTotal,
};
export type { GameScores, SettleStatus, SettlementResult };

// ── Post-settlement challenge update ─────────────────────────────────────────
// Computes the full challenge update after a pick is graded.
// Returns the Prisma data objects (no DB writes here).
export function buildPostSettlementUpdate(
  pick: Pick,
  challenge: Challenge,
  tier: Tier,
  settledPickCount: number, // non-pending picks AFTER this one settles
): {
  balanceUpdate: {
    balance: number;
    highestBalance: number;
    peakBalance: number;
  };
  autoFail: boolean;
  phaseAdvance: boolean;
  challengeUpdate: Record<string, unknown>;
} {
  // 1. Compute new balance
  const balanceUpdate = buildBalanceUpdate(challenge, pick);

  // 2. Build a temporary challenge object reflecting the new balance for checks
  const updatedChallenge: Challenge = {
    ...challenge,
    balance: balanceUpdate.balance,
    highestBalance: balanceUpdate.highestBalance,
    peakBalance: balanceUpdate.peakBalance,
  };

  // 3. Risk checks (drawdown + daily loss) on updated balance
  const violation = checkPostSettlement(updatedChallenge);
  if (violation) {
    return {
      balanceUpdate,
      autoFail: true,
      phaseAdvance: false,
      challengeUpdate: {
        ...balanceUpdate,
        status: "failed",
        failedAt: new Date(),
      },
    };
  }

  // 4. Phase completion check
  const phaseComplete = checkPhaseComplete(
    updatedChallenge,
    tier,
    settledPickCount,
  );

  if (phaseComplete) {
    const phaseAdvanceData = buildPhaseAdvance(
      updatedChallenge,
      tier.fundedBankroll,
    );
    return {
      balanceUpdate,
      autoFail: false,
      phaseAdvance: true,
      challengeUpdate: {
        ...balanceUpdate,
        ...phaseAdvanceData,
      },
    };
  }

  return {
    balanceUpdate,
    autoFail: false,
    phaseAdvance: false,
    challengeUpdate: balanceUpdate,
  };
}
