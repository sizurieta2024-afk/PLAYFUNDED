"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createServerClient } from "@/lib/supabase";

export async function redeemGift(
  token: string,
): Promise<{ error?: string; challengeId?: string }> {
  const supabase = createServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return { error: "auth_required" };

  const user = await prisma.user.findFirst({
    where: { supabaseId: session.user.id },
    select: { id: true },
  });
  if (!user) return { error: "auth_required" };

  const payment = await prisma.payment.findUnique({
    where: { giftToken: token },
    include: { tier: true },
  });

  if (!payment) return { error: "invalid_token" };
  if (payment.giftClaimedAt) return { error: "already_claimed" };
  if (!payment.tier) return { error: "tier_not_found" };

  // Prevent gifter from redeeming their own gift
  if (payment.userId === user.id) return { error: "cannot_redeem_own" };

  const [challenge] = await prisma.$transaction([
    prisma.challenge.create({
      data: {
        userId: user.id,
        tierId: payment.tierId,
        status: "active",
        phase: "phase1",
        balance: payment.tier.fundedBankroll,
        startBalance: payment.tier.fundedBankroll,
        dailyStartBalance: payment.tier.fundedBankroll,
        highestBalance: payment.tier.fundedBankroll,
        peakBalance: payment.tier.fundedBankroll,
        phase1StartBalance: payment.tier.fundedBankroll,
        isGift: true,
        giftedByUserId: payment.userId,
      },
    }),
    prisma.payment.update({
      where: { id: payment.id },
      data: { giftClaimedAt: new Date() },
    }),
  ]);

  return { challengeId: challenge.id };
}
