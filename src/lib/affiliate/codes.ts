import type { Affiliate, PrismaClient } from "@prisma/client";

export interface ResolvedAffiliateCode {
  affiliate: Pick<
    Affiliate,
    | "id"
    | "code"
    | "discountPct"
    | "commissionRate"
    | "isActive"
    | "userId"
  >;
  listPriceAmount: number;
  discountAmount: number;
  discountedAmount: number;
}

export function normalizeAffiliateCode(code?: string | null): string | null {
  if (!code) return null;
  const normalized = code.trim().toUpperCase();
  return normalized || null;
}

export function calculateDiscountAmount(
  listPriceAmount: number,
  discountPct: number,
): { discountAmount: number; discountedAmount: number } {
  const safePct = Math.max(0, Math.min(100, Math.floor(discountPct)));
  const discountAmount = Math.floor((listPriceAmount * safePct) / 100);
  const discountedAmount = Math.max(0, listPriceAmount - discountAmount);
  return { discountAmount, discountedAmount };
}

export async function resolveAffiliateDiscountCode(
  db: PrismaClient,
  listPriceAmount: number,
  rawCode?: string | null,
): Promise<ResolvedAffiliateCode | null> {
  const code = normalizeAffiliateCode(rawCode);
  if (!code) return null;

  const affiliate = await db.affiliate.findUnique({
    where: { code },
    select: {
      id: true,
      code: true,
      discountPct: true,
      commissionRate: true,
      isActive: true,
      userId: true,
    },
  });

  if (!affiliate || !affiliate.isActive) {
    return null;
  }

  const { discountAmount, discountedAmount } = calculateDiscountAmount(
    listPriceAmount,
    affiliate.discountPct,
  );

  return {
    affiliate,
    listPriceAmount,
    discountAmount,
    discountedAmount,
  };
}

