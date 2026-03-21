import { prisma } from "../prisma";
import { recordAffiliateConversion } from "./conversions";
import { normalizeAffiliateCode } from "./codes";

async function resolveAffiliateForPurchase(userId: string, code?: string | null) {
  const normalizedCode = normalizeAffiliateCode(code);
  if (normalizedCode) {
    const affiliate = await prisma.affiliate.findUnique({
      where: { code: normalizedCode },
      select: {
        id: true,
        code: true,
        commissionRate: true,
        isActive: true,
        userId: true,
      },
    });
    if (affiliate && affiliate.isActive && affiliate.userId !== userId) {
      return affiliate;
    }
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { referredByCode: true },
  });
  if (!user?.referredByCode) {
    return null;
  }

  const affiliate = await prisma.affiliate.findUnique({
    where: { code: user.referredByCode },
    select: {
      id: true,
      code: true,
      commissionRate: true,
      isActive: true,
      userId: true,
    },
  });
  if (!affiliate || !affiliate.isActive || affiliate.userId === userId) {
    return null;
  }
  return affiliate;
}

export async function attributeAffiliatePurchase(input: {
  userId: string;
  paymentId: string;
  paidAmount: number;
  listPriceAmount: number;
  discountAmount: number;
  discountPct: number;
  code?: string | null;
}) {
  const affiliate = await resolveAffiliateForPurchase(input.userId, input.code);
  if (!affiliate) return { status: "skipped" as const };

  const result = await recordAffiliateConversion({
    db: prisma,
    affiliateId: affiliate.id,
    code: affiliate.code,
    userId: input.userId,
    paymentId: input.paymentId,
    listPriceAmount: input.listPriceAmount,
    paidAmount: input.paidAmount,
    discountAmount: input.discountAmount,
    discountPct: input.discountPct,
    commissionRate: affiliate.commissionRate,
  });

  return { ...result, affiliateCode: affiliate.code };
}
