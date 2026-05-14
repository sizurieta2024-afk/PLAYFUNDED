import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import type Stripe from "stripe";
import { enforceRateLimit, rateLimitExceededResponse } from "@/lib/rate-limit";
import {
  sendEmail,
  challengePurchasedEmail,
  giftVoucherEmail,
} from "@/lib/email";
import { recordOpsEvent } from "@/lib/ops-events";
import { withRouteMetric } from "@/lib/ops-observability";
import { withWebhookLock } from "@/lib/payments/webhook-lock";
import { attributeAffiliatePurchase } from "@/lib/affiliate/attribution";
import { ALLOWED_FORWARDED_HOSTS } from "@/lib/allowed-hosts";
import { AnalyticsEvents } from "@/lib/analytics/events";
import { captureServerEvent } from "@/lib/analytics/posthog-server";

function parseMetadataInt(value: unknown, fallback: number) {
  const parsed =
    typeof value === "string" || typeof value === "number"
      ? Number(value)
      : NaN;
  return Number.isFinite(parsed) ? Math.floor(parsed) : fallback;
}

async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session,
): Promise<{ status: "created" | "duplicate"; paymentId?: string | null }> {
  const {
    tierId,
    userId,
    isGift,
    giftRecipientEmail,
    country,
    policyVersion,
    paymentMethodKind,
    affiliateCode,
    listPriceAmount,
    discountAmount,
    discountPct,
  } = session.metadata ?? {};

  if (!tierId || !userId) {
    console.error("[webhook/stripe] Missing metadata on session:", session.id);
    return { status: "duplicate" };
  }

  const tier = await prisma.tier.findUnique({ where: { id: tierId } });
  if (!tier) {
    console.error("[webhook/stripe] Tier not found:", tierId);
    return { status: "duplicate" };
  }

  const normalizedListPriceAmount = parseMetadataInt(listPriceAmount, tier.fee);
  const normalizedDiscountAmount = parseMetadataInt(discountAmount, 0);
  // Use Stripe's authoritative amount_total as the charged amount — not metadata.
  // Metadata is used only for tier/user routing and display; the actual charge
  // must come from Stripe to prevent any metadata-tampering discrepancy.
  const chargedAmount =
    session.amount_total ??
    Math.max(0, normalizedListPriceAmount - normalizedDiscountAmount);

  const fulfillment = await withWebhookLock(
    prisma,
    "stripe",
    session.id,
    async (tx) => {
      const existing = await tx.payment.findFirst({
        where: { providerRef: session.id },
      });
      if (existing) {
        return {
          status: "duplicate" as const,
          giftToken: null as string | null,
          paymentId: existing.id,
        };
      }

      const giftToken =
        isGift === "true"
          ? `GFT-${Array.from(crypto.getRandomValues(new Uint8Array(8)))
              .map((b) => b.toString(16).padStart(2, "0"))
              .join("")
              .toUpperCase()}-${Date.now().toString(36).toUpperCase()}`
          : null;

      const payment = await tx.payment.create({
        data: {
          userId,
          tierId,
          amount: chargedAmount,
          listPriceAmount: normalizedListPriceAmount,
          discountAmount: normalizedDiscountAmount,
          discountPct: parseMetadataInt(discountPct, 0),
          discountCode: affiliateCode || null,
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
            paymentMethodKind: paymentMethodKind ?? "card",
            checkoutCountry: country ?? null,
            policyVersion: policyVersion ?? null,
          },
        },
        select: { id: true },
      });

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

      return { status: "created" as const, giftToken, paymentId: payment.id };
    },
  );

  if (fulfillment.status === "duplicate") {
    console.info("[webhook/stripe] Duplicate event, skipping:", session.id);
    await recordOpsEvent({
      type: "webhook_duplicate",
      source: "api:webhooks:stripe",
      actorUserId: userId,
      subjectType: "payment",
      subjectId: session.id,
      country: country ?? null,
      details: {
        provider: "stripe",
        providerRef: session.id,
      },
    });
    return { status: "duplicate", paymentId: fulfillment.paymentId };
  }

  await recordOpsEvent({
    type: "webhook_payment_completed",
    source: "api:webhooks:stripe",
    actorUserId: userId,
    subjectType: "payment",
    subjectId: session.id,
    country: country ?? null,
    details: {
      provider: "stripe",
      providerRef: session.id,
      userId,
      tierId,
      isGift: isGift === "true",
    },
  });

  if (fulfillment.paymentId) {
    void attributeAffiliatePurchase({
      userId,
      paymentId: fulfillment.paymentId,
      paidAmount: chargedAmount,
      listPriceAmount: normalizedListPriceAmount,
      discountAmount: normalizedDiscountAmount,
      discountPct: parseMetadataInt(discountPct, 0),
      code: affiliateCode ?? null,
    }).catch((err) =>
      console.error("[webhook/stripe] affiliate attribution error:", err),
    );
  }

  // Transactional emails
  const buyer = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, name: true, supabaseId: true },
  });
  if (buyer) {
    await captureServerEvent(AnalyticsEvents.PAYMENT_COMPLETED, buyer.supabaseId, {
      provider: "stripe",
      tier_id: tier.id,
      tier_name: tier.name,
      amount_cents: chargedAmount,
      list_price_cents: normalizedListPriceAmount,
      discount_amount_cents: normalizedDiscountAmount,
      discount_pct: parseMetadataInt(discountPct, 0),
      discount_code_present: Boolean(affiliateCode),
      payment_method: paymentMethodKind ?? "card",
      country: country ?? null,
      is_gift: isGift === "true",
      payment_status: "completed",
    });

    if (isGift === "true" && giftRecipientEmail && fulfillment.giftToken) {
      const { subject, html } = giftVoucherEmail(
        giftRecipientEmail,
        buyer.name,
        tier.name,
        fulfillment.giftToken,
      );
      void sendEmail(giftRecipientEmail, subject, html);
    } else {
      const { subject, html } = challengePurchasedEmail(
        buyer.name,
        tier.name,
        tier.fundedBankroll,
        tier.minPicks,
      );
      void sendEmail(buyer.email, subject, html);
    }
  }

  console.info(
    `[webhook/stripe] Challenge created — userId: ${userId}, tier: ${tier.name}`,
  );
  return { status: "created", paymentId: fulfillment.paymentId };
}

