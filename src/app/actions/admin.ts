"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createServerClient } from "@/lib/supabase";
import {
  sendEmail,
  payoutPaidEmail,
  payoutRejectedEmail,
  kycApprovedEmail,
  kycRejectedEmail,
} from "@/lib/email";
import { recordOpsEvent } from "@/lib/ops-events";
import {
  reviewKycByAdmin,
  reviewPayoutByAdmin,
} from "@/lib/admin/review-service";
import { setUserBanState } from "@/lib/admin/user-moderation-service";

async function requireAdmin() {
  const supabase = await createServerClient();
  const {
    data: { user: authUser },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !authUser) redirect("/auth/login");

  const user = await prisma.user.findFirst({
    where: { supabaseId: authUser.id },
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

const CHECKOUT_METHODS = ["card", "crypto", "pix"] as const;
const PAYOUT_METHODS = ["bank_wire", "usdt", "usdc", "btc", "paypal"] as const;
const COUNTRY_MARKET_STATUSES = ["blocked", "review", "enabled"] as const;
type CountryPolicyStatus = (typeof COUNTRY_MARKET_STATUSES)[number];
type MarketRequestStatus = "pending" | "reviewed" | "approved" | "rejected";
type AffiliateCommissionRate = "five" | "ten";

function generateAffiliateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "PF-";
  for (let i = 0; i < 6; i += 1) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function parseBooleanInput(value: FormDataEntryValue | null): boolean {
  return value === "true" || value === "on";
}

function parseEnumList<T extends string>(
  values: FormDataEntryValue[],
  allowed: readonly T[],
): T[] {
  return values
    .map((value) => String(value))
    .filter((value): value is T => allowed.includes(value as T));
}

// ── Users ─────────────────────────────────────────────────────────────

export async function banUser(userId: string, reason: string) {
  const admin = await requireAdmin();
  await setUserBanState(prisma, {
    adminId: admin.id,
    userId,
    banned: true,
    reason,
  });
}

export async function unbanUser(userId: string) {
  const admin = await requireAdmin();
  await setUserBanState(prisma, {
    adminId: admin.id,
    userId,
    banned: false,
  });
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
): Promise<{ error?: string; code?: string }> {
  const admin = await requireAdmin();
  const result = await reviewPayoutByAdmin({
    db: prisma,
    adminId: admin.id,
    payoutId,
    action,
    txRef,
    adminNote,
  });
  if (!result.ok) {
    return {
      error:
        result.code === "RETRYABLE_CONFLICT"
          ? "payout_review_conflict"
          : result.code === "CRYPTO_DESTINATION_REQUIRED"
            ? "crypto_destination_required"
            : result.code === "PROVIDER_ERROR"
              ? result.error ?? "payout_provider_error"
              : "payout_not_found_or_not_pending",
      code: result.code,
    };
  }
  const payout = result.payout;
  await recordOpsEvent({
    type: "admin_payout_reviewed",
    source: "action:admin",
    actorUserId: admin.id,
    subjectType: "payout",
    subjectId: payoutId,
    details: {
      adminId: admin.id,
      payoutId,
      action,
      txRef: txRef ?? null,
    },
  });
  if (action === "approve" && payout.status === "paid") {
    const { subject, html } = payoutPaidEmail(
      payout.user.name,
      payout.amount,
      payout.method,
      txRef,
    );
    void sendEmail(payout.user.email, subject, html);
  } else {
    const { subject, html } = payoutRejectedEmail(
      payout.user.name,
      payout.amount,
      adminNote,
    );
    void sendEmail(payout.user.email, subject, html);
  }
  return {};
}

// ── KYC ───────────────────────────────────────────────────────────────

export async function adminUpdateKyc(
  submissionId: string,
  action: "approve" | "reject",
  reviewNote?: string,
) {
  const admin = await requireAdmin();
  const kyc = await reviewKycByAdmin({
    db: prisma,
    adminId: admin.id,
    submissionId,
    action,
    reviewNote,
  });
  if (!kyc) return;
  await recordOpsEvent({
    type: "admin_kyc_reviewed",
    source: "action:admin",
    actorUserId: admin.id,
    subjectType: "kyc",
    subjectId: submissionId,
    details: {
      adminId: admin.id,
      submissionId,
      action,
    },
  });
  if (action === "approve") {
    const { subject, html } = kycApprovedEmail(kyc.user.name);
    void sendEmail(kyc.user.email, subject, html);
  } else {
    const { subject, html } = kycRejectedEmail(kyc.user.name, reviewNote);
    void sendEmail(kyc.user.email, subject, html);
  }
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
  revalidatePath("/[locale]/admin/affiliates", "page");
}

export async function setAffiliateDiscountPct(
  affiliateId: string,
  discountPct: number,
) {
  const admin = await requireAdmin();
  await prisma.affiliate.update({
    where: { id: affiliateId },
    data: {
      discountPct: Math.max(0, Math.min(100, Math.floor(discountPct))),
    },
  });
  await audit(
    admin.id,
    "set_affiliate_discount_pct",
    "affiliate",
    affiliateId,
    `discountPct → ${discountPct}`,
  );
  revalidatePath("/[locale]/admin/affiliates", "page");
}

export async function setAffiliateActive(
  affiliateId: string,
  isActive: boolean,
) {
  const admin = await requireAdmin();
  await prisma.affiliate.update({
    where: { id: affiliateId },
    data: { isActive },
  });
  await audit(
    admin.id,
    isActive ? "activate_affiliate" : "deactivate_affiliate",
    "affiliate",
    affiliateId,
  );
  revalidatePath("/[locale]/admin/affiliates", "page");
}

export async function adminCreateAffiliate(
  userEmail: string,
  rate: AffiliateCommissionRate,
  discountPct: number,
): Promise<{ error?: string; code?: string }> {
  const admin = await requireAdmin();
  const email = userEmail.trim().toLowerCase();
  if (!email) {
    return { error: "missing_email" };
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (!user) {
    return { error: "user_not_found" };
  }

  const existing = await prisma.affiliate.findUnique({
    where: { userId: user.id },
    select: { code: true },
  });
  if (existing) {
    return { error: "affiliate_exists", code: existing.code };
  }

  let code = generateAffiliateCode();
  for (let i = 0; i < 5; i += 1) {
    const collision = await prisma.affiliate.findUnique({ where: { code } });
    if (!collision) break;
    code = generateAffiliateCode();
  }

  const affiliate = await prisma.affiliate.create({
    data: {
      userId: user.id,
      code,
      commissionRate: rate,
      discountPct: Math.max(0, Math.min(100, Math.floor(discountPct))),
      isActive: true,
    },
  });
  await audit(
    admin.id,
    "create_affiliate",
    "affiliate",
    affiliate.id,
    `${email} · ${code}`,
  );
  revalidatePath("/[locale]/admin/affiliates", "page");
  return { code };
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
  revalidatePath("/[locale]/admin/affiliates", "page");
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

export async function adminSaveCountryPolicyOverride(formData: FormData) {
  const admin = await requireAdmin();
  const country = String(formData.get("country") ?? "")
    .trim()
    .toUpperCase();
  if (!country) return;

  const displayName = String(formData.get("displayName") ?? "").trim();
  const marketStatusValue = String(formData.get("marketStatus") ?? "").trim();
  const marketStatus = COUNTRY_MARKET_STATUSES.includes(
    marketStatusValue as CountryPolicyStatus,
  )
    ? (marketStatusValue as CountryPolicyStatus)
    : "review";
  const reviewNote = String(formData.get("reviewNote") ?? "").trim();
  const checkoutMethods = parseEnumList(
    formData.getAll("checkoutMethods"),
    CHECKOUT_METHODS,
  );
  const payoutMethods = parseEnumList(
    formData.getAll("payoutMethods"),
    PAYOUT_METHODS,
  );

  await prisma.countryPolicyOverride.upsert({
    where: { country },
    create: {
      country,
      displayName: displayName || null,
      marketStatus,
      publicAccess: parseBooleanInput(formData.get("publicAccess")),
      challengePurchasesEnabled: parseBooleanInput(
        formData.get("challengePurchasesEnabled"),
      ),
      payoutsEnabled: parseBooleanInput(formData.get("payoutsEnabled")),
      requiresReviewNotice: parseBooleanInput(
        formData.get("requiresReviewNotice"),
      ),
      reviewNote: reviewNote || null,
      overrideCheckoutMethods: true,
      checkoutMethods,
      overridePayoutMethods: true,
      payoutMethods,
      showExactCommercialTerms: parseBooleanInput(
        formData.get("showExactCommercialTerms"),
      ),
      affiliateProgramEnabled: parseBooleanInput(
        formData.get("affiliateProgramEnabled"),
      ),
      giftsEnabled: parseBooleanInput(formData.get("giftsEnabled")),
      showProcessorNames: parseBooleanInput(formData.get("showProcessorNames")),
      legalApproved: parseBooleanInput(formData.get("legalApproved")),
      pspApproved: parseBooleanInput(formData.get("pspApproved")),
      copyApproved: parseBooleanInput(formData.get("copyApproved")),
      kycEnabled: parseBooleanInput(formData.get("kycEnabled")),
    },
    update: {
      displayName: displayName || null,
      marketStatus,
      publicAccess: parseBooleanInput(formData.get("publicAccess")),
      challengePurchasesEnabled: parseBooleanInput(
        formData.get("challengePurchasesEnabled"),
      ),
      payoutsEnabled: parseBooleanInput(formData.get("payoutsEnabled")),
      requiresReviewNotice: parseBooleanInput(
        formData.get("requiresReviewNotice"),
      ),
      reviewNote: reviewNote || null,
      overrideCheckoutMethods: true,
      checkoutMethods,
      overridePayoutMethods: true,
      payoutMethods,
      showExactCommercialTerms: parseBooleanInput(
        formData.get("showExactCommercialTerms"),
      ),
      affiliateProgramEnabled: parseBooleanInput(
        formData.get("affiliateProgramEnabled"),
      ),
      giftsEnabled: parseBooleanInput(formData.get("giftsEnabled")),
      showProcessorNames: parseBooleanInput(formData.get("showProcessorNames")),
      legalApproved: parseBooleanInput(formData.get("legalApproved")),
      pspApproved: parseBooleanInput(formData.get("pspApproved")),
      copyApproved: parseBooleanInput(formData.get("copyApproved")),
      kycEnabled: parseBooleanInput(formData.get("kycEnabled")),
    },
  });

  await audit(
    admin.id,
    "save_country_policy_override",
    "country_policy",
    country,
    `status=${marketStatus}; checkout=${checkoutMethods.join(",")}; payouts=${payoutMethods.join(",")}`,
  );
  await recordOpsEvent({
    type: "country_policy_override_saved",
    source: "action:admin",
    actorUserId: admin.id,
    subjectType: "country_policy",
    subjectId: country,
    country,
    details: {
      marketStatus,
      publicAccess: parseBooleanInput(formData.get("publicAccess")),
      challengePurchasesEnabled: parseBooleanInput(
        formData.get("challengePurchasesEnabled"),
      ),
      payoutsEnabled: parseBooleanInput(formData.get("payoutsEnabled")),
      checkoutMethods,
      payoutMethods,
    },
  });
  revalidatePath("/[locale]/admin/launch", "page");
}

export async function adminDeleteCountryPolicyOverride(country: string) {
  const admin = await requireAdmin();
  const normalizedCountry = country.trim().toUpperCase();
  if (!normalizedCountry) return;

  await prisma.countryPolicyOverride.deleteMany({
    where: { country: normalizedCountry },
  });
  await audit(
    admin.id,
    "delete_country_policy_override",
    "country_policy",
    normalizedCountry,
  );
  await recordOpsEvent({
    type: "country_policy_override_deleted",
    source: "action:admin",
    actorUserId: admin.id,
    subjectType: "country_policy",
    subjectId: normalizedCountry,
    country: normalizedCountry,
  });
  revalidatePath("/[locale]/admin/launch", "page");
}
