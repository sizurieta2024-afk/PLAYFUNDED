import { Prisma, type Pick, type PrismaClient } from "@prisma/client";
import { PLATFORM_POLICY } from "../platform-policy";
import {
  checkMinStake as baseCheckMinStake,
  checkStakeCap as baseCheckStakeCap,
} from "../proof/risk-rules";

export interface PlacePickRequestInput {
  db: PrismaClient;
  challengeId: string;
  userId: string;
  sport: string;
  league: string;
  event: string;
  eventName?: string | null;
  marketType: string;
  selection: string;
  odds: number;
  linePoint?: number | null;
  stake: number;
  potentialPayout: number;
  eventStart: Date;
}

export type PlacePickRequestResult =
  | {
      ok: true;
      pick: Pick;
      newBalance: number;
    }
  | {
      ok: false;
      status: number;
      code: string;
      error: string;
    };

function failure(status: number, code: string, error: string): PlacePickRequestResult {
  return { ok: false, status, code, error };
}

export async function placePickRequest(
  input: PlacePickRequestInput,
): Promise<PlacePickRequestResult> {
  try {
    return await input.db.$transaction(
      async (tx) => {
        const freshChallenge = await tx.challenge.findFirst({
          where: { id: input.challengeId, userId: input.userId },
        });

        if (!freshChallenge) {
          return failure(404, "CHALLENGE_NOT_FOUND", "Challenge not found");
        }

        if (freshChallenge.status !== "active" && freshChallenge.status !== "funded") {
          return failure(400, "CHALLENGE_NOT_ACTIVE", "Challenge is not active");
        }

        if (freshChallenge.pausedUntil && new Date() < freshChallenge.pausedUntil) {
          return failure(400, "CHALLENGE_PAUSED", "Challenge is currently paused");
        }

        if (input.stake > freshChallenge.balance) {
          return failure(
            422,
            "INSUFFICIENT_BALANCE",
            "Insufficient balance for this pick",
          );
        }

        const stakeViolation = baseCheckStakeCap(
          freshChallenge,
          input.stake,
          PLATFORM_POLICY.risk,
        );
        if (stakeViolation) {
          return failure(400, stakeViolation.code, stakeViolation.error);
        }

        const minStakeViolation = baseCheckMinStake(
          freshChallenge,
          input.stake,
          PLATFORM_POLICY.risk,
        );
        if (minStakeViolation) {
          return failure(422, minStakeViolation.code, minStakeViolation.error);
        }

        const updated = await tx.challenge.updateMany({
          where: {
            id: input.challengeId,
            userId: input.userId,
            balance: freshChallenge.balance,
          },
          data: { balance: { decrement: input.stake } },
        });

        if (updated.count !== 1) {
          return failure(
            409,
            "CHALLENGE_BALANCE_CHANGED",
            "Balance changed while placing the pick. Try again.",
          );
        }

        const pick = await tx.pick.create({
          data: {
            challengeId: input.challengeId,
            userId: input.userId,
            sport: input.sport,
            league: input.league,
            event: input.event,
            eventName: input.eventName ?? null,
            marketType: input.marketType,
            selection: input.selection,
            odds: input.odds,
            linePoint: input.linePoint ?? null,
            stake: input.stake,
            potentialPayout: input.potentialPayout,
            eventStart: input.eventStart,
          },
        });

        return {
          ok: true,
          pick,
          newBalance: freshChallenge.balance - input.stake,
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2034"
    ) {
      return failure(
        409,
        "CHALLENGE_BALANCE_CHANGED",
        "Balance changed while placing the pick. Try again.",
      );
    }
    throw error;
  }
}