export async function POST(req: NextRequest) {
  return withRouteMetric(
    {
      route: "POST /api/webhooks/stripe",
      source: "api:webhooks:stripe",
    },
    async () => {
      const limit = await enforceRateLimit(req, "api:webhooks:stripe", {
        windowMs: 60_000,
        max: 240,
      });
      if (!limit.allowed) {
        return rateLimitExceededResponse("Too many webhook calls", limit);
      }

      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
      if (!webhookSecret) {
        return NextResponse.json(
          { error: "Webhook secret not configured" },
          { status: 500 },
        );
      }
      const liveHost = ALLOWED_FORWARDED_HOSTS.includes(new URL(req.url).hostname);
      if (
        (process.env.VERCEL_ENV === "production" || liveHost) &&
        !webhookSecret.startsWith("whsec_")
      ) {
        return NextResponse.json(
          {
            error:
              "Stripe webhook secret is not configured with a real whsec_ value on the live host.",
          },
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
          webhookSecret,
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
          (event.data.object as Stripe.Checkout.Session).payment_status ===
            "paid"
        ) {
          await handleCheckoutCompleted(
            event.data.object as Stripe.Checkout.Session,
          );
        }
        return NextResponse.json({ received: true });
      } catch (err) {
        console.error("[webhook/stripe] Handler error:", err);
        await recordOpsEvent({
          type: "webhook_handler_failed",
          level: "error",
          source: "api:webhooks:stripe",
          subjectType: "payment",
          details: {
            provider: "stripe",
            eventType: event.type,
            error: err instanceof Error ? err.message : String(err),
          },
        });
        return NextResponse.json(
          { error: "Webhook handler error" },
          { status: 500 },
        );
      }
    },
  );
}
