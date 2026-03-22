import { Link } from "@/i18n/navigation";
import { getTranslations } from "next-intl/server";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { resolveCountry } from "@/lib/country-policy";
import { getResolvedCountryPolicy } from "@/lib/country-policy-store";
import { formatLocalPrice, getCurrencyForCountry } from "@/lib/exchangerates";
import { BackgroundBeams } from "@/components/landing/BackgroundBeams";
import { GlowingCard } from "@/components/landing/GlowingCard";
import { TestimonialsMarquee } from "@/components/landing/TestimonialsMarquee";
import { AnimatedCounter } from "@/components/landing/AnimatedCounter";
import { Spotlight } from "@/components/landing/Spotlight";
import { TextGenerateEffect } from "@/components/landing/TextGenerateEffect";
import { MovingBorderButton } from "@/components/landing/MovingBorderButton";
import { HeroSparkles } from "@/components/landing/HeroSparkles";
import { BorderBeam } from "@/components/landing/BorderBeam";
import { GrainOverlay } from "@/components/landing/GrainOverlay";
import { ScrollReveal } from "@/components/landing/ScrollReveal";
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
  glowColor: "rgba(201,168,76,0.25)",
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
    { num: "02", key: "step2", color: "amber" },
    { num: "03", key: "step3", color: "green" },
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
      value: "80%",
      key: "proof_traders",
      icon: <TrendingUp className="w-5 h-5" />,
    },
    {
      value: "$25K",
      key: "proof_payouts",
      icon: <DollarSign className="w-5 h-5" />,
    },
    {
      value: "5",
      key: "proof_pass_rate",
      icon: <Trophy className="w-5 h-5" />,
    },
    {
      value: "1×",
      key: "proof_sports",
      icon: <Users className="w-5 h-5" />,
    },
  ];

  return (
    <div className="flex flex-col">
      {/* ━━ HERO ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="relative overflow-hidden bg-background">
        {/* Stage spotlight — centered gold beam from top */}
        <Spotlight />
        {/* Twinkling gold sparkle particles */}
        <HeroSparkles count={42} />
        {/* Film grain overlay — premium texture signal */}
        <GrainOverlay opacity={0.032} />
        {/* Animated beams background */}
        <BackgroundBeams />
        {/* Radial glows */}
        <div className="absolute top-0 right-0 w-[700px] h-[700px] bg-[radial-gradient(ellipse,rgba(201,168,76,0.06)_0%,transparent_65%)] pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-[radial-gradient(ellipse,rgba(255,45,120,0.04)_0%,transparent_70%)] pointer-events-none" />

        <div className="relative mx-auto max-w-[1200px] px-6 lg:px-16">
          <div className="grid grid-cols-1 lg:grid-cols-[55fr_45fr] gap-12 xl:gap-20 items-center min-h-[calc(100vh-56px)] py-20">
            {/* ── LEFT COLUMN ─────────────────────────────── */}
            <div>
              {/* Eyebrow */}
              <div
                className="flex items-center gap-3 mb-5 animate-slide-reveal"
                style={{ animationDelay: "0ms" }}
              >
                <div className="w-7 h-px bg-pf-brand flex-shrink-0" />
                <span className="font-mono text-[10px] text-pf-brand uppercase tracking-[0.12em]">
                  {t("badge")}
                </span>
              </div>

              {/* H1 — staggered line reveals */}
              <h1
                className="font-serif italic text-[clamp(3rem,5.5vw,5.5rem)] leading-[1.05] text-foreground animate-slide-reveal"
                style={{ animationDelay: "80ms" }}
              >
                {t("hero_title_1")}{" "}
                <span className="text-gradient-animated">
                  {t("hero_title_highlight")}
                </span>
                ,<br />
                <span className="text-pf-brand">{t("hero_title_2")}</span>
              </h1>

              {/* Subtitle */}
              <p
                className="text-[clamp(14px,1.5vw,16px)] text-muted-foreground leading-relaxed max-w-[420px] mt-6 mb-2 animate-slide-reveal"
                style={{ animationDelay: "200ms" }}
              >
                <TextGenerateEffect
                  words={t("hero_subtitle")}
                  startDelay={500}
                  delayPerWord={55}
                />
              </p>

              {/* CTAs */}
              <div
                className="flex flex-wrap gap-3 mt-9 animate-slide-reveal"
                style={{ animationDelay: "320ms" }}
              >
                <Link
                  href="/challenges"
                  className="animate-cta-ripple group relative inline-flex items-center gap-2 px-7 py-3.5 rounded bg-pf-pink hover:bg-pf-pink-dark text-white font-semibold text-[14px] transition-colors duration-200 overflow-hidden"
                >
                  {/* shimmer sweep on hover */}
                  <span className="pointer-events-none absolute inset-0 -skew-x-12 translate-x-[-150%] group-hover:translate-x-[150%] transition-transform duration-500 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                  {t("hero_cta_primary")}
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  href="/how-it-works"
                  className="inline-flex items-center gap-2 px-7 py-3.5 rounded border border-white/10 text-muted-foreground hover:border-pf-brand/30 hover:text-foreground font-semibold text-[14px] transition-all duration-200"
                >
                  {t("hero_cta_secondary")}
                  <ChevronRight className="w-4 h-4" />
                </Link>
              </div>

              {/* Stat row */}
              <div
                className="flex mt-12 gap-y-4 animate-slide-reveal"
                style={{ animationDelay: "440ms" }}
              >
                {proofStats.map(({ value, key }, i) => (
                  <div
                    key={key}
                    className={`shrink-0 ${i < proofStats.length - 1 ? "pr-7 mr-7 border-r border-white/[0.08]" : ""}`}
                  >
                    <AnimatedCounter
                      value={value}
                      className="font-display font-bold text-[1.4rem] text-foreground leading-none tabular-nums"
                    />
                    <p className="font-mono text-[9px] text-muted-foreground uppercase tracking-[0.06em] mt-1.5">
                      {t(key)}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* ── RIGHT COLUMN — Account Card Widget ──────── */}
            <div
              className="relative hidden lg:block animate-slide-reveal"
              style={{ animationDelay: "160ms" }}
            >
              {/* Glow behind card */}
              <div className="absolute -inset-8 bg-[radial-gradient(ellipse,rgba(201,168,76,0.06)_0%,transparent_70%)] pointer-events-none" />

              <div className="animate-float relative bg-pf-dark-card border border-pf-brand/20 rounded-lg shadow-[0_2px_8px_rgba(0,0,0,0.4),0_8px_32px_rgba(0,0,0,0.3)] p-7">
                {/* Card header */}
                <div className="flex items-center justify-between mb-5">
                  <span className="font-mono text-[10px] text-pf-brand uppercase tracking-[0.1em]">
                    Elite Account
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="w-[5px] h-[5px] rounded-full bg-pf-brand" />
                    <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.08em]">
                      Active
                    </span>
                  </div>
                </div>

                {/* Balance */}
                <p className="font-mono text-[9px] text-muted-foreground uppercase tracking-[0.08em] mb-1">
                  Current Balance
                </p>
                <p className="font-serif italic text-[2.2rem] text-pf-pink leading-none mb-4">
                  $10,247.50
                </p>

                {/* Sparkline */}
                <div className="mb-4 bg-[#111111] rounded overflow-hidden">
                  <svg
                    viewBox="0 0 300 60"
                    className="w-full h-14"
                    aria-hidden="true"
                  >
                    <defs>
                      <linearGradient
                        id="sparkGold"
                        x1="0"
                        y1="0"
                        x2="1"
                        y2="0"
                      >
                        <stop
                          offset="0%"
                          stopColor="#c9a84c"
                          stopOpacity="0.5"
                        />
                        <stop
                          offset="100%"
                          stopColor="#e2c06a"
                          stopOpacity="1"
                        />
                      </linearGradient>
                    </defs>
                    <path
                      d="M0,48 C40,44 80,40 120,34 C160,28 200,20 240,14 L300,8"
                      stroke="url(#sparkGold)"
                      strokeWidth="1.5"
                      fill="none"
                      strokeLinecap="round"
                    />
                    <path
                      d="M0,48 C40,44 80,40 120,34 C160,28 200,20 240,14 L300,8 L300,60 L0,60 Z"
                      fill="rgba(201,168,76,0.06)"
                    />
                  </svg>
                </div>

                {/* Progress */}
                <div className="flex justify-between items-center mb-2">
                  <span className="font-mono text-[9px] text-muted-foreground uppercase tracking-[0.08em]">
                    Challenge Progress
                  </span>
                  <span className="font-mono text-[9px] text-muted-foreground">
                    72%
                  </span>
                </div>
                <div className="h-[2px] bg-white/[0.06] rounded mb-5">
                  <div className="h-full w-[72%] bg-pf-brand rounded" />
                </div>

                <div className="h-px bg-white/[0.06] mb-4" />

                {/* Picks */}
                <p className="font-mono text-[9px] text-pf-brand uppercase tracking-[0.1em] mb-3">
                  Recent Picks
                </p>
                <table className="w-full text-left mb-4">
                  <thead>
                    <tr>
                      {["Pick", "Odds", "Stake", "P&L"].map((h) => (
                        <th
                          key={h}
                          className="font-mono text-[9px] text-muted-foreground uppercase tracking-[0.06em] pb-2 pr-2 font-normal"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="font-mono text-[10px] text-foreground pb-2 pr-2">
                        Real Madrid ML
                      </td>
                      <td className="font-mono text-[10px] text-muted-foreground pb-2 pr-2">
                        1.85
                      </td>
                      <td className="font-mono text-[10px] text-muted-foreground pb-2 pr-2">
                        $200
                      </td>
                      <td className="font-mono text-[10px] text-pf-pink pb-2">
                        +$170
                      </td>
                    </tr>
                    <tr>
                      <td className="font-mono text-[10px] text-foreground pb-2 pr-2">
                        Lakers -3.5
                      </td>
                      <td className="font-mono text-[10px] text-muted-foreground pb-2 pr-2">
                        1.91
                      </td>
                      <td className="font-mono text-[10px] text-muted-foreground pb-2 pr-2">
                        $150
                      </td>
                      <td className="font-mono text-[10px] text-pf-pink pb-2">
                        +$143
                      </td>
                    </tr>
                    <tr>
                      <td className="font-mono text-[10px] text-foreground pb-2 pr-2">
                        Chiefs ML
                      </td>
                      <td className="font-mono text-[10px] text-muted-foreground pb-2 pr-2">
                        2.10
                      </td>
                      <td className="font-mono text-[10px] text-muted-foreground pb-2 pr-2">
                        $100
                      </td>
                      <td className="font-mono text-[9px] text-pf-pink pb-2 uppercase tracking-wider">
                        LIVE
                      </td>
                    </tr>
                  </tbody>
                </table>

                {/* Payout CTA */}
                <button className="w-full border border-pf-pink/25 text-pf-pink font-semibold text-[12px] uppercase tracking-[0.08em] py-3 rounded hover:bg-pf-pink/[0.08] transition-colors mb-2.5">
                  Request Payout →
                </button>
                <p className="font-mono text-[9px] text-center text-muted-foreground">
                  48h avg processing · No hidden fees
                </p>
              </div>
            </div>
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
      <section className="relative py-24 overflow-hidden bg-card">
        {/* Lamp glow effect */}
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-pf-brand/20 to-transparent" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[200px] bg-[conic-gradient(from_270deg_at_50%_0%,transparent_45deg,rgba(201,168,76,0.12)_90deg,rgba(201,168,76,0.06)_180deg,transparent_225deg)] pointer-events-none" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[300px] h-[120px] bg-[radial-gradient(ellipse,rgba(201,168,76,0.18)_0%,transparent_70%)] blur-xl pointer-events-none" />

        <div className="relative mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="w-8 h-px bg-pf-brand flex-shrink-0" />
              <span className="font-mono text-xs text-pf-brand uppercase tracking-[0.15em]">
                {t("eyebrow_process")}
              </span>
            </div>
            <h2 className="font-display font-bold text-3xl sm:text-4xl text-foreground">
              {t("steps_title")}
            </h2>
            <p className="text-muted-foreground mt-3 text-sm">
              {t("steps_subtitle")}
            </p>
          </div>

          {/* Steps — with connecting line */}
          <div className="relative grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Connector line (desktop) */}
            <div className="hidden md:block absolute top-[2.25rem] left-[calc(16.66%+1.5rem)] right-[calc(16.66%+1.5rem)] h-px">
              <div className="h-full bg-gradient-to-r from-amber-500/40 via-blue-500/40 to-pf-brand/40" />
            </div>

            {steps.map(({ num, key, color }, idx) => {
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
                  glow: "group-hover:shadow-[0_0_25px_rgba(201,168,76,0.25)]",
                  dot: "bg-pf-brand",
                },
              }[color];

              return (
                <ScrollReveal key={key} delay={idx * 100} scale>
                  <div className="group relative flex flex-col items-center text-center">
                    {/* Number bubble */}
                    <div
                      className={`relative z-10 w-[4.5rem] h-[4.5rem] rounded-2xl border-2 ${stepColors.ring} ${stepColors.bg} flex items-center justify-center mb-6 font-extrabold text-2xl transition-all duration-300 ${stepColors.glow}`}
                    >
                      {num}
                      {/* Corner dot */}
                      <div
                        className={`absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full ${stepColors.dot} ring-2 ring-card`}
                      />
                    </div>
                    <h3 className="text-base font-bold text-white mb-2">
                      {t(`${key}_title` as Parameters<typeof t>[0])}
                    </h3>
                    <p className="text-sm text-muted-foreground leading-relaxed max-w-[220px] mx-auto">
                      {key === "step3" && !hasExactCommercialTerms
                        ? t("step3_desc_review")
                        : t(`${key}_desc` as Parameters<typeof t>[0])}
                    </p>
                  </div>
                </ScrollReveal>
              );
            })}
          </div>

          <div className="text-center mt-12">
            <Link
              href="/how-it-works"
              className="inline-flex items-center gap-2 text-sm text-pf-brand hover:text-pf-brand/70 font-semibold transition-colors group"
            >
              {t("steps_learn_more")}
              <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
        </div>
      </section>

      {/* ━━ COMMUNITY PROOF ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="py-16 bg-background border-t border-border relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_60%_at_50%_50%,rgba(201,168,76,0.04)_0%,transparent_70%)] pointer-events-none" />
        <div className="relative mx-auto max-w-4xl px-4 sm:px-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
            {proofStats.map(({ value, key, icon }) => (
              <div
                key={key}
                className="group flex flex-col items-center text-center p-5 rounded-2xl border border-border hover:border-pf-brand/30 hover:bg-pf-brand/[0.03] transition-all duration-300 cursor-default"
              >
                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-pf-brand/10 border border-pf-brand/20 text-pf-brand mb-3 group-hover:bg-pf-brand/15 transition-colors">
                  {icon}
                </div>
                <AnimatedCounter
                  value={value}
                  className="text-3xl sm:text-4xl font-extrabold text-foreground tracking-tight tabular-nums"
                />
                <p className="text-[11px] text-muted-foreground uppercase tracking-wider mt-1">
                  {t(key)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ━━ TIER CARDS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="py-24 bg-card border-t border-border relative overflow-hidden">
        {/* Lamp effect */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[220px] bg-[conic-gradient(from_270deg_at_50%_0%,transparent_40deg,rgba(255,45,120,0.08)_90deg,rgba(255,45,120,0.04)_180deg,transparent_220deg)] pointer-events-none" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[350px] h-[140px] bg-[radial-gradient(ellipse,rgba(255,45,120,0.12)_0%,transparent_70%)] blur-xl pointer-events-none" />
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="w-8 h-px bg-pf-brand flex-shrink-0" />
              <span className="font-mono text-xs text-pf-brand uppercase tracking-[0.15em]">
                {t("eyebrow_tiers")}
              </span>
            </div>
            <h2 className="font-display font-bold text-3xl sm:text-4xl font-extrabold text-foreground">
              {t("tiers_title")}
            </h2>
            <p className="text-muted-foreground mt-3 text-sm">
              {t("tiers_subtitle")}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            {tiers.map((tier, idx) => {
              const cfg = TIER_CONFIG[tier.name] ?? DEFAULT_CONFIG;
              const glowRgb = cfg.isPopular ? "255,45,120" : "201,168,76";
              return (
                <ScrollReveal key={tier.id} delay={idx * 60} scale>
                  <GlowingCard glowColor={glowRgb}>
                    <div
                      className={`relative flex flex-col rounded-2xl border bg-gradient-to-b ${cfg.gradientFrom} to-transparent ${cfg.borderColor} p-5 transition-all duration-300 hover:-translate-y-1 cursor-pointer group`}
                      style={{
                        boxShadow: cfg.isPopular
                          ? `0 0 40px ${cfg.glowColor}`
                          : undefined,
                      }}
                    >
                      {/* Popular ring + border beam */}
                      {cfg.isPopular && (
                        <>
                          <BorderBeam
                            duration={3}
                            colorFrom="rgba(255,45,120,0)"
                            colorTo="#ff2d78"
                          />
                          <div className="absolute -inset-px rounded-2xl ring-1 ring-pf-pink/30 pointer-events-none" />
                          {/* Top edge glow line */}
                          <div className="absolute top-0 left-[15%] right-[15%] h-px bg-gradient-to-r from-transparent via-pf-pink to-transparent opacity-60 pointer-events-none" />
                          <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                            <span
                              className={`inline-flex items-center gap-1 rounded-full border px-3 py-0.5 text-[11px] font-bold ${cfg.badgeClass} shadow-[0_0_12px_rgba(255,45,120,0.3)]`}
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
                          <dt className="text-muted-foreground">
                            {t("bankroll")}
                          </dt>
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
                            ? "bg-pf-pink hover:bg-pf-pink-dark text-white shadow-[0_0_20px_rgba(255,45,120,0.3)] group-hover:shadow-[0_0_30px_rgba(255,45,120,0.4)]"
                            : "border border-border hover:border-pf-brand/40 hover:bg-pf-brand/5 text-foreground hover:text-pf-brand"
                        }`}
                      >
                        {t("tiers_cta_short")}
                      </Link>
                    </div>
                  </GlowingCard>
                </ScrollReveal>
              );
            })}
          </div>

          <div className="text-center mt-10">
            <Link
              href="/challenges"
              className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl bg-pf-pink hover:bg-pf-pink-dark text-white font-bold text-sm shadow-pf-pink-glow hover:shadow-pf-pink-glow-lg transition-all duration-300 hover:-translate-y-0.5 group"
            >
              {t("tiers_cta")}
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
        </div>
      </section>

      {/* ━━ SPORTS COVERAGE ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="py-20 bg-card border-t border-white/[0.04]">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="w-8 h-px bg-pf-brand flex-shrink-0" />
            <span className="font-mono text-xs text-pf-brand uppercase tracking-[0.15em]">
              {t("eyebrow_markets")}
            </span>
          </div>
          <h2 className="font-display font-bold text-2xl sm:text-3xl font-extrabold text-white mb-3">
            {t("sports_title")}
          </h2>
          <p className="text-muted-foreground text-sm mb-8">
            {t("sports_subtitle")}
          </p>

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

      {/* ━━ BENTO FEATURES ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="py-20 bg-background border-t border-border">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <div className="text-center mb-12">
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="w-8 h-px bg-pf-brand flex-shrink-0" />
              <span className="font-mono text-xs text-pf-brand uppercase tracking-[0.15em]">
                {t("eyebrow_features")}
              </span>
            </div>
            <h2 className="font-display font-bold text-2xl sm:text-3xl text-foreground">
              {t("feature_built_title")}
            </h2>
          </div>

          {/* Bento Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 auto-rows-[minmax(160px,auto)]">
            {/* Big card — Real capital */}
            <GlowingCard
              className="sm:col-span-2 lg:col-span-2 lg:row-span-1"
              glowColor="201,168,76"
            >
              <div className="h-full p-7 rounded-2xl border border-pf-brand/20 hover:border-pf-brand/40 bg-gradient-to-br from-pf-brand/8 to-transparent transition-colors duration-300 group overflow-hidden relative">
                <div className="absolute bottom-0 right-0 w-48 h-48 bg-[radial-gradient(ellipse,rgba(201,168,76,0.08)_0%,transparent_70%)] pointer-events-none" />
                <div className="flex items-center justify-center w-11 h-11 rounded-xl border bg-pf-brand/10 border-pf-brand/25 text-pf-brand mb-5">
                  <Shield className="w-5 h-5" />
                </div>
                <p className="font-display font-bold text-xl text-foreground mb-2">
                  {t("feature_capital_title")}
                </p>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-sm">
                  {t("feature_capital_desc")}
                </p>
                {/* Mini balance bar */}
                <div className="mt-5 flex items-center gap-3">
                  <div className="flex-1 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                    <div className="h-full w-[72%] bg-gradient-to-r from-pf-brand/60 to-pf-brand rounded-full" />
                  </div>
                  <span className="font-mono text-[10px] text-pf-brand">
                    72% funded
                  </span>
                </div>
              </div>
            </GlowingCard>

            {/* Monthly payouts */}
            <GlowingCard glowColor="201,168,76">
              <div className="h-full p-6 rounded-2xl border border-pf-brand/15 hover:border-pf-brand/35 bg-gradient-to-b from-pf-brand/5 to-transparent transition-colors duration-300 group overflow-hidden relative">
                <div className="flex items-center justify-center w-10 h-10 rounded-xl border bg-pf-brand/10 border-pf-brand/20 text-pf-brand mb-4">
                  <DollarSign className="w-5 h-5" />
                </div>
                <p className="font-display font-bold text-base text-foreground mb-1.5">
                  {t("feature_payouts_title")}
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {t("feature_payouts_desc")}
                </p>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="font-display font-bold text-2xl text-pf-brand">
                    80%
                  </span>
                  <span className="text-xs text-muted-foreground">
                    max split
                  </span>
                </div>
              </div>
            </GlowingCard>

            {/* Live sports */}
            <GlowingCard glowColor="255,45,120">
              <div className="h-full p-6 rounded-2xl border border-pf-pink/15 hover:border-pf-pink/35 bg-gradient-to-b from-pf-pink/5 to-transparent transition-colors duration-300 group overflow-hidden">
                <div className="flex items-center justify-center w-10 h-10 rounded-xl border bg-pf-pink/10 border-pf-pink/20 text-pf-pink mb-4">
                  <Trophy className="w-5 h-5" />
                </div>
                <p className="font-display font-bold text-base text-foreground mb-1.5">
                  {t("feature_sports_title")}
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {t("feature_sports_desc")}
                </p>
                <div className="mt-4 flex gap-1.5 flex-wrap">
                  {["⚽", "🏀", "🏈", "🎾", "🥊"].map((emoji) => (
                    <span key={emoji} className="text-lg leading-none">
                      {emoji}
                    </span>
                  ))}
                </div>
              </div>
            </GlowingCard>

            {/* Two-phase system */}
            <GlowingCard glowColor="201,168,76">
              <div className="h-full p-6 rounded-2xl border border-white/[0.06] hover:border-pf-brand/25 bg-gradient-to-b from-white/[0.02] to-transparent transition-colors duration-300 group">
                <div className="flex items-center justify-center w-10 h-10 rounded-xl border bg-white/[0.05] border-white/[0.08] text-muted-foreground mb-4">
                  <Activity className="w-5 h-5" />
                </div>
                <p className="font-display font-bold text-base text-foreground mb-1.5">
                  {t("feature_eval_title")}
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {t("feature_eval_desc")}
                </p>
                {/* Phase indicators */}
                <div className="mt-4 flex gap-2">
                  <div className="flex-1 h-1 rounded-full bg-pf-brand/60" />
                  <div className="flex-1 h-1 rounded-full bg-white/[0.12]" />
                </div>
                <div className="flex justify-between mt-1">
                  <span className="font-mono text-[9px] text-pf-brand uppercase tracking-wider">
                    Phase 1 ✓
                  </span>
                  <span className="font-mono text-[9px] text-muted-foreground uppercase tracking-wider">
                    Phase 2
                  </span>
                </div>
              </div>
            </GlowingCard>

            {/* One-time fee */}
            <GlowingCard glowColor="255,45,120">
              <div className="h-full p-6 rounded-2xl border border-pf-pink/15 hover:border-pf-pink/30 bg-gradient-to-b from-pf-pink/5 to-transparent transition-colors duration-300 group">
                <div className="flex items-center justify-center w-10 h-10 rounded-xl border bg-pf-pink/10 border-pf-pink/20 text-pf-pink mb-4">
                  <Zap className="w-5 h-5" />
                </div>
                <p className="font-display font-bold text-base text-foreground mb-1.5">
                  {t("feature_fee_title")}
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {t("feature_fee_desc")}
                </p>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="font-display font-bold text-2xl text-pf-pink">
                    $19.99
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {t("feature_fee_start")}
                  </span>
                </div>
              </div>
            </GlowingCard>
          </div>
        </div>
      </section>

      {/* ━━ TESTIMONIALS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <TestimonialsMarquee />

      {/* ━━ FINAL CTA ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="relative py-28 overflow-hidden bg-background">
        {/* Gold radial glow center */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_80%_at_50%_50%,rgba(201,168,76,0.11)_0%,transparent_70%)] pointer-events-none" />
        <div className="absolute inset-0 bg-grid-gold opacity-40 pointer-events-none" />
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-pf-brand/20 to-transparent" />

        <div className="relative text-center max-w-2xl mx-auto px-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-pf-brand/25 bg-pf-brand/10 text-pf-brand text-xs font-semibold mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-pf-brand animate-pulse" />
            {hasExactCommercialTerms
              ? t("eyebrow_cta_join")
              : t("eyebrow_cta_coming")}
          </div>
          <h2 className="text-4xl sm:text-5xl font-extrabold text-white mb-4 leading-tight">
            {t("cta_title")}
          </h2>
          <p className="text-muted-foreground mb-10 text-sm leading-relaxed max-w-lg mx-auto">
            {hasExactCommercialTerms
              ? t("cta_subtitle")
              : t("cta_subtitle_review")}
          </p>
          <MovingBorderButton href="/challenges">
            {t("cta_button")}
            <ArrowRight className="w-5 h-5" />
          </MovingBorderButton>
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
