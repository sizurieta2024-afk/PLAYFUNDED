import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { prisma } from "@/lib/prisma";
import { createCheckoutSession } from "@/lib/stripe";
import { z } from "zod";

const bodySchema = z.object({
  tierId: z.string().uuid(),
  locale: z.string().min(2).max(10),
  isGift: z.boolean().optional(),
  giftRecipientEmail: z.string().email().optional(),
});

export async function POST(req: NextRequest) {
  // Auth required — must be logged in to purchase
  const supabase = createServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json(
      { error: "Unauthorized", code: "AUTH_REQUIRED" },
      { status: 401 },
    );
  }

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json(
      { error: "Invalid request body", code: "INVALID_BODY" },
      { status: 400 },
    );
  }

  const { tierId, locale, isGift, giftRecipientEmail } = body;

  const tier = await prisma.tier.findUnique({ where: { id: tierId } });
  if (!tier || !tier.isActive) {
    return NextResponse.json(
      { error: "Tier not found or inactive", code: "TIER_NOT_FOUND" },
      { status: 404 },
    );
  }

  const user = await prisma.user.findUnique({
    where: { supabaseId: session.user.id },
    select: {
      id: true,
      email: true,
      selfExcludedUntil: true,
      isPermExcluded: true,
      weeklyDepositLimit: true,
    },
  });

  if (!user) {
    return NextResponse.json(
      { error: "User not found", code: "USER_NOT_FOUND" },
      { status: 404 },
    );
  }

  if (user.isPermExcluded) {
    return NextResponse.json(
      { error: "Account permanently excluded", code: "PERM_EXCLUDED" },
      { status: 403 },
    );
  }

  if (user.selfExcludedUntil && user.selfExcludedUntil > new Date()) {
    return NextResponse.json(
      { error: "Account is self-excluded", code: "SELF_EXCLUDED" },
      { status: 403 },
    );
  }

  if (user.weeklyDepositLimit !== null) {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weeklySpend = await prisma.payment.aggregate({
      where: {
        userId: user.id,
        status: "completed",
        createdAt: { gte: weekAgo },
      },
      _sum: { amount: true },
    });
    if ((weeklySpend._sum.amount ?? 0) + tier.fee > user.weeklyDepositLimit) {
      return NextResponse.json(
        { error: "Weekly deposit limit exceeded", code: "DEPOSIT_LIMIT" },
        { status: 403 },
      );
    }
  }

  try {
    const checkoutUrl = await createCheckoutSession({
      tierId: tier.id,
      tierName: tier.name,
      feeInCents: tier.fee,
      userId: user.id,
      userEmail: user.email,
      locale,
      isGift,
      giftRecipientEmail,
    });
    return NextResponse.json({ url: checkoutUrl });
  } catch (err) {
    console.error("[checkout/stripe] error:", err);
    return NextResponse.json(
      { error: "Failed to create checkout session", code: "STRIPE_ERROR" },
      { status: 500 },
    );
  }
}
