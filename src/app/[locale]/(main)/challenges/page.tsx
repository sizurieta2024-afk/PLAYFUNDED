import { getTranslations } from "next-intl/server";
import { headers } from "next/headers";
import { createServerClient } from "@/lib/supabase";
import { formatLocalPrice, getCurrencyForCountry } from "@/lib/exchangerates";
import { resolveCountry } from "@/lib/country-policy";
import { getResolvedCountryPolicy } from "@/lib/country-policy-store";
import { getActiveTiers } from "@/lib/catalog";
import { isStripeCheckoutEnabled } from "@/lib/stripe";
import { TierCard } from "@/components/challenges/TierCard";
import type { Metadata } from "next";
import { withBrandMetadata } from "@/lib/metadata";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "challenges" });
  return withBrandMetadata(
    {
      title: t("pageTitle"),
      description: t("pageSubtitle"),
      openGraph: {
        title: t("pageTitle"),
        description: t("pageSubtitle"),
        type: "website",
      },
    },
    { locale, path: "/challenges" },
  );
}

export default async function ChallengesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "challenges" });

  // Detect country for geo-specific payment methods (e.g. Pix for Brazil)
  const headersList = await headers();
  const country =
    resolveCountry(
      headersList.get("x-vercel-ip-country"),
      headersList.get("cf-ipcountry"),
    ) ?? undefined;
  const countryPolicy = await getResolvedCountryPolicy(country);
  const stripeCheckoutEnabled = isStripeCheckoutEnabled();
  const availablePaymentMethods = countryPolicy.checkoutMethods.reduce<
    Array<"stripe" | "crypto" | "pix">
  >((methods, method) => {
    if (method === "card" && stripeCheckoutEnabled) methods.push("stripe");
    if (method === "pix" && stripeCheckoutEnabled) methods.push("pix");
    if (method === "crypto") methods.push(method);
    return methods;
  }, []);
  const reviewNotice = countryPolicy.requiresReviewNotice
    ? t("countryPolicyReview")
    : null;

  // Fetch tiers and current user in parallel
  const [tiers, supabase] = await Promise.all([
    getActiveTiers(),
    createServerClient(),
  ]);

  const {
    data: { user: authUser },
    error: authError,
  } = await supabase.auth.getUser();

  const isAuthenticated = !authError && !!authUser;
  const localCurrencyCode = getCurrencyForCountry(country);
  const localFeeByTier = new Map<string, string>();
  if (localCurrencyCode) {
    const localFees = await Promise.all(
      tiers.map(async (tier) => ({
        tierId: tier.id,
        label: await formatLocalPrice(tier.fee, localCurrencyCode),
      })),
    );
    for (const row of localFees) {
      if (row.label) {
        localFeeByTier.set(row.tierId, row.label);
      }
    }
  }

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
        <h1 className="font-display font-bold font-serif italic text-4xl sm:text-5xl tracking-tight text-foreground">
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
              country={country}
              localFeeLabel={localFeeByTier.get(tier.id)}
              availablePaymentMethods={availablePaymentMethods}
              giftsEnabled={countryPolicy.marketing.giftsEnabled}
              reviewNotice={reviewNotice}
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
                pix: t("pix"),
                pixDesc: t("pixDesc"),
                sendAsGift: t("sendAsGift"),
                giftRecipientEmailPlaceholder: t(
                  "giftRecipientEmailPlaceholder",
                ),
                giftStripeOnly: t("giftStripeOnly"),
                paymentMethodUnavailable: t("paymentMethodUnavailable"),
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
