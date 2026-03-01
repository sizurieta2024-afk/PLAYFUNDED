import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { createServerClient } from "@/lib/supabase";
import { TierCard } from "@/components/challenges/TierCard";
import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "challenges" });
  return { title: t("pageTitle") };
}

export default async function ChallengesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "challenges" });

  // Fetch tiers and current user in parallel
  const [tiers, supabase] = await Promise.all([
    prisma.tier.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
    }),
    createServerClient(),
  ]);

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const isAuthenticated = !!session;

  const tierDescriptions: Record<string, string> = {
    Starter: t("starterDesc"),
    Pro: t("proDesc"),
    Elite: t("eliteDesc"),
    Master: t("masterDesc"),
    Legend: t("legendDesc"),
  };

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16">
      {/* Header */}
      <div className="text-center space-y-4 mb-14">
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-foreground">
          {t("pageTitle")}
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          {t("pageSubtitle")}
        </p>
      </div>

      {/* Tier grid — 1 col → 2 col → 3+2 centered → 5 in a row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 xl:grid-cols-5 gap-4">
        {tiers.map((tier, index) => (
          <div
            key={tier.id}
            className={`md:col-span-2 xl:col-span-1${index === 3 ? " md:col-start-2 xl:col-start-auto" : ""}`}
          >
            <TierCard
              tier={tier}
              isAuthenticated={isAuthenticated}
              locale={locale}
              description={tierDescriptions[tier.name] ?? ""}
              t={{
                fundedBankroll: t("fundedBankroll"),
                profitSplit: t("profitSplit"),
                entryFee: t("entryFee"),
                minPicks: t("minPicks"),
                guideIncluded: t("guideIncluded"),
                buyButton: t("buyButton"),
                popular: t("popular"),
                phase1Target: t("phase1Target"),
                phase2Target: t("phase2Target"),
                dailyLoss: t("dailyLoss"),
                drawdown: t("drawdown"),
                loginRequired: t("loginRequired"),
                redirecting: t("redirecting"),
                yes: t("yes"),
                no: t("no"),
                selectPaymentMethod: t("selectPaymentMethod"),
                card: t("card"),
                crypto: t("crypto"),
                cryptoSelectCurrency: t("cryptoSelectCurrency"),
                usdt: t("usdt"),
                usdc: t("usdc"),
                btc: t("btc"),
                payWith: t("payWith"),
              }}
            />
          </div>
        ))}
      </div>

      {/* Rules footer note */}
      <div className="mt-14 rounded-xl border border-border bg-muted/40 p-6 text-sm text-muted-foreground space-y-1.5 max-w-3xl mx-auto">
        <p className="font-semibold text-foreground">{t("rulesTitle")}</p>
        <p>
          {t("phase1Target")} · {t("phase2Target")}
        </p>
        <p>
          {t("dailyLoss")} · {t("drawdown")}
        </p>
      </div>
    </div>
  );
}
