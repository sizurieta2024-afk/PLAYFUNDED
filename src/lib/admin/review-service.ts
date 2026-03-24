import { Prisma, type PrismaClient, type PayoutMethod } from "@prisma/client";
import {
  executeNowPaymentsCryptoPayout,
  mapNowPaymentsPayoutStatus,
} from "../payouts/nowpayments-mass";

export type ReviewedPayout = Prisma.PayoutGetPayload<{
  include: {
    user: {
      select: {
        email: true;
        name: true;
      };
    };
  };
}>;

export type ReviewedKycSubmission = Prisma.KycSubmissionGetPayload<{
  include: {
    user: {
      select: {
        email: true;
        name: true;
      };
    };
  };
}>;

export interface ReviewPayoutInput {
  db: PrismaClient;
  adminId: string;
  payoutId: string;
  action: "approve" | "reject";
  txRef?: string;
  adminNote?: string;
}

export interface ReviewKycInput {
  db: PrismaClient;
  adminId: string;
  submissionId: string;
  action: "approve" | "reject";
  reviewNote?: string;
}

export interface ExecuteCryptoPayoutInput {
  payoutId: string;
  method: PayoutMethod;
  amount: number;
  destinationAddress: string;
}

export interface ExecuteCryptoPayoutResult {
  providerPayoutId: string;
  providerStatus: string;
  txRef: string | null;
  providerData: Prisma.JsonObject;
}

export type ReviewPayoutResult =
  | {
      ok: true;
      payout: ReviewedPayout;
    }
  | {
      ok: false;
      code:
        | "NOT_FOUND_OR_NOT_PENDING"
        | "RETRYABLE_CONFLICT"
        | "CRYPTO_DESTINATION_REQUIRED"
        | "PROVIDER_ERROR";
      error?: string;
    };

async function defaultExecuteCryptoPayout(
  input: ExecuteCryptoPayoutInput,
): Promise<ExecuteCryptoPayoutResult> {
  if (input.method !== "btc" && input.method !== "usdt" && input.method !== "usdc") {
    throw new Error(`Unsupported crypto payout method: ${input.method}`);
  }

  const provider = await executeNowPaymentsCryptoPayout({
    address: input.destinationAddress,
    currency: input.method,
    amountCents: input.amount,
  });

  return {
    providerPayoutId: provider.payoutId,
    providerStatus: provider.status,
    txRef: provider.hash,
    providerData: {
      provider: "nowpayments",
      payoutId: provider.payoutId,
      payoutStatus: provider.status,
      raw: provider.raw as Prisma.JsonValue,
    },
  };
}

function isCryptoMethod(method: PayoutMethod) {
  return method === "btc" || method === "usdt" || method === "usdc";
}

function mergeProviderData(
  current: Prisma.JsonValue | null,
  next: Prisma.JsonObject,
): Prisma.InputJsonValue {
  return {
    ...(current && typeof current === "object" && !Array.isArray(current)
      ? current
      : {}),
    ...next,
  };
}

