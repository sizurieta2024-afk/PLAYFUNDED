import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createServerClient } from "@/lib/supabase";
import { prisma } from "@/lib/prisma";
import { AffiliateClient } from "@/components/affiliate/AffiliateClient";
import { AffiliateApplyClient } from "@/components/affiliate/AffiliateApplyClient";
import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "affiliate" });
  return { title: t("pageTitle") };
}

export default async function AffiliatePage({
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

  if (authError || !authUser) redirect(`/${locale}/auth/login`);

  const dbUser = await prisma.user.findUnique({
    where: { supabaseId: authUser.id },
    select: {
      id: true,
      affiliate: {
        select: {
          id: true,
          code: true,
          discountPct: true,
          commissionRate: true,
          isActive: true,
          totalClicks: true,
          totalConversions: true,
          totalEarned: true,
          pendingPayout: true,
          createdAt: true,
          conversions: {
            select: {
              id: true,
              paidAmount: true,
              commissionEarned: true,
              createdAt: true,
            },
            orderBy: { createdAt: "desc" },
            take: 20,
          },
          codeRequests: {
            where: { status: "pending" },
            select: { id: true, requestedCode: true, createdAt: true },
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      },
      affiliateApplications: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { id: true, status: true, reviewNote: true, createdAt: true },
      },
    },
  });

  if (!dbUser) redirect(`/${locale}/auth/login`);

  const t = await getTranslations({ locale, namespace: "affiliate" });

  const tMap: Record<string, string> = {
    pageTitle: t("pageTitle"),
    pageDesc: t("pageDesc"),
    yourCode: t("yourCode"),
    referralLink: t("referralLink"),
    copyLink: t("copyLink"),
    copied: t("copied"),
    totalClicks: t("totalClicks"),
    totalConversions: t("totalConversions"),
    totalEarned: t("totalEarned"),
    pendingPayout: t("pendingPayout"),
    discountOffered: t("discountOffered"),
    commissionRate: t("commissionRate"),
    conversionsHistory: t("conversionsHistory"),
    noConversions: t("noConversions"),
    changeCode: t("changeCode"),
    changeCodeDesc: t("changeCodeDesc"),
    changeCodePlaceholder: t("changeCodePlaceholder"),
    requestChange: t("requestChange"),
    pendingCodeRequest: t("pendingCodeRequest"),
    codeChangeSuccess: t("codeChangeSuccess"),
    codeChangePending: t("codeChangePending"),
    codeTaken: t("codeTaken"),
    sameCode: t("sameCode"),
    invalidCode: t("invalidCode"),
    inactiveNotice: t("inactiveNotice"),
    applyTitle: t("applyTitle"),
    applyDesc: t("applyDesc"),
    applyButton: t("applyButton"),
    applicationPending: t("applicationPending"),
    applicationRejected: t("applicationRejected"),
    rejectionNote: t("rejectionNote"),
    formFullName: t("formFullName"),
    formCountry: t("formCountry"),
    formReason: t("formReason"),
    formReasonPlaceholder: t("formReasonPlaceholder"),
    formSocialTiktok: t("formSocialTiktok"),
    formSocialInstagram: t("formSocialInstagram"),
    formSocialTwitter: t("formSocialTwitter"),
    formSocialYoutube: t("formSocialYoutube"),
    formAudienceSize: t("formAudienceSize"),
    formWebsite: t("formWebsite"),
    formSubmit: t("formSubmit"),
    formSubmitting: t("formSubmitting"),
    submitSuccess: t("submitSuccess"),
    submitError: t("submitError"),
    audienceUnder1k: t("audienceUnder1k"),
    audience1k5k: t("audience1k5k"),
    audience5k20k: t("audience5k20k"),
    audience20kPlus: t("audience20kPlus"),
  };

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://playfunded.com";

  if (dbUser.affiliate) {
    return (
      <div className="mx-auto max-w-3xl px-4 sm:px-6 py-8 space-y-8">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">
            {t("pageTitle")}
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {t("pageDesc")}
          </p>
        </div>
        <AffiliateClient
          affiliate={dbUser.affiliate}
          appUrl={appUrl}
          t={tMap}
        />
      </div>
    );
  }

  const latestApplication = dbUser.affiliateApplications[0] ?? null;

  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-6 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">
          {t("applyTitle")}
        </h1>
        <p className="text-muted-foreground text-sm mt-0.5">{t("applyDesc")}</p>
      </div>
      <AffiliateApplyClient application={latestApplication} t={tMap} />
    </div>
  );
}
