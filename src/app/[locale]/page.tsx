import { Link } from "@/i18n/navigation";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "home" });
  return {
    title: t("meta_title"),
    description: t("meta_description"),
  };
}

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "home" });

  // Fetch active tiers for the pricing preview
  const tiers = await prisma.tier.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      name: true,
      fee: true,
      fundedBankroll: true,
      profitSplitPct: true,
    },
  });

  const steps = [
    { num: "01", key: "step1" },
    { num: "02", key: "step2" },
    { num: "03", key: "step3" },
  ] as const;

  const stats = [
    { value: "70–80%", key: "stat_split" },
    { value: "$1K–$25K", key: "stat_bankroll" },
    { value: "3–5 days", key: "stat_payout" },
    { value: "5 sports", key: "stat_sports" },
  ] as const;

  return (
    <div className="flex flex-col">
      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-background">
        <div className="absolute inset-0 bg-gradient-to-br from-pf-brand/5 via-transparent to-transparent pointer-events-none" />
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 pt-20 pb-24 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-pf-brand/10 border border-pf-brand/20 text-pf-brand text-xs font-semibold mb-6">
            {t("badge")}
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-foreground leading-tight max-w-3xl mx-auto">
            {t("hero_title_1")}{" "}
            <span className="text-pf-brand">{t("hero_title_highlight")}</span>
            {t("hero_title_2") && <>, {t("hero_title_2")}</>}
          </h1>
          <p className="mt-6 text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed">
            {t("hero_subtitle")}
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/challenges"
              className="px-7 py-3 rounded-xl bg-pf-brand hover:bg-pf-brand/90 text-white font-semibold text-sm transition-colors"
            >
              {t("hero_cta_primary")}
            </Link>
            <Link
              href="/how-it-works"
              className="px-7 py-3 rounded-xl border border-border hover:bg-secondary text-foreground font-semibold text-sm transition-colors"
            >
              {t("hero_cta_secondary")}
            </Link>
          </div>
        </div>
      </section>

      {/* ── Stats bar ─────────────────────────────────────────────────── */}
      <section className="border-y border-border bg-card/50">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {stats.map(({ value, key }) => (
              <div key={key}>
                <p className="text-2xl font-bold text-pf-brand">{value}</p>
                <p className="text-xs text-muted-foreground mt-1">{t(key)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works (summary) ────────────────────────────────────── */}
      <section className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold">{t("steps_title")}</h2>
          <p className="text-muted-foreground mt-2">{t("steps_subtitle")}</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {steps.map(({ num, key }) => (
            <div key={key} className="text-center space-y-3">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-pf-brand/10 border border-pf-brand/20">
                <span className="text-pf-brand font-bold text-sm">{num}</span>
              </div>
              <h3 className="font-semibold text-foreground">{t(`${key}_title` as Parameters<typeof t>[0])}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {t(`${key}_desc` as Parameters<typeof t>[0])}
              </p>
            </div>
          ))}
        </div>
        <div className="text-center mt-10">
          <Link
            href="/how-it-works"
            className="text-sm text-pf-brand hover:underline font-medium"
          >
            {t("steps_learn_more")} →
          </Link>
        </div>
      </section>

      {/* ── Pricing preview ───────────────────────────────────────────── */}
      <section className="bg-card/30 border-y border-border py-20">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold">{t("tiers_title")}</h2>
            <p className="text-muted-foreground mt-2">{t("tiers_subtitle")}</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {tiers.map((tier) => (
              <div
                key={tier.id}
                className="rounded-xl border border-border bg-card p-5 space-y-3 hover:border-pf-brand/40 transition-colors"
              >
                <p className="font-semibold text-sm">{tier.name}</p>
                <p className="text-2xl font-bold text-pf-brand">
                  ${(tier.fee / 100).toLocaleString("en-US")}
                </p>
                <p className="text-xs text-muted-foreground">{t("entry_fee")}</p>
                <div className="pt-2 border-t border-border space-y-1">
                  <p className="text-xs text-muted-foreground">
                    ${(tier.fundedBankroll / 100).toLocaleString("en-US")} {t("bankroll")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {tier.profitSplitPct}% {t("profit_split")}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <div className="text-center mt-8">
            <Link
              href="/challenges"
              className="px-7 py-3 rounded-xl bg-pf-brand hover:bg-pf-brand/90 text-white font-semibold text-sm transition-colors"
            >
              {t("tiers_cta")}
            </Link>
          </div>
        </div>
      </section>

      {/* ── Sports ────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-16 text-center">
        <h2 className="text-2xl font-bold mb-3">{t("sports_title")}</h2>
        <p className="text-muted-foreground text-sm mb-6">{t("sports_subtitle")}</p>
        <div className="flex flex-wrap justify-center gap-3">
          {["⚽ Soccer", "🏀 Basketball", "🏈 NFL", "🎾 Tennis", "🥊 MMA"].map(
            (s) => (
              <span
                key={s}
                className="px-4 py-2 rounded-full border border-border text-sm text-muted-foreground"
              >
                {s}
              </span>
            ),
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-4">{t("sports_leagues")}</p>
      </section>

      {/* ── Final CTA ─────────────────────────────────────────────────── */}
      <section className="bg-pf-brand/5 border-t border-border py-16 text-center">
        <div className="mx-auto max-w-xl px-4">
          <h2 className="text-3xl font-bold mb-3">{t("cta_title")}</h2>
          <p className="text-muted-foreground mb-8">{t("cta_subtitle")}</p>
          <Link
            href="/challenges"
            className="px-8 py-3 rounded-xl bg-pf-brand hover:bg-pf-brand/90 text-white font-semibold transition-colors"
          >
            {t("cta_button")}
          </Link>
          <p className="text-xs text-muted-foreground mt-4">{t("cta_disclaimer")}</p>
        </div>
      </section>
    </div>
  );
}
