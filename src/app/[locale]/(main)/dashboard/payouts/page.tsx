import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { headers } from "next/headers";
import { createServerClient } from "@/lib/supabase";
import { prisma } from "@/lib/prisma";
import { PayoutsClient } from "@/components/payout/PayoutsClient";
import { resolveCountry } from "@/lib/country-policy";
import { resolvePayoutCountry } from "@/lib/payout-options";
import { getResolvedCountryPolicy } from "@/lib/country-policy-store";
import { PLATFORM_POLICY, getPayoutWindowLabel } from "@/lib/platform-policy";
import { evaluateKycPayoutEligibility } from "@/lib/kyc/eligibility";
import type { Metadata } from "next";
import { buildLoginPath } from "@/i18n/navigation";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "payouts" });
  return { title: t("pageTitle") };
}

export default async function PayoutsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  const supabase = await createServerClient();
  const {
    data: { user: authUser },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !authUser) redirect(buildLoginPath(locale));

  const user = await prisma.user.findFirst({
    where: { supabaseId: authUser.id },
    include: { kycSubmission: true },
  });
  if (!user) redirect(buildLoginPath(locale));

  const t = await getTranslations({ locale, namespace: "payouts" });
  const tKyc = await getTranslations({ locale, namespace: "kyc" });
  const headersList = await headers();
  const headerCountry = resolveCountry(
    headersList.get("x-vercel-ip-country"),
    headersList.get("cf-ipcountry"),
  );
  const payoutCountry = resolvePayoutCountry(
    user.kycSubmission?.country,
    user.country,
    headerCountry,
  );
  const countryPolicy = await getResolvedCountryPolicy(payoutCountry);
  const availableMethods = countryPolicy.payoutMethods;

  // All funded challenges
  const challenges = await prisma.challenge.findMany({
    where: { userId: user.id, status: "funded" },
    include: { tier: true },
    orderBy: { fundedAt: "desc" },
  });

  // All past payouts for this user
  const payouts = await prisma.payout.findMany({
    where: { userId: user.id },
    orderBy: { requestedAt: "desc" },
    take: 50,
  });

  const kycStatus = user.kycSubmission?.status ?? null;

  const fundedChallenges = challenges.map((c) => ({
    id: c.id,
    balance: c.balance,
    startBalance: c.startBalance,
    tier: {
      profitSplitPct: c.tier.profitSplitPct,
      name: c.tier.name,
    },
  }));

  const kycEligibility = evaluateKycPayoutEligibility({
    kycStatus,
    payoutsEnabled: countryPolicy.payoutsEnabled,
    fundedChallenges,
  });

  const pastPayouts = payouts.map((p) => ({
    id: p.id,
    amount: p.amount,
    splitPct: p.splitPct,
    method: p.method,
    status: p.status,
    isRollover: p.isRollover,
    requestedAt: p.requestedAt.toISOString(),
    txRef: p.txRef,
    adminNote: p.adminNote,
  }));

  // Build translation objects
  const tObj: Record<string, string> = {
    noPayout: t("noPayout"),
    buyChallenge: t("buyChallenge"),
    availableProfit: t("availableProfit"),
    yourSplit: t("yourSplit", { pct: "{pct}" }),
    payoutAmount: t("payoutAmount"),
    requestPayout: t("requestPayout"),
    rollover: t("rollover"),
    rolloverDesc: t("rolloverDesc"),
    rolloverConfirm: t("rolloverConfirm"),
    payoutMethod: t("payoutMethod"),
    submitting: t("submitting"),
    submitted: t("submitted"),
    history: t("history"),
    noPastPayouts: t("noPastPayouts"),
    status_pending: t("status_pending"),
    status_processing: t("status_processing"),
    status_paid: t("status_paid"),
    status_failed: t("status_failed"),
    isRollover: t("isRollover"),
    date: t("date"),
    amount: t("amount"),
    method: t("method"),
    txRef: t("txRef"),
    adminNote: t("adminNote"),
    kycRequired: t("kycRequired"),
    kycRequiredDesc: t("kycRequiredDesc"),
    kycPending: t("kycPending"),
    kycPendingDesc: t("kycPendingDesc"),
    kycRejected: t("kycRejected"),
    kycRejectedDesc: t("kycRejectedDesc"),
    profitZero: t("profitZero"),
    pendingExists: t("pendingExists"),
    methodUnavailable: t("methodUnavailable"),
    countryPolicyReview: t("countryPolicyReview"),
    windowNotice: t("windowNotice", { payoutWindow: getPayoutWindowLabel() }),
    windowClosed: t("windowClosed", { payoutWindow: getPayoutWindowLabel() }),
    belowMinimum: t("belowMinimum", {
      amount: PLATFORM_POLICY.payouts.minimumCents / 100,
    }),
    bankDlocal: t("bankDlocal"),
    bankPixDlocal: t("bankPixDlocal"),
    usdSettlementNote: t("usdSettlementNote", {
      currency: PLATFORM_POLICY.payouts.settlementCurrency,
    }),
  };

  const tKycObj: Record<string, string> = {
    title: tKyc("title"),
    subtitle: tKyc("subtitle"),
    fullName: tKyc("fullName"),
    fullNamePlaceholder: tKyc("fullNamePlaceholder"),
    dateOfBirth: tKyc("dateOfBirth"),
    country: tKyc("country"),
    countryPlaceholder: tKyc("countryPlaceholder"),
    idType: tKyc("idType"),
    passport: tKyc("passport"),
    nationalId: tKyc("nationalId"),
    driversLicense: tKyc("driversLicense"),
    idFront: tKyc("idFront"),
    idFrontDesc: tKyc("idFrontDesc"),
    idBack: tKyc("idBack"),
    idBackDesc: tKyc("idBackDesc"),
    uploadFile: tKyc("uploadFile"),
    fileUploaded: tKyc("fileUploaded"),
    submit: tKyc("submit"),
    submitting: tKyc("submitting"),
    submitted: tKyc("submitted"),
    fileTooBig: tKyc("fileTooBig"),
    fileWrongType: tKyc("fileWrongType"),
    required: tKyc("required"),
    uploadFailed: tKyc("uploadFailed"),
    fileEmpty: tKyc("fileEmpty"),
    fileBadSignature: tKyc("fileBadSignature"),
    fileNameInvalid: tKyc("fileNameInvalid"),
    fileMalwareDetected: tKyc("fileMalwareDetected"),
    scanUnavailable: tKyc("scanUnavailable"),
    alreadyApproved: tKyc("alreadyApproved"),
    pendingReview: tKyc("pendingReview"),
    payoutsDisabledCountry: tKyc("payoutsDisabledCountry"),
    noFundedChallenge: tKyc("noFundedChallenge"),
    noProfitAvailable: tKyc("noProfitAvailable"),
  };

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-display font-bold text-foreground">
          {t("pageTitle")}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t("pageSubtitle")}
        </p>
      </div>

      <PayoutsClient
        fundedChallenges={fundedChallenges}
        pastPayouts={pastPayouts}
        kycStatus={kycStatus}
        kycEligibilityCode={kycEligibility.code}
        payoutCountry={payoutCountry}
        availableMethods={availableMethods}
        complianceNotice={
          countryPolicy.requiresReviewNotice ? t("countryPolicyReview") : null
        }
        t={tObj}
        tKyc={tKycObj}
      />
    </div>
  );
}
