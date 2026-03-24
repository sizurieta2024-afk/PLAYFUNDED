// ============================================================
// PARLAY SETTLEMENT — grades all legs, drops void/push legs,
// recalculates payout on remaining legs.
// All amounts in integer cents.
// ============================================================

import { Prisma, type PrismaClient } from "@prisma/client";
import {
  buildPostSettlementUpdate,
  gradePick,
  type SettleStatus,
} from "./settle";
import type { GameResult } from "../odds/scores";

export type SettleParlayResult =
  | {
      ok: true;
      pick: { id: string; status: string; actualPayout: number };
      challenge: {
        id: string;
        balance: number;
        status: string;
        phase: string;
        startBalance: number;
        peakBalance: number;
        dailyStartBalance: number;
      };
      autoFail: boolean;
      phaseAdvance: boolean;
      priorPhase: string;
      tierName: string;
      fundedBankroll: number;
      profitSplitPct: number;
      minPicks: number;
      userEmail: string;
      userName: string | null;
    }
  | {
      ok: false;
      status: number;
      code: string;
      error: string;
    };

function failure(
  status: number,
  code: string,
  error: string,
): SettleParlayResult {
  return { ok: false, status, code, error };
}

// Pure function: grade all legs given scores, return parlay outcome.
// void/push legs are dropped and remaining legs are recalculated.
export function gradeParlayLegs(
  legs: Array<{
    id: string;
    event: string;
    marketType: string;
    selection: string;
    odds: number;
    linePoint: number | null;
  }>,
  stake: number,
  scoresByEventId: Map<string, GameResult>,
): {
  parlayStatus: SettleStatus | "incomplete";
  adjustedPayout: number;
  legStatuses: Record<string, SettleStatus>;
} {
  const legStatuses: Record<string, SettleStatus> = {};
  const winningOdds: number[] = [];
  let hasLost = false;
  let allResolved = true;

  for (const leg of legs) {
    const gameResult = scoresByEventId.get(leg.event);
    if (!gameResult) {
      allResolved = false;
      continue;
    }

    const settlement = gradePick(
      {
        marketType: leg.marketType,
        selection: leg.selection,
        linePoint: leg.linePoint,
        stake,
        potentialPayout: Math.round(stake * leg.odds),
      },
      {
        homeTeam: gameResult.homeTeam,
        awayTeam: gameResult.awayTeam,
        homeScore: gameResult.homeScore,
        awayScore: gameResult.awayScore,
      },
    );

    const legStatus = settlement.status as SettleStatus;
    legStatuses[leg.id] = legStatus;

    if (legStatus === "lost") {
      hasLost = true;
    } else if (legStatus === "won") {
      winningOdds.push(leg.odds);
    }
    // void and push legs are dropped (not counted in winningOdds)
  }

  if (!allResolved) {
    return {
      parlayStatus: "incomplete",
      adjustedPayout: 0,
      legStatuses,
    };
  }

  if (hasLost) {
    return { parlayStatus: "lost", adjustedPayout: 0, legStatuses };
  }

  if (winningOdds.length === 0) {
    // All legs were void or push — return stake
    return { parlayStatus: "push", adjustedPayout: stake, legStatuses };
  }

  const adjustedOdds = winningOdds.reduce((product, o) => product * o, 1);
  const adjustedPayout = Math.round(stake * adjustedOdds);

  return { parlayStatus: "won", adjustedPayout, legStatuses };
}

export async function settlePendingParlay(
  db: PrismaClient,
  input: {
    pickId: string;
    settledAt: Date;
    scoresByEventId: Map<string, GameResult>;
  },
): Promise<SettleParlayResult> {
  return db.$transaction(
    async (tx) => {
      const pick = await tx.pick.findUnique({
        where: { id: input.pickId },
        include: {
          parlayLegs: true,
          challenge: {
            include: {
              tier: true,
              user: { select: { email: true, name: true } },
            },
          },
        },
      });

      if (!pick) return failure(404, "PICK_NOT_FOUND", "Pick not found");
      if (pick.status !== "pending" || pick.settledAt) {
        return failure(400, "ALREADY_SETTLED", "Pick is already settled");
      }

      const { parlayStatus, adjustedPayout, legStatuses } = gradeParlayLegs(
        pick.parlayLegs.map((leg) => ({
          id: leg.id,
          event: leg.event,
          marketType: leg.marketType,
          selection: leg.selection,
          odds: leg.odds,
          linePoint: leg.linePoint ?? null,
        })),
        pick.stake,
        input.scoresByEventId,
      );

      if (parlayStatus === "incomplete") {
        return failure(
          400,
          "PARLAY_INCOMPLETE",
          "Not all parlay legs have scores yet",
        );
      }

      // Update each leg status
      for (const [legId, legStatus] of Object.entries(legStatuses)) {
        await tx.parlayLeg.update({
          where: { id: legId },
          data: { status: legStatus },
        });
      }

      const actualPayout =
        parlayStatus === "won"
          ? adjustedPayout
          : parlayStatus === "push"
            ? pick.stake
            : 0;

      const settledCount = await tx.pick.count({
        where: {
          challengeId: pick.challenge.id,
          status: { in: ["won", "lost", "push"] },
        },
      });
      const settledPickCount =
        parlayStatus === "void" ? settledCount : settledCount + 1;

      // Build a synthetic settled pick for balance/phase computation
      const settledPick = {
        ...pick,
        status: parlayStatus as SettleStatus,
        actualPayout,
        potentialPayout: adjustedPayout,
      };

      const { challengeUpdate, autoFail, phaseAdvance } =
        buildPostSettlementUpdate(
          settledPick,
          pick.challenge,
          pick.challenge.tier,
          settledPickCount,
        );

      const challengeWrite = await tx.challenge.updateMany({
        where: {
          id: pick.challenge.id,
          updatedAt: pick.challenge.updatedAt,
        },
        data: challengeUpdate,
      });
      if (challengeWrite.count !== 1) {
        return failure(
          409,
          "CHALLENGE_CONFLICT",
          "Challenge changed during settlement. Retry.",
        );
      }

      const pickWrite = await tx.pick.updateMany({
        where: { id: input.pickId, status: "pending", settledAt: null },
        data: {
          status: parlayStatus as SettleStatus,
          actualPayout,
          potentialPayout: adjustedPayout,
          settledAt: input.settledAt,
        },
      });
      if (pickWrite.count !== 1) {
        return failure(
          409,
          "PICK_CONFLICT",
          "Pick changed during settlement. Retry.",
        );
      }

      const updatedPick = await tx.pick.findUnique({
        where: { id: input.pickId },
        select: { id: true, status: true, actualPayout: true },
      });
      const updatedChallenge = await tx.challenge.findUnique({
        where: { id: pick.challenge.id },
        select: {
          id: true,
          balance: true,
          status: true,
          phase: true,
          startBalance: true,
          peakBalance: true,
          dailyStartBalance: true,
        },
      });

      if (!updatedPick || !updatedChallenge) {
        return failure(
          500,
          "SETTLEMENT_READBACK_FAILED",
          "Failed to read back settled parlay",
        );
      }

      return {
        ok: true,
        pick: updatedPick,
        challenge: updatedChallenge,
        autoFail,
        phaseAdvance,
        priorPhase: pick.challenge.phase,
        tierName: pick.challenge.tier.name,
        fundedBankroll: pick.challenge.tier.fundedBankroll,
        profitSplitPct: pick.challenge.tier.profitSplitPct,
        minPicks: pick.challenge.tier.minPicks,
        userEmail: pick.challenge.user.email,
        userName: pick.challenge.user.name,
      };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}
