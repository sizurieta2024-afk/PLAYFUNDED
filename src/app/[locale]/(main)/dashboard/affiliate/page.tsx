import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { createServerClient } from "@/lib/supabase";
import { AffiliateClient } from "@/components/affiliate/AffiliateClient";
import { resolvePayoutCountry } from "@/lib/payout-options";
import { getResolvedCountryPolicy } from "@/lib/country-policy-store";

export default async function AffiliatePage() {
  const t = await getTranslations("affiliate");

  const supabase = await createServerClient();
  const {
    data: { user: authUser },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !authUser) redirect("/auth/login");

  const user = await prisma.user.findFirst({
    where: { supabaseId: authUser.id },
    select: {
      id: true,
      country: true,
      kycSubmission: {
        select: {
          country: true,
        },
      },
    },
  });
  if (!user) redirect("/auth/login");
  const headersList = await headers();
  const headerCountry =
    headersList.get("x-vercel-ip-country") ??
    headersList.get("cf-ipcountry") ??
    null;
  const payoutCountry = resolvePayoutCountry(
    user.kycSubmission?.country,
    user.country,
    headerCountry,
  );
  const countryPolicy = await getResolvedCountryPolicy(payoutCountry);
  const availableMethods = countryPolicy.payoutMethods;

  const affiliate = await prisma.affiliate.findUnique({
    where: { userId: user.id },
    include: {
      clicks: {
        where: { convertedToUserId: { not: null } },
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
          id: true,
          conversionAmount: true,
          commissionEarned: true,
          createdAt: true,
        },
      },
    },
  });

  const serialized = affiliate
    ? {
        id: affiliate.id,
        code: affiliate.code,
        commissionRate: affiliate.commissionRate as "five" | "ten",
        totalClicks: affiliate.totalClicks,
        totalConversions: affiliate.totalConversions,
        totalEarned: affiliate.totalEarned,
        pendingPayout: affiliate.pendingPayout,
        conversions: affiliate.clicks.map((c) => ({
          id: c.id,
          conversionAmount: c.conversionAmount,
          commissionEarned: c.commissionEarned,
          createdAt: c.createdAt.toISOString(),
        })),
      }
    : null;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://playfunded.com";

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">{t("pageTitle")}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t("pageSubtitle")}</p>
      </div>

      <AffiliateClient
        affiliate={serialized}
        appUrl={appUrl}
        payoutCountry={payoutCountry}
        availableMethods={availableMethods}
        affiliateEnabled={countryPolicy.marketing.affiliateProgramEnabled}
        reviewNote={countryPolicy.requiresReviewNotice ? countryPolicy.reviewNote : null}
      />
    </div>
  );
}
