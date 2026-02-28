"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createServerClient } from "@/lib/supabase";
import type {
  PayoutStatus,
  KycStatus,
  MarketRequestStatus,
  AffiliateCommissionRate,
} from "@prisma/client";

async function requireAdmin() {
  const supabase = createServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) redirect("/auth/login");

  const user = await prisma.user.findFirst({
    where: { supabaseId: session.user.id },
  });
  if (!user || user.role !== "admin") redirect("/dashboard");
  return user;
}

async function audit(
  adminId: string,
  action: string,
  targetType: string,
  targetId: string,
  note?: string,
) {
  await prisma.auditLog.create({
    data: { adminId, action, targetType, targetId, note },
  });
}

// ── Users ─────────────────────────────────────────────────────────────

export async function banUser(userId: string, reason: string) {
  const admin = await requireAdmin();
  await prisma.user.update({
    where: { id: userId },
    data: { isBanned: true, banReason: reason },
  });
  await audit(admin.id, "ban_user", "user", userId, reason);
}

export async function unbanUser(userId: string) {
  const admin = await requireAdmin();
  await prisma.user.update({
    where: { id: userId },
    data: { isBanned: false, banReason: null },
  });
  await audit(admin.id, "unban_user", "user", userId);
}

// ── Challenges ────────────────────────────────────────────────────────

export async function overrideChallenge(
  challengeId: string,
  status: "active" | "funded" | "failed" | "passed",
  note: string,
) {
  const admin = await requireAdmin();
  await prisma.challenge.update({
    where: { id: challengeId },
    data: { status },
  });
  await audit(
    admin.id,
    "override_challenge",
    "challenge",
    challengeId,
    `status → ${status}: ${note}`,
  );
}

// ── Payouts ───────────────────────────────────────────────────────────

export async function adminUpdatePayout(
  payoutId: string,
  action: "approve" | "reject",
  txRef?: string,
  adminNote?: string,
) {
  const admin = await requireAdmin();
  const newStatus: PayoutStatus = action === "approve" ? "paid" : "failed";
  await prisma.payout.update({
    where: { id: payoutId },
    data: {
      status: newStatus,
      txRef: txRef ?? null,
      adminNote: adminNote ?? null,
      approvedAt: action === "approve" ? new Date() : null,
      paidAt: action === "approve" ? new Date() : null,
    },
  });
  await audit(
    admin.id,
    `${action}_payout`,
    "payout",
    payoutId,
    adminNote ?? txRef,
  );
}

// ── KYC ───────────────────────────────────────────────────────────────

export async function adminUpdateKyc(
  submissionId: string,
  action: "approve" | "reject",
  reviewNote?: string,
) {
  const admin = await requireAdmin();
  const newStatus: KycStatus = action === "approve" ? "approved" : "rejected";
  await prisma.kycSubmission.update({
    where: { id: submissionId },
    data: {
      status: newStatus,
      reviewedAt: new Date(),
      reviewNote: reviewNote ?? null,
    },
  });
  await audit(admin.id, `${action}_kyc`, "kyc", submissionId, reviewNote);
}

// ── Affiliates ────────────────────────────────────────────────────────

export async function setAffiliateRate(
  affiliateId: string,
  rate: AffiliateCommissionRate,
) {
  const admin = await requireAdmin();
  await prisma.affiliate.update({
    where: { id: affiliateId },
    data: { commissionRate: rate },
  });
  await audit(
    admin.id,
    "set_affiliate_rate",
    "affiliate",
    affiliateId,
    `rate → ${rate}`,
  );
}

export async function adminMarkAffiliatePaid(
  affiliateId: string,
  note?: string,
) {
  const admin = await requireAdmin();
  // Mark any pending affiliate payout for this affiliate's user as paid
  const affiliate = await prisma.affiliate.findUnique({
    where: { id: affiliateId },
    select: { userId: true },
  });
  if (!affiliate) return;
  await prisma.payout.updateMany({
    where: { userId: affiliate.userId, isAffiliate: true, status: "pending" },
    data: { status: "paid", paidAt: new Date(), adminNote: note ?? null },
  });
  await audit(admin.id, "affiliate_paid", "affiliate", affiliateId, note);
}

// ── Market Requests ───────────────────────────────────────────────────

export async function adminUpdateMarketRequest(
  requestId: string,
  status: MarketRequestStatus,
  adminNote?: string,
) {
  const admin = await requireAdmin();
  await prisma.marketRequest.update({
    where: { id: requestId },
    data: { status, adminNote: adminNote ?? null },
  });
  await audit(
    admin.id,
    `market_request_${status}`,
    "market_request",
    requestId,
    adminNote,
  );
}
