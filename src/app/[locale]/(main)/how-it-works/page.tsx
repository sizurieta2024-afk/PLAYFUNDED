import { Link } from "@/i18n/navigation";
import { getTranslations } from "next-intl/server";
import { headers } from "next/headers";
import { resolveCountry } from "@/lib/country-policy";
import { getResolvedCountryPolicy } from "@/lib/country-policy-store";
import { PLATFORM_POLICY, getPayoutWindowLabel } from "@/lib/platform-policy";
import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "howItWorks" });
  return { title: t("pageTitle"), description: t("pageSubtitle") };
}

export default async function HowItWorksPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "howItWorks" });
  const headersList = await headers();
  const country = resolveCountry(
    headersList.get("x-vercel-ip-country"),
    headersList.get("cf-ipcountry"),
  );
  const policy = await getResolvedCountryPolicy(country);
  const hasExactCommercialTerms = policy.marketing.showExactCommercialTerms;

  const phases = [
    {
      phase: "Phase 1",
      target: "+20%",
      color: "text-blue-400",
      bg: "bg-blue-500/10 border-blue-500/20",
      key: "phase1",
    },
    {
      phase: "Phase 2",
      target: "+20%",
      color: "text-purple-400",
      bg: "bg-purple-500/10 border-purple-500/20",
      key: "phase2",
    },
    {
      phase: t("funded"),
      target: "70–80%",
      color: "text-pf-brand",
      bg: "bg-pf-brand/10 border-pf-brand/20",
      key: "funded",
    },
  ] as const;

  const rules = [
    { icon: "📉", key: "rule_drawdown", value: "−15%" },
    { icon: "📅", key: "rule_daily", value: "−10%" },
    { icon: "💸", key: "rule_stake", value: "5%" },
    { icon: "✅", key: "rule_picks", value: "15" },
  ] as const;

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 py-12 space-y-16">
      {/* Header */}
      <div className="text-center space-y-3">
        <h1 className="font-display font-bold font-serif italic text-4xl">
          {t("pageTitle")}
        </h1>
        <p className="text-muted-foreground text-lg max-w-xl mx-auto">
          {hasExactCommercialTerms
            ? t("pageSubtitle")
            : t("pageSubtitleReview")}
        </p>
        {policy.requiresReviewNotice && (
          <p className="text-sm text-amber-500 max-w-2xl mx-auto">
            {t("countryPolicyReview")}
          </p>
        )}
      </div>

      {/* Phase journey */}
      <section className="space-y-4">
        <h2 className="font-display font-bold text-xl font-semibold">
          {t("journey_title")}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {phases.map(({ phase, target, color, bg, key }) => (
            <div key={key} className={`rounded-xl border p-6 space-y-2 ${bg}`}>
              <p className={`font-bold text-lg ${color}`}>{phase}</p>
              <p className={`text-3xl font-extrabold ${color}`}>{target}</p>
              <p className="text-sm text-muted-foreground">
                {key === "funded" && !hasExactCommercialTerms
                  ? t("funded_desc_review")
                  : t(`${key}_desc` as Parameters<typeof t>[0])}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Rules */}
      <section className="space-y-4">
        <h2 className="font-display font-bold text-xl font-semibold">
          {t("rules_title")}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {rules.map(({ icon, key, value }) => (
            <div
              key={key}
              className="flex items-center gap-4 rounded-xl border border-border bg-card p-4"
            >
              <span className="text-2xl">{icon}</span>
              <div>
                <p className="font-semibold text-sm">
                  {t(`${key}_label` as Parameters<typeof t>[0])}
                </p>
                <p className="text-xs text-muted-foreground">
                  {value} · {t(`${key}_desc` as Parameters<typeof t>[0])}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Payouts */}
      <section className="rounded-xl border border-border bg-card p-8 space-y-4">
        <h2 className="font-display font-bold text-xl font-semibold">
          {t("payout_title")}
        </h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {hasExactCommercialTerms
            ? t("payout_desc", { payoutWindow: getPayoutWindowLabel() })
            : t("payout_desc_review")}
        </p>
        <ul className="space-y-2">
          {[
            "payout_kyc",
            "payout_methods",
            "payout_timing",
            "payout_split",
          ].map((k) => (
            <li
              key={k}
              className="flex items-start gap-2 text-sm text-muted-foreground"
            >
              <span className="text-pf-brand mt-0.5">✓</span>
              {k === "payout_methods" && !policy.marketing.showProcessorNames
                ? t("payout_methods_review")
                : k === "payout_timing"
                  ? t(
                      hasExactCommercialTerms
                        ? "payout_timing"
                        : "payout_timing_review",
                      {
                        payoutWindow: getPayoutWindowLabel(),
                      },
                    )
                  : k === "payout_split" && !hasExactCommercialTerms
                    ? t("payout_split_review")
                    : t(k as Parameters<typeof t>[0], {
                        payoutWindow: getPayoutWindowLabel(),
                        drawdownPct: PLATFORM_POLICY.risk.drawdownLimitPct,
                        dailyLossPct: PLATFORM_POLICY.risk.dailyLossLimitPct,
                      })}
            </li>
          ))}
        </ul>
      </section>

      {/* Sports */}
      <section className="space-y-4">
        <h2 className="font-display font-bold text-xl font-semibold">
          {t("sports_title")}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            {
              emoji: "⚽",
              name: "Soccer",
              detail: "Liga MX · Libertadores · Premier League",
            },
            { emoji: "🏀", name: "Basketball", detail: "NBA" },
            { emoji: "🏈", name: "NFL", detail: "American Football" },
            { emoji: "🎾", name: "Tennis", detail: "ATP · WTA" },
            { emoji: "🥊", name: "MMA", detail: "UFC · Bellator" },
            {
              emoji: "📊",
              name: "Markets",
              detail: "Moneyline · Spread · Totals",
            },
          ].map(({ emoji, name, detail }) => (
            <div
              key={name}
              className="rounded-xl border border-border bg-card p-4 flex items-center gap-3"
            >
              <span className="text-2xl">{emoji}</span>
              <div>
                <p className="font-medium text-sm">{name}</p>
                <p className="text-xs text-muted-foreground">{detail}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <div className="text-center">
        <Link
          href="/challenges"
          className="px-8 py-3 rounded-xl bg-pf-pink hover:bg-pf-pink-dark text-white font-semibold transition-colors"
        >
          {t("cta")}
        </Link>
      </div>
    </div>
  );
}
