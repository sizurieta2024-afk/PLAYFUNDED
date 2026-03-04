import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { prisma } from "@/lib/prisma";
import { createCheckoutSession } from "@/lib/stripe";
import { enforceRateLimit, rateLimitExceededResponse } from "@/lib/rate-limit";
import { z } from "zod";

const bodySchema = z.object({
  tierId: z.string().uuid(),
  locale: z.string().min(2).max(10),
  isGift: z.boolean().optional(),
  giftRecipientEmail: z.string().email().optional(),
  country: z.string().length(2).optional(), // ISO 3166-1 alpha-2 country code
});

export async function POST(req: NextRequest) {
  const limit = enforceRateLimit(req, "api:checkout:stripe", {
    windowMs: 60_000,
    max: 12,
  });
  if (!limit.allowed) {
    return rateLimitExceededResponse(
      "Too many checkout attempts. Please wait and try again.",
      limit,
    );
  }

  // Auth required — must be logged in to purchase
  const supabase = createServerClient();
  const {
    data: { user: authUser },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !authUser) {
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

  const { tierId, locale, isGift, giftRecipientEmail, country } = body;
  const headerCountry =
    req.headers.get("x-vercel-ip-country") ??
    req.headers.get("cf-ipcountry") ??
    undefined;

  const tier = await prisma.tier.findUnique({ where: { id: tierId } });
  if (!tier || !tier.isActive) {
    return NextResponse.json(
      { error: "Tier not found or inactive", code: "TIER_NOT_FOUND" },
      { status: 404 },
    );
  }

  const user = await prisma.user.findUnique({
    where: { supabaseId: authUser.id },
    select: {
      id: true,
      email: true,
      country: true,
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
    const checkoutCountry = (
      country ??
      headerCountry ??
      user.country ??
      ""
    ).toUpperCase();
    const checkoutUrl = await createCheckoutSession({
      tierId: tier.id,
      tierName: tier.name,
      feeInCents: tier.fee,
      userId: user.id,
      userEmail: user.email,
      locale,
      isGift,
      giftRecipientEmail,
      enablePix: checkoutCountry === "BR",
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
