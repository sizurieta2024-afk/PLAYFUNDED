import { Prisma, type AffiliateCommissionRate, type PrismaClient } from "@prisma/client";

function commissionPct(rate: AffiliateCommissionRate): number {
  return rate === "ten" ? 10 : 5;
}

export interface AffiliateConversionInput {
  db: PrismaClient | Prisma.TransactionClient;
  affiliateId: string;
  code: string;
  userId: string;
  paymentId: string;
  listPriceAmount: number;
  paidAmount: number;
  discountAmount: number;
  discountPct: number;
  commissionRate: AffiliateCommissionRate;
}

export async function recordAffiliateConversion(
  input: AffiliateConversionInput,
) {
  const commissionEarned = Math.floor(
    (input.paidAmount * commissionPct(input.commissionRate)) / 100,
  );

  const run = async (
    tx: Prisma.TransactionClient | PrismaClient,
  ): Promise<{ status: "created" | "duplicate"; commissionEarned: number }> => {
    try {
      await tx.affiliateConversion.create({
        data: {
          affiliateId: input.affiliateId,
          userId: input.userId,
          paymentId: input.paymentId,
          code: input.code,
          listPriceAmount: input.listPriceAmount,
          paidAmount: input.paidAmount,
          discountAmount: input.discountAmount,
          discountPct: input.discountPct,
          commissionEarned,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        return { status: "duplicate", commissionEarned };
      }
      throw error;
    }

    await tx.affiliate.update({
      where: { id: input.affiliateId },
      data: {
        totalConversions: { increment: 1 },
        totalEarned: { increment: commissionEarned },
        pendingPayout: { increment: commissionEarned },
      },
    });

    return { status: "created", commissionEarned };
  };

  if ("$transaction" in input.db) {
    return input.db.$transaction((tx) => run(tx));
  }

  return run(input.db);
}
