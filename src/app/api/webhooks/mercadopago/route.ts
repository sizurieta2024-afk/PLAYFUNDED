import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { enforceRateLimit, rateLimitExceededResponse } from "@/lib/rate-limit";
import { recordOpsEvent } from "@/lib/ops-events";
import { fetchWithTimeout } from "@/lib/net/fetch-with-timeout";
import { withWebhookLock } from "@/lib/payments/webhook-lock";

// Mercado Pago sends IPN notifications. We verify by fetching the payment
// directly from the MP API using our access token — no shared secret needed
// for basic verification, but we do validate the source.

async function fetchMpPayment(paymentId: string): Promise<{
  status: string;
  metadata: {
    tier_id?: string;
    user_id?: string;
    tierId?: string;
    userId?: string;
    country?: string;
    policyVersion?: string;
  };
  transaction_amount: number;
  currency_id: string;
  payer: { email: string };
  id: number;
} | null> {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!token) return null;

  const res = await fetchWithTimeout(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
    headers: { Authorization: `Bearer ${token}` },
  }, 10_000);

  if (!res.ok) return null;
  return res.json() as Promise<{
    status: string;
    metadata: {
      tier_id?: string;
      user_id?: string;
      tierId?: string;
      userId?: string;
      country?: string;
      policyVersion?: string;
    };
    transaction_amount: number;
    currency_id: string;
    payer: { email: string };
    id: number;
  }>;
}

export async function POST(request: NextRequest) {
  const limit = await enforceRateLimit(request, "api:webhooks:mercadopago", {
    windowMs: 60_000,
    max: 240,
  });
  if (!limit.allowed) {
    return rateLimitExceededResponse("Too many webhook calls", limit);
  }

  const expectedToken = process.env.MERCADOPAGO_WEBHOOK_SECRET;
  if (expectedToken) {
    const token = request.nextUrl.searchParams.get("token");
    if (token !== expectedToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  await request.text();
  const params = request.nextUrl.searchParams;

  // MP sends the payment ID as a query param or in the body
  const topic = params.get("topic") ?? params.get("type");
  const id = params.get("id") ?? params.get("data.id");

  // Only process payment notifications
  if (topic !== "payment" && topic !== "merchant_order") {
    return NextResponse.json({ ok: true });
  }

  if (!id) {
    return NextResponse.json({ error: "Missing payment ID" }, { status: 400 });
  }

  // Fetch full payment details from MP API
  const mpPayment = await fetchMpPayment(id);
  if (!mpPayment) {
    return NextResponse.json({ error: "Payment not found" }, { status: 404 });
  }

  // Only process approved payments
  if (mpPayment.status !== "approved") {
    return NextResponse.json({ ok: true });
  }

  const tierId = mpPayment.metadata?.tier_id ?? mpPayment.metadata?.tierId;
  const userId = mpPayment.metadata?.user_id ?? mpPayment.metadata?.userId;
  const providerRef = String(mpPayment.id);

  if (!tierId || !userId) {
    console.error("[MP webhook] Missing metadata", { tierId, userId, paymentId: id });
    return NextResponse.json({ error: "Missing metadata" }, { status: 400 });
  }

  const tier = await prisma.tier.findUnique({ where: { id: tierId } });
  if (!tier) {
    return NextResponse.json({ error: "Tier not found" }, { status: 404 });
  }

  const outcome = await withWebhookLock(
    prisma,
    "mercadopago",
    providerRef,
    async (tx) => {
      const existing = await tx.payment.findFirst({ where: { providerRef } });
      if (existing) {
        return { status: "duplicate" as const };
      }

      await tx.payment.create({
        data: {
          userId,
          tierId,
          amount: Math.round(mpPayment.transaction_amount * 100), // convert to cents
          currency: mpPayment.currency_id ?? "USD",
          method: "mercadopago",
          status: "completed",
          providerRef,
          metadata: {
            mpPaymentId: mpPayment.id,
            payerEmail: mpPayment.payer?.email,
            checkoutCountry: mpPayment.metadata?.country ?? null,
            policyVersion: mpPayment.metadata?.policyVersion ?? null,
          },
        },
      });

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

      return { status: "created" as const };
    },
  );

  if (outcome.status === "duplicate") {
    await recordOpsEvent({
      type: "webhook_duplicate",
      source: "api:webhooks:mercadopago",
      actorUserId: userId,
      subjectType: "payment",
      subjectId: providerRef,
      country: mpPayment.metadata?.country ?? null,
      details: {
        provider: "mercadopago",
        providerRef,
      },
    });
    return NextResponse.json({ ok: true });
  }

  await recordOpsEvent({
    type: "webhook_payment_completed",
    source: "api:webhooks:mercadopago",
    actorUserId: userId,
    subjectType: "payment",
    subjectId: providerRef,
    country: mpPayment.metadata?.country ?? null,
    details: {
      provider: "mercadopago",
      providerRef,
      userId,
      tierId,
    },
  });

  return NextResponse.json({ ok: true });
}
