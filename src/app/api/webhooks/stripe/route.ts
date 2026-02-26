import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import type Stripe from "stripe";

// Disable body parsing — Stripe signature verification needs the raw body
export const config = {
  api: { bodyParser: false },
};

async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session,
): Promise<void> {
  const { tierId, userId } = session.metadata ?? {};

  if (!tierId || !userId) {
    console.error("[webhook/stripe] Missing metadata on session:", session.id);
    return;
  }

  // Idempotency: skip if a payment record already exists for this session
  const existing = await prisma.payment.findFirst({
    where: { providerRef: session.id },
  });

  if (existing) {
    console.log(
      "[webhook/stripe] Duplicate event for session:",
      session.id,
      "— skipping",
    );
    return;
  }

  // Load tier
  const tier = await prisma.tier.findUnique({ where: { id: tierId } });
  if (!tier) {
    console.error("[webhook/stripe] Tier not found:", tierId);
    return;
  }

  // Create Payment + Challenge atomically
  await prisma.$transaction(async (tx) => {
    // 1. Record the payment
    await tx.payment.create({
      data: {
        userId,
        tierId,
        amount: tier.fee,
        currency: "USD",
        method: "card",
        status: "completed",
        providerRef: session.id,
        metadata: {
          stripePaymentIntentId:
            typeof session.payment_intent === "string"
              ? session.payment_intent
              : (session.payment_intent?.id ?? null),
          customerEmail: session.customer_email,
        },
      },
    });

    // 2. Create the challenge
    await tx.challenge.create({
      data: {
        userId,
        tierId,
        status: "active",
        phase: "phase1",
        balance: tier.fundedBankroll,
        startBalance: tier.fundedBankroll,
        highestBalance: tier.fundedBankroll,
        peakBalance: tier.fundedBankroll,
        phase1StartBalance: tier.fundedBankroll,
      },
    });
  });

  // Send welcome email (non-blocking — fire & forget)
  // Email will be wired in Session 17 when Resend is set up
  console.log(
    `[webhook/stripe] Challenge created for user ${userId}, tier ${tier.name}`,
  );
}

export async function POST(req: NextRequest) {
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    console.error("[webhook/stripe] STRIPE_WEBHOOK_SECRET not set");
    return NextResponse.json(
      { error: "Webhook secret not configured" },
      { status: 500 },
    );
  }

  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json(
      { error: "Missing stripe-signature header" },
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
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.payment_status === "paid") {
          await handleCheckoutCompleted(session);
        }
        break;
      }

      // Log other events for future use
      case "payment_intent.payment_failed": {
        const pi = event.data.object as Stripe.PaymentIntent;
        console.log(
          "[webhook/stripe] Payment failed:",
          pi.id,
          pi.last_payment_error?.message,
        );
        break;
      }

      default:
        // Ignore unhandled events
        break;
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
