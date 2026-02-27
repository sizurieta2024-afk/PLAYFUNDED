import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { prisma } from "@/lib/prisma";
import { createMpPreference } from "@/lib/mercadopago";

export async function POST(request: NextRequest) {
  const supabase = createServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json(
      { error: "Unauthorized", code: "UNAUTHORIZED" },
      { status: 401 },
    );
  }

  const body = (await request.json()) as { tierId?: string; locale?: string };
  const { tierId, locale = "es-419" } = body;

  if (!tierId) {
    return NextResponse.json(
      { error: "Missing tierId", code: "MISSING_TIER_ID" },
      { status: 400 },
    );
  }

  const [tier, user] = await Promise.all([
    prisma.tier.findUnique({ where: { id: tierId } }),
    prisma.user.findUnique({
      where: { supabaseId: session.user.id },
      select: {
        id: true,
        email: true,
        isBanned: true,
        isPermExcluded: true,
        weeklyDepositLimit: true,
      },
    }),
  ]);

  if (!tier || !tier.isActive) {
    return NextResponse.json(
      { error: "Tier not found", code: "TIER_NOT_FOUND" },
      { status: 404 },
    );
  }

  if (!user) {
    return NextResponse.json(
      { error: "User not found", code: "USER_NOT_FOUND" },
      { status: 404 },
    );
  }

  if (user.isBanned || user.isPermExcluded) {
    return NextResponse.json(
      { error: "Account restricted", code: "ACCOUNT_RESTRICTED" },
      { status: 403 },
    );
  }

  // Weekly deposit limit check
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const weeklySpend = await prisma.payment.aggregate({
    where: {
      userId: user.id,
      status: "completed",
      createdAt: { gte: weekAgo },
    },
    _sum: { amount: true },
  });

  if (
    (weeklySpend._sum.amount ?? 0) + tier.fee >
    (user.weeklyDepositLimit ?? Infinity)
  ) {
    return NextResponse.json(
      { error: "Weekly deposit limit reached", code: "DEPOSIT_LIMIT_EXCEEDED" },
      { status: 403 },
    );
  }

  try {
    const checkoutUrl = await createMpPreference({
      tierId: tier.id,
      tierName: tier.name,
      feeInCents: tier.fee,
      userId: user.id,
      userEmail: user.email,
      locale,
    });

    return NextResponse.json({ url: checkoutUrl });
  } catch (err) {
    console.error("[MP checkout]", err);
    return NextResponse.json(
      {
        error: "Failed to create Mercado Pago checkout",
        code: "MP_CHECKOUT_FAILED",
      },
      { status: 500 },
    );
  }
}
