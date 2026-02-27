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

export type SettleStatus = "won" | "lost" | "void" | "push";

export interface SettlementResult {
  status: SettleStatus;
  actualPayout: number; // integer cents
}

export interface GameScores {
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
}

// ── Moneyline grading ─────────────────────────────────────────────────────────
// selection = team name that was picked
export function gradeMoneyline(
  selection: string,
  scores: GameScores,
): SettleStatus {
  const { homeTeam, awayTeam, homeScore, awayScore } = scores;

  // Determine winner
  if (homeScore === awayScore) return "push"; // tie

  const winner = homeScore > awayScore ? homeTeam : awayTeam;
  return selection === winner ? "won" : "lost";
}

// ── Spread grading ────────────────────────────────────────────────────────────
// selection = team name, linePoint = their spread (e.g. -3.5 means give 3.5)
// Win condition: selectionMargin + linePoint > 0
export function gradeSpread(
  selection: string,
  linePoint: number,
  scores: GameScores,
): SettleStatus {
  const { homeTeam, homeScore, awayScore } = scores;

  const selectionScore =
    selection === homeTeam ? homeScore : awayScore;
  const opponentScore =
    selection === homeTeam ? awayScore : homeScore;

  const margin = selectionScore - opponentScore + linePoint;

  if (margin > 0) return "won";
  if (margin < 0) return "lost";
  return "push"; // exact cover = push
}

// ── Total (Over/Under) grading ────────────────────────────────────────────────
// selection = "Over" | "Under", linePoint = total line
export function gradeTotal(
  selection: string,
  linePoint: number,
  scores: GameScores,
): SettleStatus {
  const total = scores.homeScore + scores.awayScore;

  if (selection === "Over") {
    if (total > linePoint) return "won";
    if (total < linePoint) return "lost";
    return "push";
  }

  if (selection === "Under") {
    if (total < linePoint) return "won";
    if (total > linePoint) return "lost";
    return "push";
  }

  return "void"; // unknown selection
}

// ── Grade a single pick against a score result ────────────────────────────────
export function gradePick(
  pick: { marketType: string; selection: string; linePoint: number | null; stake: number; potentialPayout: number },
  scores: GameScores,
): SettlementResult {
  let status: SettleStatus;

  if (pick.marketType === "moneyline") {
    status = gradeMoneyline(pick.selection, scores);
  } else if (pick.marketType === "spread") {
    if (pick.linePoint === null) {
      status = "void"; // can't grade without line
    } else {
      status = gradeSpread(pick.selection, pick.linePoint, scores);
    }
  } else if (pick.marketType === "total") {
    if (pick.linePoint === null) {
      status = "void";
    } else {
      status = gradeTotal(pick.selection, pick.linePoint, scores);
    }
  } else {
    status = "void"; // unknown market type
  }

  const actualPayout =
    status === "won"
      ? pick.potentialPayout
      : status === "void" || status === "push"
        ? 0 // stake is returned via balance delta, not stored in actualPayout
        : 0;

  return { status, actualPayout };
}

// ── Post-settlement challenge update ─────────────────────────────────────────
// Computes the full challenge update after a pick is graded.
// Returns the Prisma data objects (no DB writes here).
export function buildPostSettlementUpdate(
  pick: Pick,
  challenge: Challenge,
  tier: Tier,
  settledPickCount: number, // non-pending picks AFTER this one settles
): {
  balanceUpdate: { balance: number; highestBalance: number; peakBalance: number };
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
    const phaseAdvanceData = buildPhaseAdvance(updatedChallenge);
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
