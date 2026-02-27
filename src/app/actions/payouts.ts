"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createServerClient } from "@/lib/supabase";
import type { PayoutMethod } from "@prisma/client";

async function getAuthenticatedUser() {
  const supabase = createServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) redirect("/auth/login");

  const user = await prisma.user.findFirst({
    where: { supabaseId: session.user.id },
    include: { kycSubmission: true },
  });

  if (!user) redirect("/auth/login");
  return user;
}

export async function requestPayout(
  challengeId: string,
  method: PayoutMethod,
): Promise<{ error?: string }> {
  const user = await getAuthenticatedUser();

  // KYC gate
  if (!user.kycSubmission || user.kycSubmission.status !== "approved") {
    return { error: "kyc_required" };
  }

  const challenge = await prisma.challenge.findFirst({
    where: { id: challengeId, userId: user.id, status: "funded" },
    include: { tier: true },
  });

  if (!challenge) return { error: "challenge_not_found" };

  // Profit must be positive
  const grossProfit = challenge.balance - challenge.startBalance;
  if (grossProfit <= 0) return { error: "profit_zero" };

  const payoutAmount = Math.floor(
    (grossProfit * challenge.tier.profitSplitPct) / 100,
  );
  if (payoutAmount <= 0) return { error: "profit_zero" };

  // No duplicate pending payout
  const existing = await prisma.payout.findFirst({
    where: {
      challengeId,
      userId: user.id,
      status: "pending",
      isRollover: false,
    },
  });
  if (existing) return { error: "pending_exists" };

  await prisma.payout.create({
    data: {
      userId: user.id,
      challengeId,
      amount: payoutAmount,
      splitPct: challenge.tier.profitSplitPct,
      method,
      status: "pending",
      isRollover: false,
    },
  });

  return {};
}

export async function rolloverProfits(
  challengeId: string,
): Promise<{ error?: string }> {
  const user = await getAuthenticatedUser();

  const challenge = await prisma.challenge.findFirst({
    where: { id: challengeId, userId: user.id, status: "funded" },
    include: { tier: true },
  });

  if (!challenge) return { error: "challenge_not_found" };

  const grossProfit = challenge.balance - challenge.startBalance;
  if (grossProfit <= 0) return { error: "profit_zero" };

  const payoutAmount = Math.floor(
    (grossProfit * challenge.tier.profitSplitPct) / 100,
  );

  // Record rollover as a paid payout (no real money moves, just bookkeeping)
  await prisma.$transaction([
    prisma.payout.create({
      data: {
        userId: user.id,
        challengeId,
        amount: payoutAmount,
        splitPct: challenge.tier.profitSplitPct,
        method: "bank_wire", // placeholder — unused for rollovers
        status: "paid",
        isRollover: true,
        approvedAt: new Date(),
        paidAt: new Date(),
      },
    }),
    // Reset profit baseline so future profits are calculated from current balance
    prisma.challenge.update({
      where: { id: challengeId },
      data: { startBalance: challenge.balance },
    }),
  ]);

  return {};
}
