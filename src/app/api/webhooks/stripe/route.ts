import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import type Stripe from "stripe";

async function attributeAffiliateCommission(
  userId: string,
  feeInCents: number,
): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { referredByCode: true },
  });
  if (!user?.referredByCode) return;

  const affiliate = await prisma.affiliate.findUnique({
    where: { code: user.referredByCode },
  });
  if (!affiliate) return;

  // Guard: don't double-attribute if already commissioned for this user
  const alreadyConverted = await prisma.affiliateClick.findFirst({
    where: { affiliateId: affiliate.id, convertedToUserId: userId },
  });
  if (alreadyConverted) return;

  const ratePct = affiliate.commissionRate === "five" ? 5 : 10;
  const commission = Math.floor((feeInCents * ratePct) / 100);

  const ip = "conversion";
  await prisma.$transaction([
    prisma.affiliateClick.create({
      data: {
        affiliateId: affiliate.id,
        ip,
        convertedToUserId: userId,
        conversionAmount: feeInCents,
        commissionEarned: commission,
      },
    }),
    prisma.affiliate.update({
      where: { id: affiliate.id },
      data: {
        totalConversions: { increment: 1 },
        totalEarned: { increment: commission },
        pendingPayout: { increment: commission },
      },
    }),
  ]);

  console.log(
    `[affiliate] Commission $${(commission / 100).toFixed(2)} → affiliate ${affiliate.code} for user ${userId}`,
  );
}

async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session,
): Promise<void> {
  const { tierId, userId, isGift, giftRecipientEmail } = session.metadata ?? {};

  if (!tierId || !userId) {
    console.error("[webhook/stripe] Missing metadata on session:", session.id);
    return;
  }

  // Idempotency — skip if already processed
  const existing = await prisma.payment.findFirst({
    where: { providerRef: session.id },
  });
  if (existing) {
    console.log("[webhook/stripe] Duplicate event, skipping:", session.id);
    return;
  }

  const tier = await prisma.tier.findUnique({ where: { id: tierId } });
  if (!tier) {
    console.error("[webhook/stripe] Tier not found:", tierId);
    return;
  }

  const giftToken =
    isGift === "true"
      ? `GFT-${Math.random().toString(36).slice(2, 10).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`
      : null;

  await prisma.$transaction(async (tx) => {
    await tx.payment.create({
      data: {
        userId,
        tierId,
        amount: tier.fee,
        currency: "USD",
        method: "card",
        status: "completed",
        providerRef: session.id,
        isGift: isGift === "true",
        giftRecipientEmail: giftRecipientEmail || null,
        giftToken,
        metadata: {
          stripePaymentIntentId:
            typeof session.payment_intent === "string"
              ? session.payment_intent
              : (session.payment_intent?.id ?? null),
          customerEmail: session.customer_email,
        },
      },
    });

    // Gift: don't create Challenge now — recipient claims via /redeem/[token]
    if (isGift !== "true") {
      await tx.challenge.create({
        data: {
          userId,
          tierId,
          status: "active",
          phase: "phase1",
          balance: tier.fundedBankroll,
          startBalance: tier.fundedBankroll,
          dailyStartBalance: tier.fundedBankroll,
          highestBalance: tier.fundedBankroll,
          peakBalance: tier.fundedBankroll,
          phase1StartBalance: tier.fundedBankroll,
        },
      });
    }
  });

  // Affiliate commission — fire-and-forget (non-blocking, non-critical)
  void attributeAffiliateCommission(userId, tier.fee).catch((err) =>
    console.error("[webhook/stripe] affiliate commission error:", err),
  );

  console.log(
    `[webhook/stripe] Challenge created — userId: ${userId}, tier: ${tier.name}`,
  );
}

export async function POST(req: NextRequest) {
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json(
      { error: "Webhook secret not configured" },
      { status: 500 },
    );
  }

  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json(
      { error: "Missing stripe-signature" },
      { status: 400 },
    );
  }

  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET,
    );
  } catch (err) {
    console.error("[webhook/stripe] Signature verification failed:", err);
    return NextResponse.json(
      { error: "Invalid webhook signature" },
      { status: 400 },
    );
  }

  try {
    if (
      event.type === "checkout.session.completed" &&
      (event.data.object as Stripe.Checkout.Session).payment_status === "paid"
    ) {
      await handleCheckoutCompleted(
        event.data.object as Stripe.Checkout.Session,
      );
    }
    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("[webhook/stripe] Handler error:", err);
    return NextResponse.json(
      { error: "Webhook handler error" },
      { status: 500 },
    );
  }
}
