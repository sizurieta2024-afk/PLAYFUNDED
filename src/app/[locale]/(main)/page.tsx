import { Link } from "@/i18n/navigation";
import { getTranslations } from "next-intl/server";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { resolveCountry } from "@/lib/country-policy";
import { getResolvedCountryPolicy } from "@/lib/country-policy-store";
import { formatLocalPrice, getCurrencyForCountry } from "@/lib/exchangerates";
import { LEAGUE_CONFIG } from "@/lib/odds/types";
import {
  TrendingUp,
  Zap,
  Star,
  Crown,
  Check,
  ArrowRight,
  Shield,
  DollarSign,
  Trophy,
  ChevronRight,
  CircleDot,
  Target,
  Activity,
  Users,
  Flame,
} from "lucide-react";
import type { Metadata } from "next";

const TIER_CONFIG: Record<
  string,
  {
    icon: React.ReactNode;
    glowColor: string;
    borderColor: string;
    badgeClass: string;
    isPopular: boolean;
    gradientFrom: string;
  }
> = {
  Starter: {
    icon: <TrendingUp className="w-4 h-4" />,
    glowColor: "rgba(16,185,129,0.25)",
    borderColor: "border-emerald-500/20 hover:border-emerald-500/50",
    badgeClass: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    isPopular: false,
    gradientFrom: "from-emerald-500/8",
  },
  Pro: {
    icon: <Zap className="w-4 h-4" />,
    glowColor: "rgba(59,130,246,0.25)",
    borderColor: "border-blue-500/20 hover:border-blue-500/50",
    badgeClass: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    isPopular: false,
    gradientFrom: "from-blue-500/8",
  },
  Elite: {
    icon: <Star className="w-4 h-4" />,
    glowColor: "rgba(139,92,246,0.3)",
    borderColor: "border-violet-500/30 hover:border-violet-500/60",
    badgeClass: "bg-violet-500/10 text-violet-400 border-violet-500/20",
    isPopular: true,
    gradientFrom: "from-violet-500/10",
  },
  Master: {
    icon: <Crown className="w-4 h-4" />,
    glowColor: "rgba(249,115,22,0.25)",
    borderColor: "border-orange-500/20 hover:border-orange-500/50",
    badgeClass: "bg-orange-500/10 text-orange-400 border-orange-500/20",
    isPopular: false,
    gradientFrom: "from-orange-500/8",
  },
  Legend: {
    icon: <Crown className="w-4 h-4" />,
    glowColor: "rgba(234,179,8,0.25)",
    borderColor: "border-yellow-500/20 hover:border-yellow-500/50",
    badgeClass: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    isPopular: false,
    gradientFrom: "from-yellow-500/8",
  },
};

const DEFAULT_CONFIG = {
  icon: <TrendingUp className="w-4 h-4" />,
  glowColor: "rgba(34,197,94,0.25)",
  borderColor: "border-pf-brand/20 hover:border-pf-brand/50",
  badgeClass: "bg-pf-brand/10 text-pf-brand border-pf-brand/20",
  isPopular: false,
  gradientFrom: "from-pf-brand/8",
};

function getNumberLocale(locale: string) {
  return locale === "en" ? "en-US" : locale;
}

