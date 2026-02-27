import { redirect, notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { getTranslations } from "next-intl/server";
import { createServerClient } from "@/lib/supabase";
import { prisma } from "@/lib/prisma";
import { BalanceChart } from "@/components/dashboard/BalanceChart";
import type { BalancePoint } from "@/components/dashboard/BalanceChart";
import { WinRateChart } from "@/components/dashboard/WinRateChart";
import type { WinRateEntry } from "@/components/dashboard/WinRateChart";
import { PicksTable } from "@/components/dashboard/PicksTable";
import type { PickRow } from "@/components/dashboard/PicksTable";
import { MetricBar } from "@/components/dashboard/MetricBar";
import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "dashboard" });
  return { title: t("challengeDetail") };
}

// ── Balance history computation ──────────────────────────────────────────────
// Reconstructs P&L curve from settled picks (no BalanceHistory table needed).
function computeBalanceHistory(
  picks: {
    status: string;
    stake: number;
    actualPayout: number;
    settledAt: Date | null;
    placedAt: Date;
  }[],
  startBalance: number,
  startedAt: Date,
): BalancePoint[] {
  const settled = picks
    .filter(
      (p) => ["won", "lost", "void", "push"].includes(p.status) && p.settledAt,
    )
    .sort(
      (a, b) =>
        new Date(a.settledAt!).getTime() - new Date(b.settledAt!).getTime(),
    );

  const fmt = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "short", day: "numeric" });

  const points: BalancePoint[] = [
    { label: fmt(startedAt), value: Math.round(startBalance / 100) },
  ];

  let balance = startBalance;
  for (const pick of settled) {
    // Net P&L impact: won = actualPayout - stake, lost = -stake, void/push = 0
    if (pick.status === "won") {
      balance += pick.actualPayout - pick.stake;
    } else if (pick.status === "lost") {
      balance -= pick.stake;
    }
    // void/push: no P&L change
    points.push({
      label: fmt(new Date(pick.settledAt!)),
      value: Math.round(balance / 100),
    });
  }

  return points;
}

