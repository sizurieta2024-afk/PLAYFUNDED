import { Prisma, type PrismaClient } from "@prisma/client";

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

export type ReviewPayoutResult =
  | {
      ok: true;
      payout: ReviewedPayout;
    }
  | {
      ok: false;
      code: "NOT_FOUND_OR_NOT_PENDING" | "RETRYABLE_CONFLICT";
    };

export async function reviewPayoutByAdmin(
  input: ReviewPayoutInput,
): Promise<ReviewPayoutResult> {
  try {
    const payout = await input.db.$transaction(
      async (tx) => {
        const now = new Date();
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

        if (input.action === "reject" && existing.challengeId) {
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
            status: input.action === "approve" ? "paid" : "failed",
            txRef: input.txRef ?? null,
            adminNote: input.adminNote ?? null,
            approvedAt: input.action === "approve" ? now : null,
            paidAt: input.action === "approve" ? now : null,
          },
        });
        if (updated.count !== 1) {
          return null;
        }

        await tx.auditLog.create({
          data: {
            adminId: input.adminId,
            action: input.action === "approve" ? "approve_payout" : "reject_payout",
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
