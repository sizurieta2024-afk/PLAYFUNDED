import { Prisma, type Pick, type PrismaClient } from "@prisma/client";
import { PLATFORM_POLICY } from "../platform-policy";
import {
  checkMinStake as baseCheckMinStake,
  checkStakeCap as baseCheckStakeCap,
} from "../proof/risk-rules";

export interface ParlayLegInput {
  sport: string;
  league: string;
  event: string;
  eventName?: string | null;
  marketType: string;
  selection: string;
  odds: number;
  linePoint?: number | null;
  eventStart: Date;
}

export interface PlaceParlayRequestInput {
  db: PrismaClient;
  challengeId: string;
  userId: string;
  legs: ParlayLegInput[];
  stake: number;
}

export type PlaceParlayRequestResult =
  | { ok: true; pick: Pick; newBalance: number }
  | { ok: false; status: number; code: string; error: string };

function failure(
  status: number,
  code: string,
  error: string,
): PlaceParlayRequestResult {
  return { ok: false, status, code, error };
}

export async function placeParlayRequest(
  input: PlaceParlayRequestInput,
): Promise<PlaceParlayRequestResult> {
  const { legs, stake } = input;

  if (legs.length < 2 || legs.length > 4) {
    return failure(
      400,
      "PARLAY_INVALID_LEG_COUNT",
      "Parlay must have 2–4 legs",
    );
  }

  // All event IDs must be distinct (no same-game parlays)
  const eventIds = legs.map((l) => l.event);
  if (new Set(eventIds).size !== eventIds.length) {
    return failure(
      400,
      "PARLAY_SAME_GAME",
      "Same-game parlays are not allowed",
    );
  }

  // Combined odds = product of all leg odds; payout = stake × combinedOdds
  const combinedOdds = legs.reduce((product, leg) => product * leg.odds, 1);
  const potentialPayout = Math.round(stake * combinedOdds);

  // Use the latest eventStart as the Pick's eventStart
  // (the parlay can only be settled after all events have started)
  const latestStart = legs.reduce(
    (latest, leg) => (leg.eventStart > latest ? leg.eventStart : latest),
    legs[0].eventStart,
  );

  try {
    return await input.db.$transaction(
      async (tx) => {
        const freshChallenge = await tx.challenge.findFirst({
          where: { id: input.challengeId, userId: input.userId },
        });

        if (!freshChallenge) {
          return failure(404, "CHALLENGE_NOT_FOUND", "Challenge not found");
        }

        if (
          freshChallenge.status !== "active" &&
          freshChallenge.status !== "funded"
        ) {
          return failure(
            400,
            "CHALLENGE_NOT_ACTIVE",
            "Challenge is not active",
          );
        }

        if (
          freshChallenge.pausedUntil &&
          new Date() < freshChallenge.pausedUntil
        ) {
          return failure(
            400,
            "CHALLENGE_PAUSED",
            "Challenge is currently paused",
          );
        }

        if (stake > freshChallenge.balance) {
          return failure(
            422,
            "INSUFFICIENT_BALANCE",
            "Insufficient balance for this pick",
          );
        }

        const stakeViolation = baseCheckStakeCap(
          freshChallenge,
          stake,
          PLATFORM_POLICY.risk,
        );
        if (stakeViolation) {
          return failure(400, stakeViolation.code, stakeViolation.error);
        }

        const minStakeViolation = baseCheckMinStake(
          freshChallenge,
          stake,
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
          data: { balance: { decrement: stake } },
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
            sport: legs[0].sport,
            league: legs[0].league,
            event: legs[0].event,
            eventName: `Parlay (${legs.length} legs)`,
            marketType: "parlay",
            selection: `Parlay (${legs.length} legs)`,
            odds: combinedOdds,
            linePoint: null,
            stake,
            potentialPayout,
            eventStart: latestStart,
            isParlay: true,
            parlayLegs: {
              create: legs.map((leg) => ({
                sport: leg.sport,
                league: leg.league,
                event: leg.event,
                eventName: leg.eventName ?? null,
                marketType: leg.marketType,
                selection: leg.selection,
                odds: leg.odds,
                linePoint: leg.linePoint ?? null,
              })),
            },
          },
        });

        return {
          ok: true,
          pick,
          newBalance: freshChallenge.balance - stake,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
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
