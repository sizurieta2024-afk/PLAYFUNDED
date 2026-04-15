import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { createServerClient } from "@/lib/supabase";
import { getAffiliateData } from "@/app/actions/affiliate";
import { AffiliateClient } from "@/components/affiliate/AffiliateClient";
import { AffiliateApplyClient } from "@/components/affiliate/AffiliateApplyClient";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://playfunded.lat";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "affiliate" });
  return { title: `${t("pageTitle")} | PlayFunded` };
}

export default async function AffiliateDashboardPage() {
  const supabase = await createServerClient();
  const {
    data: { user: authUser },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !authUser) redirect("/auth/login");

  const t = await getTranslations("affiliate");

  const { affiliate, application } = await getAffiliateData();

  // Build translation records for client components
  const tClient: Record<string, string> = {};
  const tApply: Record<string, string> = {};

  const clientKeys = [
    "yourCode",
    "referralLink",
    "copyLink",
    "copied",
    "totalClicks",
    "totalConversions",
    "totalEarned",
    "pendingPayout",
    "discountOffered",
    "commissionRate",
    "conversionsHistory",
    "noConversions",
    "changeCode",
    "changeCodeDesc",
    "changeCodePlaceholder",
    "requestChange",
    "pendingCodeRequest",
    "codeChangeSuccess",
    "codeChangePending",
    "codeTaken",
    "sameCode",
    "invalidCode",
    "inactiveNotice",
  ] as const;

  const applyKeys = [
    "applyTitle",
    "applyDesc",
    "applyButton",
    "applicationPending",
    "applicationRejected",
    "rejectionNote",
    "formFullName",
    "formCountry",
    "formReason",
    "formReasonPlaceholder",
    "formSocialTiktok",
    "formSocialInstagram",
    "formSocialTwitter",
    "formSocialYoutube",
    "formAudienceSize",
    "formWebsite",
    "formSubmit",
    "formSubmitting",
    "submitSuccess",
    "submitError",
    "audienceUnder1k",
    "audience1k5k",
    "audience5k20k",
    "audience20kPlus",
  ] as const;

  for (const k of clientKeys) tClient[k] = t(k);
  for (const k of applyKeys) tApply[k] = t(k);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold">{t("pageTitle")}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t("pageDesc")}</p>
      </div>

      {affiliate ? (
        <AffiliateClient
          affiliate={{
            ...affiliate,
            commissionRate: affiliate.commissionRate as string,
            createdAt: affiliate.createdAt.toISOString(),
            conversions: affiliate.conversions.map((c) => ({
              ...c,
              createdAt: c.createdAt.toISOString(),
            })),
            codeRequests: affiliate.codeRequests.map((r) => ({
              ...r,
              createdAt: r.createdAt.toISOString(),
            })),
          }}
          appUrl={APP_URL}
          t={tClient}
        />
      ) : (
        <AffiliateApplyClient
          application={
            application
              ? {
                  ...application,
                  createdAt: application.createdAt.toISOString(),
                }
              : null
          }
          t={tApply}
        />
      )}
    </div>
  );
}
