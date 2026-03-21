import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { resolveAffiliateDiscountCode } from "@/lib/affiliate/codes";

const bodySchema = z.object({
  tierId: z.string().uuid(),
  code: z.string().min(2).max(32),
});

export async function POST(request: NextRequest) {
  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch {
    return NextResponse.json(
      { error: "Invalid request body", code: "INVALID_BODY" },
      { status: 400 },
    );
  }

  const tier = await prisma.tier.findUnique({
    where: { id: body.tierId },
    select: { fee: true, isActive: true },
  });
  if (!tier || !tier.isActive) {
    return NextResponse.json(
      { error: "Tier not found", code: "TIER_NOT_FOUND" },
      { status: 404 },
    );
  }

  const discount = await resolveAffiliateDiscountCode(prisma, tier.fee, body.code);
  if (!discount) {
    return NextResponse.json(
      { error: "Discount code is invalid or inactive.", code: "INVALID_DISCOUNT_CODE" },
      { status: 404 },
    );
  }

  return NextResponse.json({
    code: discount.affiliate.code,
    discountPct: discount.affiliate.discountPct,
    discountAmount: discount.discountAmount,
    discountedAmount: discount.discountedAmount,
    listPriceAmount: discount.listPriceAmount,
  });
}
