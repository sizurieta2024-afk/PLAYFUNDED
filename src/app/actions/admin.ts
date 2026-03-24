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
import { settlePendingPick } from "@/lib/settlement/settle-service";
import type { SettleStatus } from "@/lib/settlement/settle";

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
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  let code = "PF-";
  for (let i = 0; i < 6; i += 1) {
    code += chars[bytes[i] % chars.length];
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

export async function adjustChallengeBalance(
  challengeId: string,
  deltaUsd: number, // positive = credit, negative = debit
  note: string,
): Promise<{ error?: string }> {
  const admin = await requireAdmin();

  if (!note?.trim()) return { error: "Note is required" };
  if (deltaUsd === 0) return { error: "Delta cannot be zero" };

  const deltaCents = Math.round(deltaUsd * 100);

  const challenge = await prisma.challenge.findUnique({
    where: { id: challengeId },
    select: { balance: true },
  });
  if (!challenge) return { error: "Challenge not found" };

  const newBalance = challenge.balance + deltaCents;
  if (newBalance < 0)
    return { error: "Adjustment would result in negative balance" };

  await prisma.challenge.update({
    where: { id: challengeId },
    data: { balance: newBalance },
  });
  await audit(
    admin.id,
    "adjust_balance",
    "challenge",
    challengeId,
    `balance ${deltaCents > 0 ? "+" : ""}${deltaCents} cents: ${note}`,
  );
  revalidatePath("/admin/challenges");
  return {};
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
              ? (result.error ?? "payout_provider_error")
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

export async function adminReviewAffiliateApplication(
  applicationId: string,
  action: "approve" | "reject",
  opts: {
    rate?: AffiliateCommissionRate;
    discountPct?: number;
    reviewNote?: string;
  } = {},
): Promise<{ error?: string; code?: string }> {
  const admin = await requireAdmin();

  const app = await prisma.affiliateApplication.findUnique({
    where: { id: applicationId },
    select: { id: true, userId: true, status: true },
  });
  if (!app || app.status !== "pending")
    return { error: "not_found_or_not_pending" };

  if (action === "reject") {
    await prisma.affiliateApplication.update({
      where: { id: applicationId },
      data: {
        status: "rejected",
        reviewNote: opts.reviewNote ?? null,
        reviewedAt: new Date(),
        reviewedByAdminId: admin.id,
      },
    });
    await audit(
      admin.id,
      "reject_affiliate_application",
      "affiliate",
      applicationId,
      opts.reviewNote,
    );
    revalidatePath("/[locale]/admin/affiliates", "page");
    return {};
  }

  // Approve: create the Affiliate record
  const existing = await prisma.affiliate.findUnique({
    where: { userId: app.userId },
    select: { code: true },
  });
  if (existing) {
    // Already an affiliate — just mark approved
    await prisma.affiliateApplication.update({
      where: { id: applicationId },
      data: {
        status: "approved",
        reviewedAt: new Date(),
        reviewedByAdminId: admin.id,
      },
    });
    return { code: existing.code };
  }

  let code = generateAffiliateCode();
  for (let i = 0; i < 5; i++) {
    if (!(await prisma.affiliate.findUnique({ where: { code } }))) break;
    code = generateAffiliateCode();
  }

  const affiliate = await prisma.affiliate.create({
    data: {
      userId: app.userId,
      code,
      commissionRate: opts.rate ?? "five",
      discountPct: Math.max(
        0,
        Math.min(100, Math.floor(opts.discountPct ?? 0)),
      ),
      isActive: true,
    },
  });

  await prisma.affiliateApplication.update({
    where: { id: applicationId },
    data: {
      status: "approved",
      reviewedAt: new Date(),
      reviewedByAdminId: admin.id,
    },
  });
  await audit(
    admin.id,
    "approve_affiliate_application",
    "affiliate",
    affiliate.id,
    `code: ${code}`,
  );
  revalidatePath("/[locale]/admin/affiliates", "page");
  return { code };
}

export async function adminReviewCodeChangeRequest(
  requestId: string,
  action: "approve" | "reject",
  reviewNote?: string,
): Promise<{ error?: string }> {
  const admin = await requireAdmin();

  const req = await prisma.affiliateCodeChangeRequest.findUnique({
    where: { id: requestId },
    select: { id: true, affiliateId: true, requestedCode: true, status: true },
  });
  if (!req || req.status !== "pending")
    return { error: "not_found_or_not_pending" };

  if (action === "reject") {
    await prisma.affiliateCodeChangeRequest.update({
      where: { id: requestId },
      data: {
        status: "rejected",
        reviewNote: reviewNote ?? null,
        reviewedAt: new Date(),
        reviewedByAdminId: admin.id,
      },
    });
    await audit(
      admin.id,
      "reject_code_change",
      "affiliate",
      req.affiliateId,
      reviewNote,
    );
    revalidatePath("/[locale]/admin/affiliates", "page");
    return {};
  }

  // Check code not taken by someone else
  const taken = await prisma.affiliate.findFirst({
    where: { code: req.requestedCode, id: { not: req.affiliateId } },
    select: { id: true },
  });
  if (taken) {
    await prisma.affiliateCodeChangeRequest.update({
      where: { id: requestId },
      data: {
        status: "rejected",
        reviewNote: "Code already taken",
        reviewedAt: new Date(),
        reviewedByAdminId: admin.id,
      },
    });
    return { error: "code_taken" };
  }

  await prisma.$transaction([
    prisma.affiliate.update({
      where: { id: req.affiliateId },
      data: { code: req.requestedCode },
    }),
    prisma.affiliateCodeChangeRequest.update({
      where: { id: requestId },
      data: {
        status: "approved",
        reviewedAt: new Date(),
        reviewedByAdminId: admin.id,
      },
    }),
  ]);

  await audit(
    admin.id,
    "approve_code_change",
    "affiliate",
    req.affiliateId,
    `new code: ${req.requestedCode}`,
  );
  revalidatePath("/[locale]/admin/affiliates", "page");
  return {};
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

// ── Messaging ─────────────────────────────────────────────────────────

export async function adminSendUserEmail(
  userId: string,
  subject: string,
  body: string,
): Promise<{ error?: string }> {
  const admin = await requireAdmin();

  if (!subject.trim()) return { error: "Subject is required" };
  if (subject.length > 200)
    return { error: "Subject must be 200 characters or fewer" };
  if (!body.trim()) return { error: "Body is required" };

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, name: true },
  });
  if (!user) return { error: "User not found" };

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"/></head><body style="font-family:sans-serif;background:#0a0a0a;color:#e5e5e5;padding:32px">
    <div style="max-width:560px;margin:0 auto;background:#141414;border:1px solid #262626;border-radius:12px;padding:28px 32px">
      <p style="white-space:pre-wrap;font-size:14px;line-height:1.6;color:#a3a3a3">${body.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>
      <hr style="border:none;border-top:1px solid #262626;margin:20px 0"/>
      <p style="font-size:11px;color:#525252">PlayFunded · La plataforma de trading deportivo para América Latina</p>
    </div>
  </body></html>`;

  await sendEmail(user.email, subject, html);
  await audit(
    admin.id,
    "admin_send_user_email",
    "user",
    userId,
    `subject: ${subject}`,
  );
  return {};
}

export async function adminSendBlast(
  segment: "all" | "active_challenge" | "funded",
  subject: string,
  body: string,
): Promise<{ count: number; error?: string }> {
  const admin = await requireAdmin();

  if (!subject.trim()) return { count: 0, error: "Subject is required" };
  if (subject.length > 200)
    return { count: 0, error: "Subject must be 200 characters or fewer" };
  if (!body.trim()) return { count: 0, error: "Body is required" };

  let userEmails: Array<{ id: string; email: string }> = [];

  if (segment === "all") {
    userEmails = await prisma.user.findMany({
      where: { isBanned: false },
      select: { id: true, email: true },
    });
  } else if (segment === "active_challenge") {
    const challenges = await prisma.challenge.findMany({
      where: { status: "active" },
      select: { user: { select: { id: true, email: true } } },
      distinct: ["userId"],
    });
    userEmails = challenges.map((c) => c.user);
  } else if (segment === "funded") {
    const challenges = await prisma.challenge.findMany({
      where: { status: "funded" },
      select: { user: { select: { id: true, email: true } } },
      distinct: ["userId"],
    });
    userEmails = challenges.map((c) => c.user);
  }

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"/></head><body style="font-family:sans-serif;background:#0a0a0a;color:#e5e5e5;padding:32px">
    <div style="max-width:560px;margin:0 auto;background:#141414;border:1px solid #262626;border-radius:12px;padding:28px 32px">
      <p style="white-space:pre-wrap;font-size:14px;line-height:1.6;color:#a3a3a3">${body.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>
      <hr style="border:none;border-top:1px solid #262626;margin:20px 0"/>
      <p style="font-size:11px;color:#525252">PlayFunded · La plataforma de trading deportivo para América Latina</p>
    </div>
  </body></html>`;

  let sent = 0;
  for (const user of userEmails) {
    await sendEmail(user.email, subject, html);
    sent += 1;
  }

  await audit(
    admin.id,
    "admin_send_blast",
    "blast",
    segment,
    `subject: ${subject}; sent: ${sent}`,
  );
  return { count: sent };
}

// ── Picks ─────────────────────────────────────────────────────────────

export async function adminSettlePick(
  pickId: string,
  status: SettleStatus,
  note: string,
): Promise<{ error?: string }> {
  const admin = await requireAdmin();
  if (!note?.trim()) return { error: "Note is required" };

  const result = await settlePendingPick(prisma, {
    pickId,
    status,
    settledAt: new Date(),
  });

  if (!result.ok) {
    return { error: result.error };
  }

  await audit(
    admin.id,
    "admin_settle_pick",
    "pick",
    pickId,
    `status → ${status}: ${note}`,
  );
  revalidatePath("/admin/picks");
  return {};
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
