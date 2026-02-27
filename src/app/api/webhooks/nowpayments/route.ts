import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyNowPaymentsSignature } from "@/lib/nowpayments";

// NOWPayments IPN: fires on every status change.
// We only act on "finished" (fully confirmed) payments.

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get("x-nowpayments-sig") ?? "";

  const isValid = await verifyNowPaymentsSignature(body, signature);
  if (!isValid) {
    console.error("[NOWPayments webhook] Invalid signature");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const data = JSON.parse(body) as {
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

  // Only process fully confirmed payments
  if (data.payment_status !== "finished") {
    return NextResponse.json({ ok: true });
  }

  const providerRef = data.payment_id;

  // Idempotency check
  const existing = await prisma.payment.findFirst({ where: { providerRef } });
  if (existing?.status === "completed") return NextResponse.json({ ok: true });

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

  await prisma.$transaction(async (tx) => {
    // Update pending record if it exists, otherwise create new
    const pendingPayment = await tx.payment.findFirst({
      where: { providerRef, status: "pending" },
    });

    if (pendingPayment) {
      await tx.payment.update({
        where: { id: pendingPayment.id },
        data: {
          status: "completed",
          metadata: {
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
          },
        },
      });
    }

    // Create the challenge
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
  });

  return NextResponse.json({ ok: true });
}
