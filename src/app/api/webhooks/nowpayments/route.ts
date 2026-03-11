import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyNowPaymentsSignature } from "@/lib/nowpayments";
import { enforceRateLimit, rateLimitExceededResponse } from "@/lib/rate-limit";
import { recordOpsEvent } from "@/lib/ops-events";
import { withWebhookLock } from "@/lib/payments/webhook-lock";

// NOWPayments IPN: fires on every status change.
// We only act on "finished" (fully confirmed) payments.

export async function POST(request: NextRequest) {
  const limit = enforceRateLimit(request, "api:webhooks:nowpayments", {
    windowMs: 60_000,
    max: 240,
  });
  if (!limit.allowed) {
    return rateLimitExceededResponse("Too many webhook calls", limit);
  }

  const body = await request.text();
  const signature = request.headers.get("x-nowpayments-sig") ?? "";

  let isValid = false;
  try {
    isValid = await verifyNowPaymentsSignature(body, signature);
  } catch (error) {
    console.error("[NOWPayments webhook] Signature verification failed", error);
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  if (!isValid) {
    console.error("[NOWPayments webhook] Invalid signature");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let data: {
    payment_id: string;
    payment_status: string;
    order_id: string; // format: tierId:userId:timestamp
    price_amount: number;
    price_currency: string;
    pay_amount: number;
    pay_currency: string;
    outcome_amount: number;
    outcome_currency: string;
  };
  try {
    data = JSON.parse(body) as typeof data;
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  // Only process fully confirmed payments
  if (data.payment_status !== "finished") {
    return NextResponse.json({ ok: true });
  }

  const providerRef = data.payment_id;

  // Parse order_id: tierId:userId:timestamp
  const [tierId, userId] = data.order_id.split(":");
  if (!tierId || !userId) {
    console.error("[NOWPayments webhook] Invalid order_id", data.order_id);
    return NextResponse.json({ error: "Invalid order_id" }, { status: 400 });
  }

  const tier = await prisma.tier.findUnique({ where: { id: tierId } });
  if (!tier) {
    return NextResponse.json({ error: "Tier not found" }, { status: 404 });
  }

  const payMethod =
    data.pay_currency === "btc"
      ? "btc"
      : data.pay_currency.startsWith("usdc")
        ? "usdc"
        : "usdt";

  const outcome = await withWebhookLock(
    prisma,
    "nowpayments",
    providerRef,
    async (tx) => {
      const existing = await tx.payment.findFirst({ where: { providerRef } });
      if (existing?.status === "completed") {
        return { status: "duplicate" as const };
      }

      const pendingPayment = await tx.payment.findFirst({
        where: { providerRef, status: "pending" },
      });

      if (pendingPayment) {
        await tx.payment.update({
          where: { id: pendingPayment.id },
          data: {
            status: "completed",
            metadata: {
              ...(typeof pendingPayment.metadata === "object" &&
              pendingPayment.metadata !== null
                ? pendingPayment.metadata
                : {}),
              paymentId: data.payment_id,
              payCurrency: data.pay_currency,
              payAmount: data.pay_amount,
            },
          },
        });
      } else {
        await tx.payment.create({
          data: {
            userId,
            tierId,
            amount: Math.round(data.price_amount * 100),
            currency: data.price_currency.toUpperCase(),
            method: payMethod,
            status: "completed",
            providerRef,
            metadata: {
              paymentId: data.payment_id,
              payCurrency: data.pay_currency,
              payAmount: data.pay_amount,
              policyVersion: null,
            },
          },
        });
      }

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
      source: "api:webhooks:nowpayments",
      subjectType: "payment",
      subjectId: providerRef,
      details: {
        provider: "nowpayments",
        providerRef,
      },
    });
    return NextResponse.json({ ok: true });
  }

  await recordOpsEvent({
    type: "webhook_payment_completed",
    source: "api:webhooks:nowpayments",
    actorUserId: userId,
    subjectType: "payment",
    subjectId: providerRef,
    details: {
      provider: "nowpayments",
      providerRef,
      userId,
      tierId,
      payCurrency: data.pay_currency,
    },
  });

  return NextResponse.json({ ok: true });
}