export async function reviewPayoutByAdmin(
  input: ReviewPayoutInput,
  deps: {
    executeCryptoPayout?: (
      input: ExecuteCryptoPayoutInput,
    ) => Promise<ExecuteCryptoPayoutResult>;
  } = {},
): Promise<ReviewPayoutResult> {
  try {
    if (input.action === "reject") {
      const payout = await input.db.$transaction(
        async (tx) => {
          const existing = await tx.payout.findUnique({
            where: { id: input.payoutId },
            select: {
              id: true,
              status: true,
              challengeId: true,
              providerData: true,
            },
          });
          if (!existing || existing.status !== "pending") {
            return null;
          }

          if (existing.challengeId) {
            const requestedProfitAmount = extractRequestedProfitAmount(existing.providerData);
            if (requestedProfitAmount !== null) {
              await tx.challenge.update({
                where: { id: existing.challengeId },
                data: { balance: { increment: requestedProfitAmount } },
              });
            }
          }

          const updated = await tx.payout.updateMany({
            where: {
              id: input.payoutId,
              status: "pending",
            },
            data: {
              status: "failed",
              txRef: input.txRef ?? null,
              adminNote: input.adminNote ?? null,
              approvedAt: null,
              paidAt: null,
            },
          });
          if (updated.count !== 1) {
            return null;
          }

          await tx.auditLog.create({
            data: {
              adminId: input.adminId,
              action: "reject_payout",
              targetType: "payout",
              targetId: input.payoutId,
              note: input.adminNote ?? input.txRef,
            },
          });

          return tx.payout.findUnique({
            where: { id: input.payoutId },
            include: {
              user: {
                select: {
                  email: true,
                  name: true,
                },
              },
            },
          });
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        },
      );

      if (!payout) {
        return { ok: false, code: "NOT_FOUND_OR_NOT_PENDING" };
      }

      return { ok: true, payout };
    }

    const now = new Date();
    const executeCryptoPayout =
      deps.executeCryptoPayout ?? defaultExecuteCryptoPayout;

    const reserved = await input.db.$transaction(
      async (tx) => {
        const existing = await tx.payout.findUnique({
          where: { id: input.payoutId },
          select: {
            id: true,
            status: true,
            method: true,
            amount: true,
            destinationAddress: true,
            providerData: true,
          },
        });
        if (!existing || existing.status !== "pending") {
          return null;
        }

        if (isCryptoMethod(existing.method) && !existing.destinationAddress) {
          return "missing_destination" as const;
        }

        const nextStatus = isCryptoMethod(existing.method) ? "processing" : "paid";
        const updated = await tx.payout.updateMany({
          where: {
            id: input.payoutId,
            status: "pending",
          },
          data: {
            status: nextStatus,
            adminNote: input.adminNote ?? null,
            approvedAt: now,
            paidAt: nextStatus === "paid" ? now : null,
            txRef: !isCryptoMethod(existing.method) ? (input.txRef ?? null) : null,
          },
        });
        if (updated.count !== 1) {
          return null;
        }

        if (!isCryptoMethod(existing.method)) {
          await tx.auditLog.create({
            data: {
              adminId: input.adminId,
              action: "approve_payout",
              targetType: "payout",
              targetId: input.payoutId,
              note: input.adminNote ?? input.txRef,
            },
          });
        }

        return existing;
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );

    if (reserved === "missing_destination") {
      return {
        ok: false,
        code: "CRYPTO_DESTINATION_REQUIRED",
        error: "Crypto payout destination is missing.",
      };
    }

    if (!reserved) {
      return { ok: false, code: "NOT_FOUND_OR_NOT_PENDING" };
    }

    if (isCryptoMethod(reserved.method)) {
      try {
        const provider = await executeCryptoPayout({
          payoutId: reserved.id,
          method: reserved.method,
          amount: reserved.amount,
          destinationAddress: reserved.destinationAddress!,
        });
        const mappedStatus = mapNowPaymentsPayoutStatus(provider.providerStatus);
        const payout = await input.db.payout.update({
          where: { id: input.payoutId },
          data: {
            status: mappedStatus,
            providerPayoutId: provider.providerPayoutId,
            txRef: provider.txRef,
            paidAt: mappedStatus === "paid" ? new Date() : null,
            providerData: mergeProviderData(reserved.providerData, provider.providerData),
          },
          include: {
            user: {
              select: {
                email: true,
                name: true,
              },
            },
          },
        });
        await input.db.auditLog.create({
          data: {
            adminId: input.adminId,
            action: "approve_payout",
            targetType: "payout",
            targetId: input.payoutId,
            note: input.adminNote ?? provider.txRef ?? provider.providerPayoutId,
          },
        });
        return { ok: true, payout };
      } catch (error) {
        await input.db.payout.update({
          where: { id: input.payoutId },
          data: {
            status: "pending",
            approvedAt: null,
            paidAt: null,
            providerPayoutId: null,
            txRef: null,
            adminNote:
              input.adminNote ??
              (error instanceof Error ? error.message.slice(0, 500) : "Provider error"),
          },
        });
        return {
          ok: false,
          code: "PROVIDER_ERROR",
          error: error instanceof Error ? error.message : "Provider error",
        };
      }
    }

    const payout = await input.db.payout.findUnique({
      where: { id: input.payoutId },
      include: {
        user: {
          select: {
            email: true,
            name: true,
          },
        },
      },
    });

    if (!payout) {
      return { ok: false, code: "NOT_FOUND_OR_NOT_PENDING" };
    }

    return { ok: true, payout };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2034"
    ) {
      return { ok: false, code: "RETRYABLE_CONFLICT" };
    }
    throw error;
  }
}

function extractRequestedProfitAmount(providerData: Prisma.JsonValue | null): number | null {
  if (!providerData || typeof providerData !== "object" || Array.isArray(providerData)) {
    return null;
  }

  const requested = (providerData as Prisma.JsonObject).requestedProfitAmount;
  return typeof requested === "number" && Number.isInteger(requested)
    ? requested
    : null;
}

export async function reviewKycByAdmin(
  input: ReviewKycInput,
): Promise<ReviewedKycSubmission | null> {
  return input.db.$transaction(
    async (tx) => {
      const now = new Date();
      const updated = await tx.kycSubmission.updateMany({
        where: {
          id: input.submissionId,
          status: "pending",
        },
        data: {
          status: input.action === "approve" ? "approved" : "rejected",
          reviewedAt: now,
          reviewNote: input.reviewNote ?? null,
        },
      });
      if (updated.count !== 1) {
        return null;
      }

      await tx.auditLog.create({
        data: {
          adminId: input.adminId,
          action: input.action === "approve" ? "approve_kyc" : "reject_kyc",
          targetType: "kyc",
          targetId: input.submissionId,
          note: input.reviewNote,
        },
      });

      return tx.kycSubmission.findUnique({
        where: { id: input.submissionId },
        include: {
          user: {
            select: {
              email: true,
              name: true,
            },
          },
        },
      });
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    },
  );
}
