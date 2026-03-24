"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createServerClient } from "@/lib/supabase";
import type { PayoutMethod } from "@prisma/client";
import { sendEmail, payoutRequestedEmail } from "@/lib/email";
import { recordOpsEvent } from "@/lib/ops-events";
import { resolvePayoutCountry } from "@/lib/payout-options";
import { PLATFORM_POLICY, isPayoutWindowOpen } from "@/lib/platform-policy";
import { getResolvedCountryPolicy } from "@/lib/country-policy-store";
import { createPayoutRequest } from "@/lib/payouts/request-service";

async function getAuthenticatedUser() {
  const supabase = await createServerClient();
  const {
    data: { user: authUser },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !authUser) redirect("/auth/login");

  const user = await prisma.user.findFirst({
    where: { supabaseId: authUser.id },
    include: { kycSubmission: true },
  });

  if (!user) redirect("/auth/login");
  return user;
}

export async function requestPayout(
  challengeId: string,
  method: PayoutMethod,
  requestedProfitAmount: number, // in cents — the portion of gross profit to pay out
  destinationAddress?: string,
): Promise<{ error?: string; code?: string }> {
  const user = await getAuthenticatedUser();

  const payoutCountry = resolvePayoutCountry(
    user.kycSubmission?.country,
    user.country,
  );
  const policy = await getResolvedCountryPolicy(payoutCountry);
  if (!policy.payoutsEnabled) {
    return { error: "method_unavailable", code: "PAYOUTS_DISABLED_COUNTRY" };
  }
  if (!policy.payoutMethods.includes(method)) {
    return { error: "method_unavailable", code: "METHOD_UNAVAILABLE" };
  }

  const decision = await createPayoutRequest({
    db: prisma,
    userId: user.id,
    challengeId,
    method,
    requestedProfitAmount,
    destinationAddress,
    payoutsEnabled: policy.payoutsEnabled,
    methodAllowed: true,
    kycApproved: !!user.kycSubmission && user.kycSubmission.status === "approved",
    windowOpen: isPayoutWindowOpen(),
    minimumPayoutCents: PLATFORM_POLICY.payouts.minimumCents,
  });
  if (!decision.ok) {
    return { error: decision.error, code: decision.code };
  }

  const { subject, html } = payoutRequestedEmail(
    user.name,
    decision.payoutAmount,
    method,
  );
  void sendEmail(user.email, subject, html);

  await recordOpsEvent({
    type: "payout_requested",
    source: "action:payouts",
    actorUserId: user.id,
    subjectType: "challenge",
    subjectId: challengeId,
    country: payoutCountry,
    details: {
      userId: user.id,
      challengeId,
        method,
        destinationAddress: destinationAddress ?? null,
        payoutCountry,
        requestedProfitAmount,
      payoutAmount: decision.payoutAmount,
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

  await recordOpsEvent({
    type: "payout_rollover",
    source: "action:payouts",
    actorUserId: user.id,
    subjectType: "challenge",
    subjectId: challengeId,
    country: user.country,
    details: {
      userId: user.id,
      challengeId,
      payoutAmount,
      grossProfit,
    },
  });

  return {};
}
