import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { createServerClient } from "@/lib/supabase";
import { AffiliateClient } from "@/components/affiliate/AffiliateClient";

export default async function AffiliatePage() {
  const t = await getTranslations("affiliate");

  const supabase = createServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) redirect("/auth/login");

  const user = await prisma.user.findFirst({
    where: { supabaseId: session.user.id },
    select: { id: true },
  });
  if (!user) redirect("/auth/login");

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

      <AffiliateClient affiliate={serialized} appUrl={appUrl} />
    </div>
  );
}
