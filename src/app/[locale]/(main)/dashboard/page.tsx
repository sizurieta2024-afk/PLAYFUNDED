import { redirect } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { getTranslations } from "next-intl/server";
import { createServerClient } from "@/lib/supabase";
import { prisma } from "@/lib/prisma";
import { ChallengeCard } from "@/components/dashboard/ChallengeCard";
import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "dashboard" });
  return { title: t("pageTitle") };
}

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  const supabase = await createServerClient();
  const {
    data: { user: authUser },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !authUser) {
    redirect("/auth/login");
  }

  const t = await getTranslations({ locale, namespace: "dashboard" });

  const user = await prisma.user.findFirst({
    where: { supabaseId: authUser.id },
  });

  if (!user) redirect("/auth/login");

  // Fetch all active/funded challenges with tier + picks
  const challenges = await prisma.challenge.findMany({
    where: {
      userId: user.id,
      status: { in: ["active", "funded"] },
    },
    include: {
      tier: true,
      picks: {
        where: { status: { not: "void" } },
        select: { status: true, stake: true },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 6,
  });

  // Recent picks across all challenges (last 8)
  const recentPicks = await prisma.pick.findMany({
    where: { userId: user.id },
    orderBy: { placedAt: "desc" },
    take: 8,
    select: {
      id: true,
      eventName: true,
      league: true,
      selection: true,
      odds: true,
      stake: true,
      actualPayout: true,
      status: true,
      placedAt: true,
    },
  });

  const tObj = {
    phase1: t("phase1"),
    phase2: t("phase2"),
    funded: t("funded"),
    balance: t("balance"),
    startBalance: t("startBalance"),
    profitTargetLabel: t("profitTargetLabel"),
    profitTargetPhase2Label: t("profitTargetPhase2Label"),
    drawdownLabel: t("drawdownLabel"),
    dailyLossLabel: t("dailyLossLabel"),
    daysActive: t("daysActive"),
    profitSplit: t("profitSplit"),
    picks: t("picks"),
    completed_picks: t("completed_picks"),
    pending: t("pending"),
    won: t("won"),
    lost: t("lost"),
    placePick: t("placePick"),
    viewDetail: t("viewDetail"),
    payouts: t("payouts"),
  };

  const STATUS_STYLES: Record<string, string> = {
    pending: "bg-yellow-500/15 text-yellow-500",
    won: "bg-pf-brand/15 text-pf-brand",
    lost: "bg-red-500/15 text-red-400",
    void: "bg-muted text-muted-foreground",
    push: "bg-muted text-muted-foreground",
  };

  function formatCents(cents: number) {
    return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  // Quick stats aggregates
  const totalPnlCents = challenges.reduce(
    (sum, c) => sum + (c.balance - c.startBalance),
    0,
  );
  const totalPnlPct =
    challenges.length > 0
      ? (
          (totalPnlCents /
            challenges.reduce((sum, c) => sum + c.startBalance, 0)) *
          100
        ).toFixed(1)
      : "0.0";
  const settledRecent = recentPicks.filter(
    (p) => p.status === "won" || p.status === "lost" || p.status === "push",
  );
  const wonRecent = recentPicks.filter((p) => p.status === "won").length;
  const winRate =
    settledRecent.length > 0
      ? ((wonRecent / settledRecent.length) * 100).toFixed(0)
      : "—";

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 py-6 space-y-6">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between border-b border-border pb-5">
        <div>
          <h1 className="text-xl font-display font-bold text-foreground">
            {t("pageTitle")}
          </h1>
          <p className="text-muted-foreground text-xs mt-0.5">
            {t("welcome")},{" "}
            <span className="text-foreground font-semibold">
              {authUser.user_metadata?.full_name ??
                authUser.user_metadata?.name ??
                authUser.email?.split("@")[0]}
            </span>
          </p>
        </div>
        <Link
          href="/dashboard/picks"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-pf-pink hover:bg-pf-pink-dark text-white text-xs font-bold transition-all duration-200 shadow-pf-pink-glow-sm hover:shadow-pf-pink-glow hover:-translate-y-0.5"
        >
          <span>+</span>
          {t("placePick")}
        </Link>
      </div>

      {/* ── Quick stats strip ────────────────────────────────────────────── */}
      {challenges.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            {
              label: t("activeChallenges"),
              value: `${challenges.length}`,
              sub: null,
              accent: "text-foreground",
            },
            {
              label: "P&L Total",
              value: formatCents(Math.abs(totalPnlCents)),
              sub: `${totalPnlCents >= 0 ? "+" : "-"}${Math.abs(Number(totalPnlPct))}%`,
              accent: totalPnlCents >= 0 ? "text-pf-brand" : "text-red-400",
            },
            {
              label: t("picks"),
              value: `${recentPicks.length}`,
              sub: "recientes",
              accent: "text-foreground",
            },
            {
              label: "Win Rate",
              value: winRate === "—" ? "—" : `${winRate}%`,
              sub:
                settledRecent.length > 0
                  ? `${settledRecent.length} picks`
                  : null,
              accent:
                winRate !== "—" && Number(winRate) >= 50
                  ? "text-pf-brand"
                  : "text-foreground",
            },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-xl border border-border bg-card p-4 flex flex-col gap-1"
            >
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
                {s.label}
              </p>
              <p
                className={`text-2xl font-extrabold tabular-nums tracking-tight ${s.accent}`}
              >
                {s.value}
              </p>
              {s.sub && (
                <p
                  className={`text-[11px] font-semibold ${totalPnlCents >= 0 && s.label === "P&L Total" ? "text-pf-brand/70" : "text-muted-foreground"}`}
                >
                  {s.sub}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Active challenges ────────────────────────────────────────────── */}
      {challenges.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card/50 p-12 text-center space-y-3">
          <p className="text-muted-foreground">{t("noActiveChallenges")}</p>
          <Link
            href="/challenges"
            className="inline-block px-5 py-2.5 rounded-lg bg-pf-pink text-white text-sm font-semibold hover:bg-pf-pink-dark transition-colors"
          >
            {t("buyFirstChallenge")}
          </Link>
        </div>
      ) : (
        <section>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            {t("activeChallenges")}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {challenges.map((challenge) => {
              const settledPicksCount = challenge.picks.filter(
                (p) =>
                  p.status === "won" ||
                  p.status === "lost" ||
                  p.status === "push",
              ).length;
              const pendingPicks = challenge.picks.filter(
                (p) => p.status === "pending",
              );
              const pendingPicksCount = pendingPicks.length;
              // Sum of stakes for pending bets — used so loss bars only move on settled losses
              const pendingStakeCents = pendingPicks.reduce(
                (sum, p) => sum + p.stake,
                0,
              );

              return (
                <ChallengeCard
                  key={challenge.id}
                  pendingStakeCents={pendingStakeCents}
                  challenge={{
                    id: challenge.id,
                    balance: challenge.balance,
                    startBalance: challenge.startBalance,
                    highestBalance: challenge.highestBalance,
                    peakBalance: challenge.peakBalance,
                    dailyStartBalance: challenge.dailyStartBalance,
                    phase: challenge.phase,
                    status: challenge.status,
                    startedAt: challenge.startedAt.toISOString(),
                    phase1StartBalance: challenge.phase1StartBalance,
                    phase2StartBalance: challenge.phase2StartBalance,
                    tier: {
                      name: challenge.tier.name,
                      profitSplitPct: challenge.tier.profitSplitPct,
                      minPicks: challenge.tier.minPicks,
                    },
                  }}
                  settledPicksCount={settledPicksCount}
                  pendingPicksCount={pendingPicksCount}
                  t={tObj}
                />
              );
            })}
          </div>
        </section>
      )}

      {/* ── Recent picks ─────────────────────────────────────────────────── */}
      {recentPicks.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
              {t("recentPicks")}
            </h2>
            <Link
              href="/dashboard/picks"
              className="text-[11px] text-pf-brand hover:text-pf-brand-dark font-semibold transition-colors"
            >
              Ver todos →
            </Link>
          </div>
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            {/* Table header */}
            <div className="hidden sm:grid grid-cols-[1fr_80px_70px_70px] gap-2 px-4 py-2 border-b border-border bg-muted/30">
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Selección
              </span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground text-center">
                Cuota
              </span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground text-right">
                Stake
              </span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground text-right">
                Estado
              </span>
            </div>
            {recentPicks.map((pick, i) => (
              <div
                key={pick.id}
                className={`grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_80px_70px_70px] gap-2 items-center px-4 py-3 hover:bg-muted/20 transition-colors ${
                  i < recentPicks.length - 1 ? "border-b border-border/60" : ""
                }`}
              >
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-foreground truncate">
                    {pick.selection}
                  </p>
                  <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                    {pick.eventName ?? pick.league}
                  </p>
                </div>
                <span className="hidden sm:block text-xs font-mono font-semibold text-center text-foreground/80 tabular-nums">
                  {pick.odds.toFixed(2)}
                </span>
                <span className="hidden sm:block text-xs text-right text-muted-foreground tabular-nums">
                  {formatCents(pick.stake)}
                </span>
                <div className="flex justify-end">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold ${
                      STATUS_STYLES[pick.status] ??
                      "bg-muted text-muted-foreground"
                    }`}
                  >
                    {t(pick.status as Parameters<typeof t>[0])}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
