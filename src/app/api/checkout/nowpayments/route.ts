import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { prisma } from "@/lib/prisma";
import { createCryptoInvoice, type CryptoCurrency } from "@/lib/nowpayments";
import { enforceRateLimit, rateLimitExceededResponse } from "@/lib/rate-limit";
import { resolveCountry } from "@/lib/country-policy";
import { getResolvedCountryPolicy } from "@/lib/country-policy-store";
import { recordOpsEvent } from "@/lib/ops-events";
import { PLATFORM_POLICY } from "@/lib/platform-policy";
import { resolveAffiliateDiscountCode } from "@/lib/affiliate/codes";

const VALID_CURRENCIES: CryptoCurrency[] = ["usdttrc20", "usdcerc20", "btc"];

export async function POST(request: NextRequest) {
  const limit = await enforceRateLimit(request, "api:checkout:nowpayments", {
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
    discountCode?: string;
  };
  const {
    tierId,
    currency = "usdttrc20",
    locale = "es-419",
    country,
    discountCode,
  } = body;

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

  if (user.isBanned) {
    return NextResponse.json(
      { error: "Account restricted", code: "ACCOUNT_RESTRICTED" },
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
          error:
            "Challenge purchases are not available in your country right now.",
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

    const discount = await resolveAffiliateDiscountCode(
      prisma,
      tier.fee,
      discountCode,
    );
    if (discountCode && !discount) {
      return NextResponse.json(
        {
          error: "Discount code is invalid or inactive.",
          code: "INVALID_DISCOUNT_CODE",
        },
        { status: 400 },
      );
    }
    if (discount && discount.affiliate.userId === user.id) {
      return NextResponse.json(
        {
          error: "You cannot use your own partner code.",
          code: "OWN_DISCOUNT_CODE",
        },
        { status: 400 },
      );
    }

    const invoice = await createCryptoInvoice({
      tierId: tier.id,
      tierName: tier.name,
      feeInCents: discount?.discountedAmount ?? tier.fee,
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
        amount: discount?.discountedAmount ?? tier.fee,
        listPriceAmount: tier.fee,
        discountAmount: discount?.discountAmount ?? 0,
        discountPct: discount?.affiliate.discountPct ?? 0,
        discountCode: discount?.affiliate.code ?? null,
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
          affiliateCode: discount?.affiliate.code ?? null,
          listPriceAmount: tier.fee,
          discountAmount: discount?.discountAmount ?? 0,
          discountPct: discount?.affiliate.discountPct ?? 0,
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
        discountCode: discount?.affiliate.code ?? null,
        discountAmount: discount?.discountAmount ?? 0,
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