function formatUsd(cents: number, locale: string, fractionDigits = 0) {
  const amount = cents / 100;
  let formatted = new Intl.NumberFormat(locale, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(amount);
  if (fractionDigits > 0 && locale !== "en-US") {
    formatted = formatted.replace(/\.(\d+)$/, ",$1");
  }
  return `$${formatted}`;
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
  const numberLocale = getNumberLocale(locale);
  const headersList = await headers();
  const country =
    resolveCountry(
      headersList.get("x-vercel-ip-country"),
      headersList.get("cf-ipcountry"),
    ) ?? undefined;
  const countryPolicy = await getResolvedCountryPolicy(country);
  const hasExactCommercialTerms =
    countryPolicy.marketing.showExactCommercialTerms;

  const now = new Date();
  const endOfTomorrow = new Date(now);
  endOfTomorrow.setDate(endOfTomorrow.getDate() + 1);
  endOfTomorrow.setHours(23, 59, 59, 999);

  const [tiers, activeSports] = await Promise.all([
    prisma.tier.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        name: true,
        fee: true,
        fundedBankroll: true,
        profitSplitPct: true,
      },
    }),
    prisma.oddsCache.findMany({
      where: {
        OR: [{ isLive: true }, { startTime: { gte: now, lte: endOfTomorrow } }],
      },
      distinct: ["sport"],
      select: { sport: true },
    }),
  ]);

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
      if (row.label) localFeeByTier.set(row.tierId, row.label);
    }
  }

  const steps = [
    { num: "01", key: "step1", color: "amber" },
    { num: "02", key: "step2", color: "blue" },
    { num: "03", key: "step3", color: "green" },
  ] as const;

  const splitPcts = tiers.map((t) => t.profitSplitPct);
  const minSplit = splitPcts.length > 0 ? Math.min(...splitPcts) : null;
  const maxSplit = splitPcts.length > 0 ? Math.max(...splitPcts) : null;
  const splitValue =
    minSplit == null || maxSplit == null
      ? "—"
      : minSplit === maxSplit
        ? `${minSplit}%`
        : `${minSplit}–${maxSplit}%`;

  const bankrolls = tiers.map((t) => t.fundedBankroll);
  const minBankroll = bankrolls.length > 0 ? Math.min(...bankrolls) : null;
  const maxBankroll = bankrolls.length > 0 ? Math.max(...bankrolls) : null;
  const bankrollValue =
    minBankroll == null || maxBankroll == null
      ? "—"
      : minBankroll === maxBankroll
        ? formatUsd(minBankroll, numberLocale)
        : `${formatUsd(minBankroll, numberLocale)}–${formatUsd(maxBankroll, numberLocale)}`;

  const configuredSportsCount = new Set(LEAGUE_CONFIG.map((c) => c.sport)).size;
  const sportsCount =
    activeSports.length > 0 ? activeSports.length : configuredSportsCount;

  const stats = [
    {
      value: splitValue,
      key: "stat_split",
      icon: <DollarSign className="w-4 h-4" />,
    },
    {
      value: bankrollValue,
      key: "stat_bankroll",
      icon: <Trophy className="w-4 h-4" />,
    },
    {
      value: hasExactCommercialTerms
        ? t("stat_payout_value")
        : t("stat_payout_value_review"),
      key: "stat_payout",
      icon: <Zap className="w-4 h-4" />,
    },
    {
      value: t("stat_sports_value_dynamic", { count: sportsCount }),
      key: "stat_sports",
      icon: <Shield className="w-4 h-4" />,
    },
  ] as const;

  const sports = [
    { icon: CircleDot, name: t("sport_soccer"), color: "text-emerald-400" },
    { icon: Activity, name: t("sport_basketball"), color: "text-orange-400" },
    { icon: Shield, name: t("sport_nfl"), color: "text-blue-400" },
    { icon: Target, name: t("sport_tennis"), color: "text-yellow-400" },
    { icon: Flame, name: t("sport_mma"), color: "text-red-400" },
  ];

  const proofStats: {
    value: string;
    key: Parameters<typeof t>[0];
    icon: React.ReactNode;
  }[] = [
    {
      value: "247+",
      key: "proof_traders",
      icon: <Users className="w-5 h-5" />,
    },
    {
      value: "$180K+",
      key: "proof_payouts",
      icon: <DollarSign className="w-5 h-5" />,
    },
    {
      value: "64%",
      key: "proof_pass_rate",
      icon: <TrendingUp className="w-5 h-5" />,
    },
    {
      value: `${sportsCount}`,
      key: "proof_sports",
      icon: <Trophy className="w-5 h-5" />,
    },
  ];

  return (
    <div className="flex flex-col">
      {/* ━━ HERO ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="relative min-h-[92vh] flex flex-col justify-center overflow-hidden bg-[#020617]">
        {/* Radial green glow from top */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-x-0 top-0 h-[70%] bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(34,197,94,0.13)_0%,transparent_70%)]" />
        </div>

        {/* Grid pattern overlay */}
        <div className="absolute inset-0 bg-grid-green opacity-60 pointer-events-none" />

        {/* Subtle vignette */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(2,6,23,0.7)_100%)] pointer-events-none" />

        {/* Bottom fade to page bg */}
        <div className="absolute bottom-0 inset-x-0 h-40 bg-gradient-to-t from-background to-transparent pointer-events-none" />

        <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 pt-28 pb-16 text-center">
          {/* Live badge */}
          <div className="flex justify-center mb-8">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-pf-brand/30 bg-pf-brand/10 text-pf-brand text-xs font-semibold shadow-[0_0_20px_rgba(34,197,94,0.15)] backdrop-blur-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-pf-brand animate-pulse" />
              {t("badge")}
            </div>
          </div>

          {/* Main headline */}
          <h1 className="text-5xl sm:text-6xl lg:text-7xl xl:text-8xl font-extrabold tracking-tight text-white leading-[0.9] max-w-4xl mx-auto mb-6">
            {t("hero_title_1")}{" "}
            <span className="text-gradient-green">
              {t("hero_title_highlight")}
            </span>
            {t("hero_title_2") && (
              <>
                , <br className="hidden sm:block" />
                {t("hero_title_2")}
              </>
            )}
          </h1>

          {/* Subtitle */}
          <p className="text-base sm:text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed mb-4">
            {hasExactCommercialTerms
              ? t("hero_subtitle")
              : t("hero_subtitle_review")}
          </p>

          {countryPolicy.requiresReviewNotice && (
            <p className="text-sm text-amber-400/80 max-w-2xl mx-auto mb-4">
              {t("countryPolicyReview")}
            </p>
          )}

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-10 mb-16">
            <Link
              href="/challenges"
              className="relative overflow-hidden group inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-pf-brand text-white font-bold text-sm tracking-wide shadow-[0_0_30px_rgba(34,197,94,0.35)] hover:shadow-[0_0_50px_rgba(34,197,94,0.5)] transition-all duration-300 hover:-translate-y-0.5 cursor-pointer"
            >
              <span className="relative z-10">{t("hero_cta_primary")}</span>
              <ArrowRight className="relative z-10 w-4 h-4 transition-transform group-hover:translate-x-1" />
              {/* Shimmer sweep */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
            </Link>
            <Link
              href="/how-it-works"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-white font-semibold text-sm tracking-wide transition-all duration-300 backdrop-blur-sm cursor-pointer"
            >
              {t("hero_cta_secondary")}
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>

          {/* Stats grid — glass cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-w-2xl mx-auto">
            {stats.map(({ value, key, icon }) => (
              <div
                key={key}
                className="group rounded-2xl border border-white/[0.07] bg-white/[0.03] backdrop-blur-sm p-4 sm:p-5 text-center hover:border-pf-brand/30 hover:bg-pf-brand/5 transition-all duration-300 cursor-default"
              >
                <div className="flex justify-center mb-2 text-pf-brand/60 group-hover:text-pf-brand transition-colors">
                  {icon}
                </div>
                <p className="text-xl sm:text-2xl font-extrabold text-white tabular-nums tracking-tight">
                  {value}
                </p>
                <p className="text-[10px] sm:text-[11px] text-slate-500 mt-1 uppercase tracking-wider">
                  {t(key)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ━━ SPORTS TICKER ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div className="relative overflow-hidden bg-pf-brand/5 border-y border-pf-brand/10 py-2.5">
        <div className="flex gap-6 animate-ticker whitespace-nowrap select-none">
          {[...sports, ...sports, ...sports, ...sports].map((s, i) => {
            const Icon = s.icon;
            return (
              <span
                key={i}
                className="inline-flex items-center gap-2 text-sm font-semibold text-pf-brand/70 shrink-0"
              >
                <Icon className={`w-3.5 h-3.5 ${s.color} opacity-80`} />
                <span>{s.name}</span>
                <span className="text-pf-brand/20 mx-1">·</span>
              </span>
            );
          })}
        </div>
      </div>

      {/* ━━ HOW IT WORKS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="relative py-24 overflow-hidden bg-[#030c18]">
        {/* Subtle top edge accent */}
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-pf-brand/20 to-transparent" />

        <div className="relative mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <p className="text-pf-brand text-xs font-bold uppercase tracking-[0.2em] mb-3">
              El proceso
            </p>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white">
              {t("steps_title")}
            </h2>
            <p className="text-slate-400 mt-3 text-sm">{t("steps_subtitle")}</p>
          </div>

          {/* Steps — with connecting line */}
          <div className="relative grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Connector line (desktop) */}
            <div className="hidden md:block absolute top-[2.25rem] left-[calc(16.66%+1.5rem)] right-[calc(16.66%+1.5rem)] h-px">
              <div className="h-full bg-gradient-to-r from-amber-500/40 via-blue-500/40 to-pf-brand/40" />
            </div>

            {steps.map(({ num, key, color }) => {
              const stepColors = {
                amber: {
                  ring: "border-amber-500/40 text-amber-400",
                  bg: "bg-amber-500/10",
                  glow: "group-hover:shadow-[0_0_25px_rgba(245,158,11,0.25)]",
                  dot: "bg-amber-500",
                },
                blue: {
                  ring: "border-blue-500/40 text-blue-400",
                  bg: "bg-blue-500/10",
                  glow: "group-hover:shadow-[0_0_25px_rgba(59,130,246,0.25)]",
                  dot: "bg-blue-500",
                },
                green: {
                  ring: "border-pf-brand/40 text-pf-brand",
                  bg: "bg-pf-brand/10",
                  glow: "group-hover:shadow-[0_0_25px_rgba(34,197,94,0.25)]",
                  dot: "bg-pf-brand",
                },
              }[color];

              return (
                <div
                  key={key}
                  className="group relative flex flex-col items-center text-center"
                >
                  {/* Number bubble */}
                  <div
                    className={`relative z-10 w-[4.5rem] h-[4.5rem] rounded-2xl border-2 ${stepColors.ring} ${stepColors.bg} flex items-center justify-center mb-6 font-extrabold text-2xl transition-all duration-300 ${stepColors.glow}`}
                  >
                    {num}
                    {/* Corner dot */}
                    <div
                      className={`absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full ${stepColors.dot} ring-2 ring-[#030c18]`}
                    />
                  </div>
                  <h3 className="text-base font-bold text-white mb-2">
                    {t(`${key}_title` as Parameters<typeof t>[0])}
                  </h3>
                  <p className="text-sm text-slate-400 leading-relaxed max-w-[220px] mx-auto">
                    {key === "step3" && !hasExactCommercialTerms
                      ? t("step3_desc_review")
                      : t(`${key}_desc` as Parameters<typeof t>[0])}
                  </p>
                </div>
              );
            })}
          </div>

          <div className="text-center mt-12">
            <Link
              href="/how-it-works"
              className="inline-flex items-center gap-2 text-sm text-pf-brand hover:text-emerald-300 font-semibold transition-colors group"
            >
              {t("steps_learn_more")}
              <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
        </div>
      </section>

      {/* ━━ COMMUNITY PROOF ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="py-16 bg-background border-t border-border">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
            {proofStats.map(({ value, key, icon }) => (
              <div
                key={key}
                className="group flex flex-col items-center text-center p-5 rounded-2xl border border-border hover:border-pf-brand/30 hover:bg-pf-brand/[0.03] transition-all duration-300 cursor-default"
              >
                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-pf-brand/10 border border-pf-brand/20 text-pf-brand mb-3 group-hover:bg-pf-brand/15 transition-colors">
                  {icon}
                </div>
                <p className="text-3xl sm:text-4xl font-extrabold text-foreground tracking-tight tabular-nums">
                  {value}
                </p>
                <p className="text-[11px] text-muted-foreground uppercase tracking-wider mt-1">
                  {t(key)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ━━ TIER CARDS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="py-24 bg-background border-t border-border">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <p className="text-pf-brand text-xs font-bold uppercase tracking-[0.2em] mb-3">
              Planes
            </p>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-foreground">
              {t("tiers_title")}
            </h2>
            <p className="text-muted-foreground mt-3 text-sm">
              {t("tiers_subtitle")}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            {tiers.map((tier) => {
              const cfg = TIER_CONFIG[tier.name] ?? DEFAULT_CONFIG;
              return (
                <div
                  key={tier.id}
                  className={`relative flex flex-col rounded-2xl border bg-gradient-to-b ${cfg.gradientFrom} to-transparent ${cfg.borderColor} p-5 transition-all duration-300 hover:-translate-y-1 cursor-pointer group`}
                  style={{
                    boxShadow: cfg.isPopular
                      ? `0 0 40px ${cfg.glowColor}`
                      : undefined,
                  }}
                >
                  {/* Popular ring */}
                  {cfg.isPopular && (
                    <>
                      <div className="absolute -inset-px rounded-2xl ring-2 ring-violet-500/40 pointer-events-none" />
                      <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full border px-3 py-0.5 text-[11px] font-bold ${cfg.badgeClass} shadow-[0_0_12px_rgba(139,92,246,0.3)]`}
                        >
                          <Star className="w-2.5 h-2.5 fill-current" />
                          {t("popular")}
                        </span>
                      </div>
                    </>
                  )}

                  {/* Icon + name */}
                  <div className="flex items-center gap-2.5 mb-4 mt-2">
                    <div
                      className={`flex items-center justify-center w-8 h-8 rounded-lg border ${cfg.badgeClass}`}
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
                      {formatUsd(tier.fee, numberLocale, 2)}
                    </span>
                    <span className="text-xs text-muted-foreground ml-1">
                      USD
                    </span>
                    {localFeeByTier.get(tier.id) && (
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        (~{localFeeByTier.get(tier.id)})
                      </p>
                    )}
                  </div>

                  {/* Metrics */}
                  <dl className="space-y-2 text-xs mb-4 flex-1">
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">{t("bankroll")}</dt>
                      <dd className="font-bold text-foreground">
                        {formatUsd(tier.fundedBankroll, numberLocale)}
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">
                        {t("profit_split")}
                      </dt>
                      <dd className="font-bold text-pf-brand">
                        {tier.profitSplitPct}%
                      </dd>
                    </div>
                  </dl>

                  {/* Rules */}
                  <ul className="space-y-1 mb-4 text-[11px] text-muted-foreground">
                    {[
                      t("rule_phase1"),
                      t("rule_phase2"),
                      t("rule_daily_limit"),
                    ].map((r) => (
                      <li key={r} className="flex items-center gap-1.5">
                        <Check className="w-3 h-3 text-pf-brand shrink-0" />
                        {r}
                      </li>
                    ))}
                  </ul>

                  <Link
                    href="/challenges"
                    className={`w-full text-center rounded-xl py-2.5 text-xs font-bold transition-all duration-200 ${
                      cfg.isPopular
                        ? "bg-pf-brand hover:bg-pf-brand-dark text-white shadow-[0_0_20px_rgba(34,197,94,0.3)] group-hover:shadow-[0_0_30px_rgba(34,197,94,0.4)]"
                        : "border border-border hover:border-pf-brand/40 hover:bg-pf-brand/5 text-foreground hover:text-pf-brand"
                    }`}
                  >
                    {t("tiers_cta_short")}
                  </Link>
                </div>
              );
            })}
          </div>

          <div className="text-center mt-10">
            <Link
              href="/challenges"
              className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl bg-pf-brand hover:bg-pf-brand-dark text-white font-bold text-sm shadow-pf-glow hover:shadow-pf-glow-lg transition-all duration-300 hover:-translate-y-0.5 group"
            >
              {t("tiers_cta")}
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
        </div>
      </section>

      {/* ━━ SPORTS COVERAGE ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="py-20 bg-[#030c18] border-t border-white/[0.04]">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 text-center">
          <p className="text-pf-brand text-xs font-bold uppercase tracking-[0.2em] mb-3">
            Mercados
          </p>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white mb-3">
            {t("sports_title")}
          </h2>
          <p className="text-slate-400 text-sm mb-8">{t("sports_subtitle")}</p>

          <div className="flex flex-wrap justify-center gap-3 mb-6">
            {sports.map((s) => {
              const Icon = s.icon;
              return (
                <div
                  key={s.name}
                  className="flex items-center gap-2.5 px-5 py-2.5 rounded-xl border border-white/10 bg-white/[0.03] hover:border-pf-brand/30 hover:bg-pf-brand/5 transition-all duration-200 group cursor-default"
                >
                  <Icon className={`w-4 h-4 shrink-0 ${s.color}`} />
                  <span className="text-sm font-semibold text-slate-300 group-hover:text-white transition-colors">
                    {s.name}
                  </span>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-slate-600">{t("sports_leagues")}</p>
        </div>
      </section>

      {/* ━━ TRUST PILLARS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="py-20 bg-[#030c18] border-t border-white/[0.04]">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <div className="text-center mb-12">
            <p className="text-pf-brand text-xs font-bold uppercase tracking-[0.2em] mb-3">
              {locale === "en" ? "Why PlayFunded" : "Por qué PlayFunded"}
            </p>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
              {locale === "en"
                ? "Built for serious traders"
                : "Construido para traders serios"}
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {[
              {
                icon: <Shield className="w-6 h-6" />,
                accent: "from-emerald-500/20 to-emerald-500/5",
                border: "border-emerald-500/20 hover:border-emerald-500/40",
                iconBg:
                  "bg-emerald-500/10 border-emerald-500/25 text-emerald-400",
                title:
                  locale === "en"
                    ? "Real capital, our risk"
                    : "Capital real, riesgo nuestro",
                desc:
                  locale === "en"
                    ? "We put up the bankroll. You prove your skill with real stakes."
                    : "Nosotros ponemos el dinero. Tú demuestras tu talento con stakes reales.",
              },
              {
                icon: <DollarSign className="w-6 h-6" />,
                accent: "from-blue-500/20 to-blue-500/5",
                border: "border-blue-500/20 hover:border-blue-500/40",
                iconBg: "bg-blue-500/10 border-blue-500/25 text-blue-400",
                title: locale === "en" ? "Monthly payouts" : "Pagos mensuales",
                desc:
                  locale === "en"
                    ? "Collect up to 80% of your profits every month, no lock-in."
                    : "Cobra hasta el 80% de tus ganancias cada mes, sin bloqueos.",
              },
              {
                icon: <Trophy className="w-6 h-6" />,
                accent: "from-violet-500/20 to-violet-500/5",
                border: "border-violet-500/20 hover:border-violet-500/40",
                iconBg: "bg-violet-500/10 border-violet-500/25 text-violet-400",
                title:
                  locale === "en" ? "Live sports markets" : "Deportes en vivo",
                desc:
                  locale === "en"
                    ? "Liga MX, NBA, NFL, ATP, UFC and more leagues available."
                    : "Liga MX, NBA, NFL, ATP, UFC y más ligas disponibles.",
              },
            ].map((p) => (
              <div
                key={p.title}
                className={`relative flex flex-col gap-4 p-6 rounded-2xl border ${p.border} bg-gradient-to-b ${p.accent} to-transparent transition-all duration-300 group overflow-hidden`}
              >
                <div
                  className={`shrink-0 flex items-center justify-center w-11 h-11 rounded-xl border ${p.iconBg} transition-colors`}
                >
                  {p.icon}
                </div>
                <div>
                  <p className="font-bold text-sm text-white mb-1.5">
                    {p.title}
                  </p>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    {p.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ━━ FINAL CTA ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="relative py-28 overflow-hidden bg-[#020617]">
        {/* Green radial glow center */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_80%_at_50%_50%,rgba(34,197,94,0.11)_0%,transparent_70%)] pointer-events-none" />
        <div className="absolute inset-0 bg-grid-green opacity-40 pointer-events-none" />
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-pf-brand/20 to-transparent" />

        <div className="relative text-center max-w-2xl mx-auto px-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-pf-brand/25 bg-pf-brand/10 text-pf-brand text-xs font-semibold mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-pf-brand animate-pulse" />
            {hasExactCommercialTerms
              ? "Únete ahora"
              : "Disponible próximamente"}
          </div>
          <h2 className="text-4xl sm:text-5xl font-extrabold text-white mb-4 leading-tight">
            {t("cta_title")}
          </h2>
          <p className="text-slate-400 mb-10 text-sm leading-relaxed max-w-lg mx-auto">
            {hasExactCommercialTerms
              ? t("cta_subtitle")
              : t("cta_subtitle_review")}
          </p>
          <Link
            href="/challenges"
            className="relative overflow-hidden group inline-flex items-center gap-2 px-10 py-4 rounded-xl bg-pf-brand text-white font-bold text-base shadow-[0_0_50px_rgba(34,197,94,0.4)] hover:shadow-[0_0_70px_rgba(34,197,94,0.55)] transition-all duration-300 hover:-translate-y-1 cursor-pointer"
          >
            <span className="relative z-10">{t("cta_button")}</span>
            <ArrowRight className="relative z-10 w-5 h-5 transition-transform group-hover:translate-x-1" />
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
          </Link>
          <p className="text-[11px] text-slate-600 mt-5">
            {hasExactCommercialTerms
              ? t("cta_disclaimer")
              : t("cta_disclaimer_review")}
          </p>
        </div>
      </section>
    </div>
  );
}
