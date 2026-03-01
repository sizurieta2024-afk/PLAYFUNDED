import { redirect } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { getTranslations } from "next-intl/server";
import { createServerClient } from "@/lib/supabase";
import { prisma } from "@/lib/prisma";
import { WinRateChart } from "@/components/dashboard/WinRateChart";
import type { WinRateEntry } from "@/components/dashboard/WinRateChart";
import { PicksTable } from "@/components/dashboard/PicksTable";
import type { PickRow } from "@/components/dashboard/PicksTable";
import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "analytics" });
  return { title: t("pageTitle") };
}

function buildWinRateData(
  picks: {
    status: string;
    sport: string;
    marketType: string;
    league: string;
  }[],
  groupBy: "sport" | "marketType",
  labelMap: Record<string, string>,
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
    .map(([key, v]) => ({ category: labelMap[key] ?? key, ...v }))
    .sort((a, b) => b.won + b.lost - (a.won + a.lost));
}

export default async function AnalyticsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  const supabase = createServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) redirect("/auth/login");

  const user = await prisma.user.findFirst({
    where: { supabaseId: session.user.id },
  });
  if (!user) redirect("/auth/login");

  const t = await getTranslations({ locale, namespace: "analytics" });
  const tDash = await getTranslations({ locale, namespace: "dashboard" });

  // All picks for this user, most recent challenge preferred
  const allPicks = await prisma.pick.findMany({
    where: { userId: user.id },
    orderBy: { placedAt: "desc" },
    take: 500,
  });

  // Summary stats across all picks
  const settled = allPicks.filter((p) =>
    ["won", "lost", "push"].includes(p.status),
  );
  const countWon = settled.filter((p) => p.status === "won").length;
  const countLost = settled.filter((p) => p.status === "lost").length;
  const winRate =
    countWon + countLost > 0
      ? Math.round((countWon / (countWon + countLost)) * 100)
      : 0;

  const totalStake = settled.reduce((s, p) => s + p.stake, 0);
  const totalPayout = settled.reduce((s, p) => {
    if (p.status === "won") return s + p.actualPayout;
    if (p.status === "push") return s + p.stake;
    return s;
  }, 0);
  const netPnL = totalPayout - totalStake;
  const roi = totalStake > 0 ? ((netPnL / totalStake) * 100).toFixed(1) : "0.0";
  const avgOdds =
    settled.length > 0
      ? (settled.reduce((s, p) => s + p.odds, 0) / settled.length).toFixed(2)
      : "—";

  // Charts
  const sportLabels: Record<string, string> = {
    basketball: t("sport_basketball"),
    soccer: t("sport_soccer"),
    americanfootball: t("sport_americanfootball"),
    mma: t("sport_mma"),
    tennis: t("sport_tennis"),
  };
  const marketLabels: Record<string, string> = {
    moneyline: t("market_moneyline"),
    spread: t("market_spread"),
    total: t("market_total"),
  };

  const picksForCharts = allPicks.map((p) => ({
    status: p.status,
    sport: p.sport,
    marketType: p.marketType,
    league: p.league,
  }));

  const winRateBySport = buildWinRateData(picksForCharts, "sport", sportLabels);
  const winRateByMarket = buildWinRateData(
    picksForCharts,
    "marketType",
    marketLabels,
  );

  // Picks table
  const tableData: PickRow[] = allPicks.slice(0, 200).map((p) => ({
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
    all: t("all"),
    won: t("won"),
    lost: t("lost"),
    pending: t("pending"),
    void: t("void"),
    push: t("push"),
    noPicks: tDash("noPicks"),
    event: t("event"),
    selection: t("selection"),
    odds: t("odds"),
    stake: t("stake"),
    payout: t("payout"),
    status: t("status"),
    date: t("date"),
    market_moneyline: t("market_moneyline"),
    market_spread: t("market_spread"),
    market_total: t("market_total"),
  };

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-8 space-y-8">
      <Link
        href="/dashboard"
        className="text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        {tDash("backToDashboard")}
      </Link>

      <h1 className="text-2xl font-bold">{t("pageTitle")}</h1>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: t("winRate"), value: winRate + "%" },
          { label: t("roi"), value: roi + "%" },
          { label: t("avgOdds"), value: avgOdds },
          { label: t("totalPicks"), value: String(allPicks.length) },
        ].map(({ label, value }) => (
          <div
            key={label}
            className="rounded-xl border border-border bg-card p-4"
          >
            <p className="text-xs text-muted-foreground mb-1">{label}</p>
            <p className="text-2xl font-bold tabular-nums">{value}</p>
          </div>
        ))}
      </div>

      {/* Win rate charts */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
            {t("bySport")}
          </h2>
          <WinRateChart data={winRateBySport} noDataLabel={t("noData")} />
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
            {t("byMarket")}
          </h2>
          <WinRateChart data={winRateByMarket} noDataLabel={t("noData")} />
        </div>
      </div>

      {/* Full picks history table */}
      <section>
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          {t("picksHistory")}
        </h2>
        <PicksTable picks={tableData} t={tPicksObj} />
      </section>
    </div>
  );
}
