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
  return {
    title: `${t("pageTitle")} | PlayFunded`,
    description: t("pageSubtitle"),
    openGraph: {
      title: `${t("pageTitle")} | PlayFunded`,
      description: t("pageSubtitle"),
      type: "website",
      url: "https://playfunded.lat/how-it-works",
    },
  };
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
      num: "01",
      phase: "Phase 1",
      target: "+20%",
      targetLabel: t("phase1_target_label"),
      accent: "pf-brand" as const,
      key: "phase1",
    },
    {
      num: "02",
      phase: "Phase 2",
      target: "+20%",
      targetLabel: t("phase2_target_label"),
      accent: "pf-brand" as const,
      key: "phase2",
    },
    {
      num: "03",
      phase: t("funded"),
      target: "70–80%",
      targetLabel: t("funded_split_label"),
      accent: "pf-pink" as const,
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
      </div>

      {/* Phase journey */}
      <section className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-6 h-px bg-pf-brand flex-shrink-0" />
          <span className="font-mono text-[10px] text-pf-brand uppercase tracking-[0.15em]">
            {t("journey_eyebrow")}
          </span>
        </div>
        <h2 className="font-display font-bold text-2xl sm:text-3xl text-foreground">
          {t("journey_title")}
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-border rounded-2xl overflow-hidden">
          {phases.map(
            ({ num, phase, target, targetLabel, accent, key }, idx) => {
              const isLast = idx === phases.length - 1;
              const accentText =
                accent === "pf-pink" ? "text-pf-pink" : "text-pf-brand";
              const accentBorder =
                accent === "pf-pink"
                  ? "border-pf-pink/20"
                  : "border-pf-brand/20";
              const accentBg =
                accent === "pf-pink"
                  ? "bg-pf-pink/[0.04]"
                  : "bg-pf-brand/[0.04]";
              const accentDot =
                accent === "pf-pink" ? "bg-pf-pink" : "bg-pf-brand";
              return (
                <div
                  key={key}
                  className={`relative bg-card p-7 flex flex-col gap-4 ${isLast ? "border-t md:border-t-0 md:border-l border-border" : ""}`}
                >
                  {/* Step number */}
                  <div className="flex items-center justify-between">
                    <span
                      className={`font-mono text-[11px] font-bold uppercase tracking-[0.15em] ${accentText}`}
                    >
                      {num}
                    </span>
                    <div className={`w-1.5 h-1.5 rounded-full ${accentDot}`} />
                  </div>

                  {/* Phase name */}
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1 font-mono">
                      {phase}
                    </p>
                    {/* Big metric */}
                    <p
                      className={`font-serif italic text-[2.8rem] leading-none font-normal ${accentText}`}
                    >
                      {target}
                    </p>
                    <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.1em] mt-1">
                      {targetLabel}
                    </p>
                  </div>

                  {/* Divider */}
                  <div
                    className={`h-px ${accentBg} border-t ${accentBorder}`}
                  />

                  {/* Description */}
                  <p className="text-sm text-muted-foreground leading-relaxed flex-1">
                    {key === "funded" && !hasExactCommercialTerms
                      ? t("funded_desc_review")
                      : t(`${key}_desc` as Parameters<typeof t>[0])}
                  </p>
                </div>
              );
            },
          )}
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
          {(hasExactCommercialTerms
            ? ["payout_kyc", "payout_methods", "payout_timing", "payout_split"]
            : ["payout_kyc", "payout_methods"]
          ).map((k) => (
            <li
              key={k}
              className="flex items-start gap-2 text-sm text-muted-foreground"
            >
              <span className="text-pf-brand mt-0.5">✓</span>
              {k === "payout_methods" && !policy.marketing.showProcessorNames
                ? t("payout_methods_review")
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
              name: t("sport_soccer"),
              detail: t("sport_soccer_detail"),
            },
            {
              emoji: "🏀",
              name: t("sport_basketball"),
              detail: t("sport_basketball_detail"),
            },
            {
              emoji: "🏈",
              name: t("sport_nfl"),
              detail: t("sport_nfl_detail"),
            },
            {
              emoji: "🎾",
              name: t("sport_tennis"),
              detail: t("sport_tennis_detail"),
            },
            {
              emoji: "🥊",
              name: t("sport_mma"),
              detail: t("sport_mma_detail"),
            },
            {
              emoji: "📊",
              name: t("sport_markets"),
              detail: t("sport_markets_detail"),
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
