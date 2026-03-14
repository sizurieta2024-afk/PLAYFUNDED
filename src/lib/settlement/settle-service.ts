import { Prisma, type PrismaClient } from "@prisma/client";
import { buildPostSettlementUpdate, type SettleStatus } from "./settle";

export type SettlePendingPickResult =
  | {
      ok: true;
      pick: {
        id: string;
        status: string;
        actualPayout: number;
      };
      challenge: {
        id: string;
        balance: number;
        status: string;
        phase: string;
      };
      autoFail: boolean;
      phaseAdvance: boolean;
      priorPhase: string;
      tierName: string;
      fundedBankroll: number;
      profitSplitPct: number;
      userEmail: string;
      userName: string | null;
    }
  | {
      ok: false;
      status: number;
      code: string;
      error: string;
    };

function failure(status: number, code: string, error: string): SettlePendingPickResult {
  return { ok: false, status, code, error };
}

export async function settlePendingPick(
  db: PrismaClient,
  input: {
    pickId: string;
    status: SettleStatus;
    settledAt: Date;
  },
): Promise<SettlePendingPickResult> {
  return db.$transaction(async (tx) => {
    const pick = await tx.pick.findUnique({
      where: { id: input.pickId },
      include: {
        challenge: {
          include: {
            tier: true,
            user: { select: { email: true, name: true } },
          },
        },
      },
    });

    if (!pick) {
      return failure(404, "PICK_NOT_FOUND", "Pick not found");
    }

    if (pick.status !== "pending" || pick.settledAt) {
      return failure(400, "ALREADY_SETTLED", "Pick is already settled");
    }

    const actualPayout = input.status === "won" ? pick.potentialPayout : 0;
    const settledCount = await tx.pick.count({
      where: {
        challengeId: pick.challenge.id,
        status: { in: ["won", "lost", "push"] },
      },
    });

    const settledPickCount =
      input.status === "void" ? settledCount : settledCount + 1;

    const settledPick = {
      ...pick,
      status: input.status,
      actualPayout,
    };

    const { challengeUpdate, autoFail, phaseAdvance } = buildPostSettlementUpdate(
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
        "Pick changed during settlement. Retry the action.",
      );
    }

    const pickWrite = await tx.pick.updateMany({
      where: {
        id: input.pickId,
        status: "pending",
        settledAt: null,
      },
      data: {
        status: input.status,
        actualPayout,
        settledAt: input.settledAt,
      },
    });
    if (pickWrite.count !== 1) {
      return failure(
        409,
        "PICK_CONFLICT",
        "Pick changed during settlement. Retry the action.",
      );
    }

    const updatedPick = await tx.pick.findUnique({
      where: { id: input.pickId },
      select: { id: true, status: true, actualPayout: true },
    });
    const updatedChallenge = await tx.challenge.findUnique({
      where: { id: pick.challenge.id },
      select: { id: true, balance: true, status: true, phase: true },
    });

    if (!updatedPick || !updatedChallenge) {
      return failure(
        500,
        "SETTLEMENT_READBACK_FAILED",
        "Failed to settle pick",
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
      userEmail: pick.challenge.user.email,
      userName: pick.challenge.user.name,
    };
  }, {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  });
}
