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

  const supabase = createServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect("/auth/login");
  }

  const t = await getTranslations({ locale, namespace: "dashboard" });

  const user = await prisma.user.findFirst({
    where: { supabaseId: session.user.id },
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
        select: { status: true },
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

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-8 space-y-8">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("pageTitle")}</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {t("welcome")},{" "}
            <span className="text-foreground font-medium">
              {session.user.user_metadata?.full_name ??
                session.user.user_metadata?.name ??
                session.user.email?.split("@")[0]}
            </span>
          </p>
        </div>
        <Link
          href="/challenges"
          className="px-4 py-2 rounded-lg bg-pf-brand text-white text-sm font-semibold hover:bg-pf-brand/90 transition-colors"
        >
          + {t("placePick")}
        </Link>
      </div>

      {/* ── Active challenges ────────────────────────────────────────────── */}
      {challenges.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card/50 p-12 text-center space-y-3">
          <p className="text-muted-foreground">{t("noActiveChallenges")}</p>
          <Link
            href="/challenges"
            className="inline-block px-5 py-2.5 rounded-lg bg-pf-brand text-white text-sm font-semibold hover:bg-pf-brand/90 transition-colors"
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
              const pendingPicksCount = challenge.picks.filter(
                (p) => p.status === "pending",
              ).length;

              return (
                <ChallengeCard
                  key={challenge.id}
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

      {/* ── Quick links ──────────────────────────────────────────────────── */}
      <section className="flex flex-wrap gap-2">
        {[
          { href: "/dashboard/picks", label: t("placePick") },
          { href: "/dashboard/analytics", label: t("viewAnalytics") },
          { href: "/dashboard/payouts", label: t("payouts") },
          { href: "/dashboard/affiliate", label: "Affiliate" },
          { href: "/dashboard/settings", label: t("settings") },
        ].map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="px-3 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            {link.label}
          </Link>
        ))}
      </section>

      {/* ── Recent picks ─────────────────────────────────────────────────── */}
      {recentPicks.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            {t("recentPicks")}
          </h2>
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            {recentPicks.map((pick, i) => (
              <div
                key={pick.id}
                className={`flex items-center justify-between gap-3 px-4 py-3 ${
                  i < recentPicks.length - 1 ? "border-b border-border" : ""
                }`}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium truncate">
                    {pick.selection}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {pick.eventName ?? pick.league} ·{" "}
                    <span className="tabular-nums">{pick.odds.toFixed(2)}</span>
                  </p>
                </div>
                <div className="text-right shrink-0 space-y-1">
                  <span
                    className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                      STATUS_STYLES[pick.status] ??
                      "bg-muted text-muted-foreground"
                    }`}
                  >
                    {t(pick.status as Parameters<typeof t>[0])}
                  </span>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {formatCents(pick.stake)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
