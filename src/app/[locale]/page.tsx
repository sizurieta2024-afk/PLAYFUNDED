import { Link } from "@/i18n/navigation";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { TrendingUp, Zap, Star, Crown, Check } from "lucide-react";
import type { Metadata } from "next";

const TIER_CONFIG: Record<
  string,
  {
    icon: React.ReactNode;
    gradient: string;
    badge: string;
    isPopular: boolean;
  }
> = {
  Starter: {
    icon: <TrendingUp className="w-4 h-4" />,
    gradient:
      "from-emerald-500/10 to-transparent border-emerald-500/20 hover:border-emerald-500/40",
    badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    isPopular: false,
  },
  Pro: {
    icon: <Zap className="w-4 h-4" />,
    gradient:
      "from-blue-500/10 to-transparent border-blue-500/20 hover:border-blue-500/40",
    badge: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    isPopular: false,
  },
  Elite: {
    icon: <Star className="w-4 h-4" />,
    gradient:
      "from-purple-500/10 to-transparent border-purple-500/30 hover:border-purple-500/50",
    badge: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    isPopular: true,
  },
  Master: {
    icon: <Crown className="w-4 h-4" />,
    gradient:
      "from-orange-500/10 to-transparent border-orange-500/20 hover:border-orange-500/40",
    badge: "bg-orange-500/10 text-orange-400 border-orange-500/20",
    isPopular: false,
  },
  Legend: {
    icon: <Crown className="w-4 h-4" />,
    gradient:
      "from-yellow-500/10 to-transparent border-yellow-500/20 hover:border-yellow-500/40",
    badge: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    isPopular: false,
  },
};

const DEFAULT_CONFIG = {
  icon: <TrendingUp className="w-4 h-4" />,
  gradient:
    "from-pf-brand/10 to-transparent border-pf-brand/20 hover:border-pf-brand/40",
  badge: "bg-pf-brand/10 text-pf-brand border-pf-brand/20",
  isPopular: false,
};

function fmt(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

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
              <h3 className="font-semibold text-foreground">
                {t(`${key}_title` as Parameters<typeof t>[0])}
              </h3>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            {tiers.map((tier) => {
              const cfg = TIER_CONFIG[tier.name] ?? DEFAULT_CONFIG;
              return (
                <div
                  key={tier.id}
                  className={`relative flex flex-col rounded-2xl border bg-gradient-to-b p-5 transition-all duration-200 ${cfg.gradient}`}
                >
                  {cfg.isPopular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${cfg.badge}`}
                      >
                        <Star className="w-2.5 h-2.5 fill-current" />
                        {t("popular")}
                      </span>
                    </div>
                  )}

                  {/* Icon + name */}
                  <div className="flex items-center gap-2.5 mb-4">
                    <div
                      className={`flex items-center justify-center w-8 h-8 rounded-lg border ${cfg.badge}`}
                    >
                      {cfg.icon}
                    </div>
                    <span className="font-bold text-foreground text-sm">
                      {tier.name}
                    </span>
                  </div>

                  {/* Price */}
                  <div className="mb-4">
                    <span className="text-3xl font-extrabold text-foreground tracking-tight">
                      {fmt(tier.fee)}
                    </span>
                    <span className="text-xs text-muted-foreground ml-1">
                      USD
                    </span>
                  </div>

                  {/* Metrics */}
                  <dl className="space-y-2 text-xs mb-4 flex-1">
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">{t("bankroll")}</dt>
                      <dd className="font-semibold text-foreground">
                        {fmt(tier.fundedBankroll)}
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">
                        {t("profit_split")}
                      </dt>
                      <dd className="font-semibold text-foreground">
                        {tier.profitSplitPct}%
                      </dd>
                    </div>
                  </dl>

                  {/* Rules */}
                  <ul className="space-y-1 mb-4 text-[11px] text-muted-foreground">
                    {["Phase 1: +20%", "Phase 2: +10%", "−10% daily limit"].map(
                      (r) => (
                        <li key={r} className="flex items-center gap-1">
                          <Check className="w-3 h-3 text-pf-brand shrink-0" />
                          {r}
                        </li>
                      ),
                    )}
                  </ul>

                  <Link
                    href="/challenges"
                    className="w-full text-center rounded-xl bg-pf-brand hover:bg-pf-brand/90 text-white font-semibold py-2.5 text-xs transition-colors"
                  >
                    {t("tiers_cta_short")}
                  </Link>
                </div>
              );
            })}
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
        <p className="text-muted-foreground text-sm mb-6">
          {t("sports_subtitle")}
        </p>
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
        <p className="text-xs text-muted-foreground mt-4">
          {t("sports_leagues")}
        </p>
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
          <p className="text-xs text-muted-foreground mt-4">
            {t("cta_disclaimer")}
          </p>
        </div>
      </section>
    </div>
  );
}
