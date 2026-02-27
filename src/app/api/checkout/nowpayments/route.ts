import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { prisma } from "@/lib/prisma";
import { createCryptoInvoice, type CryptoCurrency } from "@/lib/nowpayments";

const VALID_CURRENCIES: CryptoCurrency[] = ["usdttrc20", "usdcerc20", "btc"];

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

  const body = (await request.json()) as {
    tierId?: string;
    currency?: string;
    locale?: string;
  };
  const { tierId, currency = "usdttrc20", locale = "es-419" } = body;

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
        metadata: { currency, network: invoice.network },
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
    return NextResponse.json(
      {
        error: "Failed to create crypto invoice",
        code: "CRYPTO_CHECKOUT_FAILED",
      },
      { status: 500 },
    );
  }
}