// ── Win rate by category ──────────────────────────────────────────────────────
function buildWinRateData(
  picks: {
    status: string;
    sport: string;
    marketType: string;
    league: string;
  }[],
  groupBy: "sport" | "marketType" | "league",
  labelMap?: Record<string, string>,
): WinRateEntry[] {
  const settled = picks.filter((p) =>
    ["won", "lost", "push", "void"].includes(p.status),
  );

  const buckets: Record<
    string,
    { won: number; lost: number; push: number; void: number }
  > = {};

  for (const pick of settled) {
    const key = pick[groupBy];
    if (!buckets[key]) buckets[key] = { won: 0, lost: 0, push: 0, void: 0 };
    if (pick.status === "won") buckets[key].won++;
    else if (pick.status === "lost") buckets[key].lost++;
    else if (pick.status === "push") buckets[key].push++;
    else if (pick.status === "void") buckets[key].void++;
  }

  return Object.entries(buckets)
    .filter(([, v]) => v.won + v.lost > 0)
    .map(([key, v]) => ({
      category: labelMap?.[key] ?? key,
      ...v,
    }))
    .sort((a, b) => b.won + b.lost - (a.won + a.lost));
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default async function ChallengeDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;

  const supabase = createServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) redirect("/auth/login");

  const user = await prisma.user.findFirst({
    where: { supabaseId: session.user.id },
  });
  if (!user) redirect("/auth/login");

  const challenge = await prisma.challenge.findFirst({
    where: { id, userId: user.id },
    include: { tier: true },
  });

  if (!challenge) notFound();

  const picks = await prisma.pick.findMany({
    where: { challengeId: challenge.id },
    orderBy: { placedAt: "desc" },
  });

  const t = await getTranslations({ locale, namespace: "dashboard" });
  const tAnalytics = await getTranslations({ locale, namespace: "analytics" });

  // ── Computed metrics ──────────────────────────────────────────────────────
  const settledPicks = picks.filter((p) =>
    ["won", "lost", "push", "void"].includes(p.status),
  );
  const countWon = settledPicks.filter((p) => p.status === "won").length;
  const countLost = settledPicks.filter((p) => p.status === "lost").length;
  const countPush = settledPicks.filter((p) => p.status === "push").length;
  const countPending = picks.filter((p) => p.status === "pending").length;
  const countSettledForMin = countWon + countLost + countPush; // void excluded from minimum

  const winRate =
    countWon + countLost > 0
      ? Math.round((countWon / (countWon + countLost)) * 100)
      : 0;

  const totalStake = settledPicks.reduce((s, p) => s + p.stake, 0);
  const totalPayout = settledPicks.reduce((s, p) => {
    if (p.status === "won") return s + p.actualPayout;
    if (p.status === "lost") return s;
    if (p.status === "push" || p.status === "void") return s + p.stake;
    return s;
  }, 0);
  const netPnL = totalPayout - totalStake;
  const roi = totalStake > 0 ? ((netPnL / totalStake) * 100).toFixed(1) : "0.0";

  const avgOdds =
    settledPicks.length > 0
      ? (
          settledPicks.reduce((s, p) => s + p.odds, 0) / settledPicks.length
        ).toFixed(2)
      : "—";

  // ── Profit target ─────────────────────────────────────────────────────────
  const phaseStartBalance =
    challenge.phase === "phase1"
      ? (challenge.phase1StartBalance ?? challenge.startBalance)
      : (challenge.phase2StartBalance ?? challenge.startBalance);
  const targetPct =
    challenge.phase === "funded" ? 0 : challenge.phase === "phase2" ? 10 : 20;
  const profitTargetBalance = Math.floor(
    phaseStartBalance * (1 + targetPct / 100),
  );
  const profitRange = profitTargetBalance - phaseStartBalance;
  const profitProgress =
    profitRange > 0
      ? Math.max(
          0,
          Math.min(
            100,
            Math.round(
              ((challenge.balance - phaseStartBalance) / profitRange) * 100,
            ),
          ),
        )
      : 100;

  // ── Drawdown ──────────────────────────────────────────────────────────────
  const peak = challenge.peakBalance || challenge.startBalance;
  const drawdownCents = Math.max(0, peak - challenge.balance);
  const drawdownPct = (drawdownCents / peak) * 100;
  const drawdownBarPct = Math.min(100, Math.round((drawdownPct / 15) * 100));

  // ── Daily loss ────────────────────────────────────────────────────────────
  const daily = challenge.dailyStartBalance || challenge.startBalance;
  const dailyLossCents = Math.max(0, daily - challenge.balance);
  const dailyLossPct = daily > 0 ? (dailyLossCents / daily) * 100 : 0;
  const dailyBarPct = Math.min(100, Math.round((dailyLossPct / 10) * 100));

  // ── Balance history ───────────────────────────────────────────────────────
  const balanceHistory = computeBalanceHistory(
    picks.map((p) => ({
      status: p.status,
      stake: p.stake,
      actualPayout: p.actualPayout,
      settledAt: p.settledAt,
      placedAt: p.placedAt,
    })),
    challenge.startBalance,
    challenge.startedAt,
  );

  // ── Win rate by category ──────────────────────────────────────────────────
  const sportLabels: Record<string, string> = {
    basketball: tAnalytics("sport_basketball"),
    soccer: tAnalytics("sport_soccer"),
    americanfootball: tAnalytics("sport_americanfootball"),
    mma: tAnalytics("sport_mma"),
    tennis: tAnalytics("sport_tennis"),
  };
  const marketLabels: Record<string, string> = {
    moneyline: tAnalytics("market_moneyline"),
    spread: tAnalytics("market_spread"),
    total: tAnalytics("market_total"),
  };

  const winRateBySport = buildWinRateData(
    picks.map((p) => ({
      status: p.status,
      sport: p.sport,
      marketType: p.marketType,
      league: p.league,
    })),
    "sport",
    sportLabels,
  );
  const winRateByMarket = buildWinRateData(
    picks.map((p) => ({
      status: p.status,
      sport: p.sport,
      marketType: p.marketType,
      league: p.league,
    })),
    "marketType",
    marketLabels,
  );

  // ── Picks table data ──────────────────────────────────────────────────────
  const tableData: PickRow[] = picks.map((p) => ({
    id: p.id,
    eventName: p.eventName,
    league: p.league,
    sport: p.sport,
    marketType: p.marketType,
    selection: p.selection,
    odds: p.odds,
    stake: p.stake,
    potentialPayout: p.potentialPayout,
    actualPayout: p.actualPayout,
    status: p.status,
    placedAt: p.placedAt.toISOString(),
    settledAt: p.settledAt?.toISOString() ?? null,
  }));

  const tPicksObj = {
    all: tAnalytics("all"),
    won: tAnalytics("won"),
    lost: tAnalytics("lost"),
    pending: tAnalytics("pending"),
    void: tAnalytics("void"),
    push: tAnalytics("push"),
    noPicks: t("noPicks"),
    event: tAnalytics("event"),
    selection: tAnalytics("selection"),
    odds: tAnalytics("odds"),
    stake: tAnalytics("stake"),
    payout: tAnalytics("payout"),
    status: tAnalytics("status"),
    date: tAnalytics("date"),
    market_moneyline: tAnalytics("market_moneyline"),
    market_spread: tAnalytics("market_spread"),
    market_total: tAnalytics("market_total"),
  };

  const daysActive = Math.floor(
    (Date.now() - challenge.startedAt.getTime()) / (1000 * 60 * 60 * 24),
  );

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-8 space-y-8">
      {/* Back link */}
      <Link
        href="/dashboard"
        className="text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        {t("backToDashboard")}
      </Link>

      {/* ── Challenge header ────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">{challenge.tier.name}</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {t("startedAt")}:{" "}
            {challenge.startedAt.toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}{" "}
            · {daysActive} {t("daysActive")}
          </p>
        </div>
        <Link
          href="/dashboard/picks"
          className="px-4 py-2 rounded-lg bg-pf-brand text-white text-sm font-semibold hover:bg-pf-brand/90 transition-colors shrink-0"
        >
          {t("placePick")}
        </Link>
      </div>

      {/* ── Quick stats grid ────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {
            label: t("balance"),
            value: formatCents(challenge.balance),
            highlight: true,
          },
          {
            label: t("pnl"),
            value: (netPnL >= 0 ? "+" : "") + formatCents(Math.abs(netPnL)),
            positive: netPnL >= 0,
          },
          { label: t("winRate"), value: winRate + "%" },
          { label: tAnalytics("avgOdds"), value: avgOdds },
        ].map(({ label, value, highlight, positive }) => (
          <div
            key={label}
            className="rounded-xl border border-border bg-card p-4"
          >
            <p className="text-xs text-muted-foreground mb-1">{label}</p>
            <p
              className={`text-xl font-bold tabular-nums ${
                highlight
                  ? "text-foreground"
                  : positive === true
                    ? "text-pf-brand"
                    : positive === false
                      ? "text-red-400"
                      : "text-foreground"
              }`}
            >
              {value}
            </p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: tAnalytics("roi"), value: roi + "%" },
          { label: t("settledPicks"), value: String(countSettledForMin) },
          { label: t("pendingPicks"), value: String(countPending) },
          {
            label: t("picksProgress"),
            value: `${countSettledForMin} / ${challenge.tier.minPicks}`,
          },
        ].map(({ label, value }) => (
          <div
            key={label}
            className="rounded-xl border border-border bg-card p-4"
          >
            <p className="text-xs text-muted-foreground mb-1">{label}</p>
            <p className="text-xl font-bold tabular-nums">{value}</p>
          </div>
        ))}
      </div>

      {/* ── Risk meters ─────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Risk Limits
        </h2>
        <MetricBar
          label={
            challenge.phase === "phase2"
              ? t("profitTargetPhase2Label")
              : t("profitTargetLabel")
          }
          currentPct={profitProgress}
          displayValue={profitProgress + "%"}
          limitLabel={formatCents(profitTargetBalance)}
          variant="profit"
        />
        <MetricBar
          label={t("drawdownLabel")}
          currentPct={drawdownBarPct}
          displayValue={drawdownPct.toFixed(1) + "%"}
          limitLabel="15%"
          variant="drawdown"
        />
        <MetricBar
          label={t("dailyLossLabel")}
          currentPct={dailyBarPct}
          displayValue={dailyLossPct.toFixed(1) + "%"}
          limitLabel="10%"
          variant="daily"
        />
      </div>

      {/* ── Balance history chart ────────────────────────────────────────── */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
          {t("balanceHistory")}
        </h2>
        <BalanceChart
          data={balanceHistory}
          startBalance={Math.round(challenge.startBalance / 100)}
          profitTarget={Math.round(profitTargetBalance / 100)}
          noDataLabel={t("noData")}
        />
      </div>

      {/* ── Win rate charts ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
            {tAnalytics("bySport")}
          </h2>
          <WinRateChart
            data={winRateBySport}
            noDataLabel={tAnalytics("noData")}
          />
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
            {tAnalytics("byMarket")}
          </h2>
          <WinRateChart
            data={winRateByMarket}
            noDataLabel={tAnalytics("noData")}
          />
        </div>
      </div>

      {/* ── Picks history ────────────────────────────────────────────────── */}
      <section>
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          {tAnalytics("picksHistory")}
        </h2>
        <PicksTable picks={tableData} t={tPicksObj} />
      </section>
    </div>
  );
}
