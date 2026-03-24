import { Prisma, type PayoutMethod, type PrismaClient } from "@prisma/client";
import { evaluatePayoutRequest } from "../proof/payout-rules";
import { validateCryptoDestination } from "./crypto-address";

export interface CreatePayoutRequestInput {
  db: PrismaClient;
  userId: string;
  challengeId: string;
  method: PayoutMethod;
  requestedProfitAmount: number;
  destinationAddress?: string | null;
  payoutsEnabled: boolean;
  methodAllowed: boolean;
  kycApproved: boolean;
  windowOpen: boolean;
  minimumPayoutCents: number;
}

export type CreatePayoutRequestResult =
  | {
      ok: false;
      error: string;
      code: string;
    }
  | {
      ok: true;
      payoutId: string;
      payoutAmount: number;
      grossProfit: number;
      newBalance: number;
    };

export async function createPayoutRequest(
  input: CreatePayoutRequestInput,
): Promise<CreatePayoutRequestResult> {
  const destinationCheck = validateCryptoDestination(
    input.method,
    input.destinationAddress,
  );
  if (!destinationCheck.ok) {
    return {
      ok: false,
      error: destinationCheck.error,
      code: "INVALID_DESTINATION",
    };
  }

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await input.db.$transaction(
        async (tx) => {
          const challenge = await tx.challenge.findFirst({
            where: {
              id: input.challengeId,
              userId: input.userId,
              status: "funded",
            },
            include: { tier: true },
          });

          const existing = await tx.payout.findFirst({
            where: {
              challengeId: input.challengeId,
              userId: input.userId,
              status: "pending",
              isRollover: false,
            },
          });

          const decision = evaluatePayoutRequest({
            payoutsEnabled: input.payoutsEnabled,
            methodAllowed: input.methodAllowed,
            kycApproved: input.kycApproved,
            windowOpen: input.windowOpen,
            minimumPayoutCents: input.minimumPayoutCents,
            requestedProfitAmount: input.requestedProfitAmount,
            hasPendingPayout: !!existing,
            challenge: challenge
              ? {
                  balance: challenge.balance,
                  startBalance: challenge.startBalance,
                  profitSplitPct: challenge.tier.profitSplitPct,
                }
              : null,
          });

          if (!decision.ok) {
            return decision;
          }
          if (!challenge) {
            return {
              ok: false,
              error: "challenge_not_found",
              code: "NOT_FOUND",
            };
          }

          const payout = await tx.payout.create({
            data: {
              userId: input.userId,
              challengeId: input.challengeId,
              amount: decision.payoutAmount,
              splitPct: challenge.tier.profitSplitPct,
              method: input.method,
              status: "pending",
              destinationAddress: destinationCheck.normalized || null,
              isRollover: false,
              providerData: {
                requestedProfitAmount: input.requestedProfitAmount,
                grossProfit: decision.grossProfit,
                priorBalance: challenge.balance,
                newBalance: decision.newBalance,
                destinationAddress: destinationCheck.normalized || null,
              },
            },
            select: { id: true },
          });

          await tx.challenge.update({
            where: { id: input.challengeId },
            data: { balance: decision.newBalance },
          });

          return {
            ok: true,
            payoutId: payout.id,
            payoutAmount: decision.payoutAmount,
            grossProfit: decision.grossProfit,
            newBalance: decision.newBalance,
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
        if (attempt < 2) {
          continue;
        }
        return {
          ok: false,
          error: "payout_retry_required",
          code: "RETRYABLE_CONFLICT",
        };
      }
      throw error;
    }
  }

  return {
    ok: false,
    error: "payout_retry_required",
    code: "RETRYABLE_CONFLICT",
  };
}
