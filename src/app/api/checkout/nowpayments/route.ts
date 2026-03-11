import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { prisma } from "@/lib/prisma";
import { createCryptoInvoice, type CryptoCurrency } from "@/lib/nowpayments";
import { enforceRateLimit, rateLimitExceededResponse } from "@/lib/rate-limit";
import { resolveCountry } from "@/lib/country-policy";
import { getResolvedCountryPolicy } from "@/lib/country-policy-store";
import { recordOpsEvent } from "@/lib/ops-events";
import { PLATFORM_POLICY } from "@/lib/platform-policy";

const VALID_CURRENCIES: CryptoCurrency[] = ["usdttrc20", "usdcerc20", "btc"];

export async function POST(request: NextRequest) {
  const limit = enforceRateLimit(request, "api:checkout:nowpayments", {
    windowMs: 60_000,
    max: 12,
  });
  if (!limit.allowed) {
    return rateLimitExceededResponse(
      "Too many checkout attempts. Please wait and try again.",
      limit,
    );
  }

  const supabase = await createServerClient();
  const {
    data: { user: authUser },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !authUser) {
    return NextResponse.json(
      { error: "Unauthorized", code: "UNAUTHORIZED" },
      { status: 401 },
    );
  }

  const body = (await request.json()) as {
    tierId?: string;
    currency?: string;
    locale?: string;
    country?: string;
  };
  const { tierId, currency = "usdttrc20", locale = "es-419", country } = body;

  if (!tierId) {
    return NextResponse.json(
      { error: "Missing tierId", code: "MISSING_TIER_ID" },
      { status: 400 },
    );
  }

  if (!VALID_CURRENCIES.includes(currency as CryptoCurrency)) {
    return NextResponse.json(
      { error: "Invalid currency", code: "INVALID_CURRENCY" },
      { status: 400 },
    );
  }

  const [tier, user] = await Promise.all([
    prisma.tier.findUnique({ where: { id: tierId } }),
    prisma.user.findUnique({
      where: { supabaseId: authUser.id },
      select: {
        id: true,
        email: true,
        country: true,
        isBanned: true,
        isPermExcluded: true,
        selfExcludedUntil: true,
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

  if (user.selfExcludedUntil && user.selfExcludedUntil > new Date()) {
    return NextResponse.json(
      { error: "Account is self-excluded", code: "SELF_EXCLUDED" },
      { status: 403 },
    );
  }

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
    const checkoutCountry = resolveCountry(
      country,
      request.headers.get("x-vercel-ip-country"),
      request.headers.get("cf-ipcountry"),
      user.country,
    );
    const policy = await getResolvedCountryPolicy(checkoutCountry);
    if (!policy.challengePurchasesEnabled) {
      return NextResponse.json(
        {
          error: "Challenge purchases are not available in your country right now.",
          code: "COUNTRY_NOT_AVAILABLE",
        },
        { status: 403 },
      );
    }

    if (!policy.checkoutMethods.includes("crypto")) {
      return NextResponse.json(
        {
          error: "Crypto checkout is not available in your country right now.",
          code: "PAYMENT_METHOD_UNAVAILABLE",
        },
        { status: 403 },
      );
    }

    const invoice = await createCryptoInvoice({
      tierId: tier.id,
      tierName: tier.name,
      feeInCents: tier.fee,
      userId: user.id,
      userEmail: user.email,
      currency: currency as CryptoCurrency,
      locale,
    });

    // Create a pending Payment record immediately so we can track it
    await prisma.payment.create({
      data: {
        userId: user.id,
        tierId: tier.id,
        amount: tier.fee,
        currency: "USD",
        method:
          currency === "btc"
            ? "btc"
            : currency === "usdcerc20"
              ? "usdc"
              : "usdt",
        status: "pending",
        providerRef: invoice.paymentId,
        cryptoAddress: invoice.address,
        cryptoAmount: invoice.amount,
        cryptoNetwork: invoice.network,
        cryptoExpiry: invoice.expiresAt,
        metadata: {
          currency,
          network: invoice.network,
          checkoutCountry,
          policyVersion: PLATFORM_POLICY.policyVersion,
        },
      },
    });

    await recordOpsEvent({
      type: "checkout_created",
      source: "api:checkout:nowpayments",
      actorUserId: user.id,
      subjectType: "tier",
      subjectId: tier.id,
      country: checkoutCountry,
      details: {
        provider: "nowpayments",
        userId: user.id,
        tierId: tier.id,
        paymentMethod: currency,
        checkoutCountry,
      },
    });

    return NextResponse.json({
      paymentId: invoice.paymentId,
      address: invoice.address,
      amount: invoice.amount,
      currency: invoice.currency,
      network: invoice.network,
      expiresAt: invoice.expiresAt.toISOString(),
    });
  } catch (err) {
    console.error("[NOWPayments checkout]", err);
    await recordOpsEvent({
      type: "checkout_create_failed",
      level: "error",
      source: "api:checkout:nowpayments",
      actorUserId: user.id,
      subjectType: "tier",
      subjectId: tierId,
      details: {
        provider: "nowpayments",
        tierId,
        currency,
        error: err instanceof Error ? err.message : String(err),
      },
    });
    return NextResponse.json(
      {
        error: "Failed to create crypto invoice",
        code: "CRYPTO_CHECKOUT_FAILED",
      },
      { status: 500 },
    );
  }
}
