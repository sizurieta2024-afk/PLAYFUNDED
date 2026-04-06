import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyNowPaymentsSignature } from "@/lib/nowpayments";
import { enforceRateLimit, rateLimitExceededResponse } from "@/lib/rate-limit";
import { recordOpsEvent } from "@/lib/ops-events";
import { withRouteMetric } from "@/lib/ops-observability";
import { fulfillNowPaymentsPayment } from "@/lib/payments/nowpayments-fulfillment";
import { attributeAffiliatePurchase } from "@/lib/affiliate/attribution";
import { sendEmail, challengePurchasedEmail } from "@/lib/email";

// NOWPayments IPN: fires on every status change.
// We only act on "finished" (fully confirmed) payments.

export async function POST(request: NextRequest) {
  return withRouteMetric(
    {
      route: "POST /api/webhooks/nowpayments",
      source: "api:webhooks:nowpayments",
    },
    async () => {
      const limit = await enforceRateLimit(request, "api:webhooks:nowpayments", {
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

      const pendingPayment = await prisma.payment.findFirst({
        where: { providerRef, status: "pending" },
        select: {
          discountCode: true,
          discountAmount: true,
          discountPct: true,
          listPriceAmount: true,
        },
      });

      const outcome = await fulfillNowPaymentsPayment({
        db: prisma,
        providerRef,
        userId,
        tierId,
        tierFundedBankroll: tier.fundedBankroll,
        priceAmount: data.price_amount,
        priceCurrency: data.price_currency,
        payCurrency: data.pay_currency,
        payAmount: data.pay_amount,
        discountCode: pendingPayment?.discountCode ?? null,
        discountAmount: pendingPayment?.discountAmount ?? 0,
        discountPct: pendingPayment?.discountPct ?? 0,
        listPriceAmount:
          pendingPayment?.listPriceAmount ?? Math.round(data.price_amount * 100),
      });

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

      if (outcome.status === "created") {
        void attributeAffiliatePurchase({
          userId,
          paymentId: outcome.paymentId,
          paidAmount: Math.round(data.price_amount * 100),
          listPriceAmount:
            pendingPayment?.listPriceAmount ?? Math.round(data.price_amount * 100),
          discountAmount: pendingPayment?.discountAmount ?? 0,
          discountPct: pendingPayment?.discountPct ?? 0,
          code: pendingPayment?.discountCode ?? null,
        }).catch((error) =>
          console.error("[NOWPayments webhook] affiliate attribution error", error),
        );

        // Send challenge purchased confirmation email
        void prisma.user
          .findUnique({
            where: { id: userId },
            select: { email: true, name: true },
          })
          .then((buyer) => {
            if (!buyer) return;
            const { subject, html } = challengePurchasedEmail(
              buyer.name,
              tier.name,
              tier.fundedBankroll,
              tier.minPicks,
            );
            return sendEmail(buyer.email, subject, html);
          })
          .catch((err) =>
            console.error("[NOWPayments webhook] purchase email error", err),
          );
      }

      return NextResponse.json({ ok: true });
    },
  );
}
