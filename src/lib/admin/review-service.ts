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

export async function reviewPayoutByAdmin(
  input: ReviewPayoutInput,
): Promise<ReviewedPayout | null> {
  return input.db.$transaction(
    async (tx) => {
      const now = new Date();
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
