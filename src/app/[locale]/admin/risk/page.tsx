import { prisma } from "@/lib/prisma";
import { Link } from "@/i18n/navigation";

// Risk rules constants (mirror of src/lib/challenge/risk.ts)
const DRAWDOWN_LIMIT_PCT = 15; // balance can't drop >15% from peak
const DAILY_LOSS_LIMIT_PCT = 10; // daily loss can't exceed 10% of phase start balance

function fmt(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function riskColor(pctUsed: number) {
  if (pctUsed >= 90) return "text-red-400";
  if (pctUsed >= 70) return "text-amber-400";
  return "text-pf-brand";
}

function riskBg(pctUsed: number) {
  if (pctUsed >= 90) return "bg-red-500/10 border-red-500/30";
  if (pctUsed >= 70) return "bg-amber-500/10 border-amber-500/30";
  return "border-border";
}

function RiskBar({ pct }: { pct: number }) {
  const clamped = Math.min(100, Math.max(0, pct));
  const color =
    clamped >= 90 ? "bg-red-400" : clamped >= 70 ? "bg-amber-400" : "bg-pf-brand";
  return (
    <div className="h-1.5 w-24 rounded-full bg-muted overflow-hidden">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${clamped}%` }} />
    </div>
  );
}

export default async function AdminRiskPage() {
  const now = new Date();

  // Fetch all active + funded challenges with user + tier + pending picks
  const challenges = await prisma.challenge.findMany({
    where: { status: { in: ["active", "funded"] } },
    include: {
      user: { select: { id: true, email: true, name: true } },
      tier: { select: { name: true, fundedBankroll: true } },
      picks: {
        where: { status: "pending" },
        select: { id: true, stake: true, potentialPayout: true, odds: true, eventName: true, event: true, placedAt: true },
      },
    },
  });

  // Calculate risk metrics per challenge
  const withMetrics = challenges.map((c) => {
    const drawdownPct =
      c.highestBalance > 0
        ? ((c.highestBalance - c.balance) / c.highestBalance) * 100
        : 0;
    const drawdownUsedPct = (drawdownPct / DRAWDOWN_LIMIT_PCT) * 100;

    const dailyLoss = Math.max(0, c.dailyStartBalance - c.balance);
    const dailyLossLimit = Math.floor((c.startBalance * DAILY_LOSS_LIMIT_PCT) / 100);
    const dailyLossUsedPct =
      dailyLossLimit > 0 ? (dailyLoss / dailyLossLimit) * 100 : 0;

    const openStake = c.picks.reduce((s, p) => s + p.stake, 0);
    const openExposure = c.picks.reduce((s, p) => s + p.potentialPayout, 0);

    // How long is oldest pending pick?
    const oldestPick = c.picks.reduce<Date | null>((oldest, p) => {
      const d = new Date(p.placedAt);
      return oldest === null || d < oldest ? d : oldest;
    }, null);
    const oldestPickHours = oldestPick
      ? (now.getTime() - oldestPick.getTime()) / 3_600_000
      : null;

    return {
      ...c,
      drawdownPct,
      drawdownUsedPct,
      dailyLoss,
      dailyLossLimit,
      dailyLossUsedPct,
      openStake,
      openExposure,
      oldestPickHours,
    };
  });

  // Categorize
  const nearDrawdown = withMetrics
    .filter((c) => c.drawdownUsedPct >= 50)
    .sort((a, b) => b.drawdownUsedPct - a.drawdownUsedPct);

  const nearDailyLimit = withMetrics
    .filter((c) => c.dailyLossUsedPct >= 40 && c.dailyStartBalance > 0)
    .sort((a, b) => b.dailyLossUsedPct - a.dailyLossUsedPct);

  const paused = await prisma.challenge.findMany({
    where: {
      status: "active",
      pausedUntil: { gt: now },
    },
    include: {
      user: { select: { email: true, name: true } },
      tier: { select: { name: true } },
    },
    orderBy: { pausedUntil: "asc" },
  });

  const bigPositions = withMetrics
    .filter((c) => c.openStake > 0)
    .sort((a, b) => b.openStake - a.openStake)
    .slice(0, 20);

  const stuckPicks = await prisma.pick.findMany({
    where: {
      status: "pending",
      placedAt: { lt: new Date(now.getTime() - 24 * 3_600_000) },
    },
    orderBy: { placedAt: "asc" },
    take: 30,
    include: {
      user: { select: { email: true, name: true } },
      challenge: { include: { tier: { select: { name: true } } } },
    },
  });

  const fundedTraders = withMetrics
    .filter((c) => c.status === "funded")
    .sort((a, b) => b.balance - a.balance);

  return (
    <div className="space-y-10 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold">Risk Monitor</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Live risk dashboard · drawdown limit {DRAWDOWN_LIMIT_PCT}% · daily loss limit {DAILY_LOSS_LIMIT_PCT}%
        </p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          {
            label: "Near Drawdown",
            value: nearDrawdown.length,
            sub: "≥50% of 15% limit used",
            color: nearDrawdown.length > 0 ? "text-red-400" : "text-muted-foreground",
          },
          {
            label: "Near Daily Limit",
            value: nearDailyLimit.length,
            sub: "≥40% of daily limit used",
            color: nearDailyLimit.length > 0 ? "text-amber-400" : "text-muted-foreground",
          },
          {
            label: "Paused Today",
            value: paused.length,
            sub: "daily loss hit",
            color: paused.length > 0 ? "text-amber-400" : "text-muted-foreground",
          },
          {
            label: "Stuck Picks",
            value: stuckPicks.length,
            sub: "pending >24h",
            color: stuckPicks.length > 0 ? "text-red-400" : "text-muted-foreground",
          },
          {
            label: "Funded Traders",
            value: fundedTraders.length,
            sub: `${fmt(fundedTraders.reduce((s, c) => s + c.balance, 0))} total exposure`,
            color: "text-pf-brand",
          },
        ].map((kpi) => (
          <div key={kpi.label} className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground mb-1">{kpi.label}</p>
            <p className={`text-2xl font-bold tabular-nums ${kpi.color}`}>{kpi.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{kpi.sub}</p>
          </div>
        ))}
      </div>

      {/* Near Drawdown */}
      <section>
        <h2 className="text-base font-semibold mb-3">
          Drawdown Watch ({nearDrawdown.length})
        </h2>
        {nearDrawdown.length === 0 ? (
          <p className="text-sm text-muted-foreground">All traders are within safe drawdown limits.</p>
        ) : (
          <div className="rounded-xl border border-border overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  {["Trader", "Tier", "Phase", "Peak", "Current", "Drawdown", "Risk", "Limit Used"].map((h) => (
                    <th key={h} className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {nearDrawdown.map((c) => (
                  <tr key={c.id} className={`border-b border-border last:border-0 ${c.drawdownUsedPct >= 90 ? "bg-red-500/5" : ""}`}>
                    <td className="px-4 py-3">
                      <Link href={`/admin/users/${c.user.id}` as never} className="text-xs font-medium text-foreground hover:text-pf-brand transition-colors">
                        {c.user.name ?? c.user.email.split("@")[0]}
                      </Link>
                      <p className="text-[10px] text-muted-foreground">{c.user.email}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{c.tier.name}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground capitalize">{c.phase}</td>
                    <td className="px-4 py-3 tabular-nums text-xs">{fmt(c.highestBalance)}</td>
                    <td className="px-4 py-3 tabular-nums text-xs">{fmt(c.balance)}</td>
                    <td className={`px-4 py-3 tabular-nums text-xs font-semibold ${riskColor(c.drawdownUsedPct)}`}>
                      -{c.drawdownPct.toFixed(1)}%
                    </td>
                    <td className="px-4 py-3">
                      <RiskBar pct={c.drawdownUsedPct} />
                    </td>
                    <td className={`px-4 py-3 tabular-nums text-xs font-bold ${riskColor(c.drawdownUsedPct)}`}>
                      {c.drawdownUsedPct.toFixed(0)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Near Daily Loss Limit */}
      <section>
        <h2 className="text-base font-semibold mb-3">
          Daily Loss Watch ({nearDailyLimit.length})
        </h2>
        {nearDailyLimit.length === 0 ? (
          <p className="text-sm text-muted-foreground">No traders near daily loss limit today.</p>
        ) : (
          <div className="rounded-xl border border-border overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  {["Trader", "Tier", "Day Start", "Current", "Daily Loss", "Limit", "Used"].map((h) => (
                    <th key={h} className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {nearDailyLimit.map((c) => (
                  <tr key={c.id} className={`border-b border-border last:border-0 ${c.dailyLossUsedPct >= 90 ? "bg-red-500/5" : ""}`}>
                    <td className="px-4 py-3">
                      <Link href={`/admin/users/${c.user.id}` as never} className="text-xs font-medium text-foreground hover:text-pf-brand transition-colors">
                        {c.user.name ?? c.user.email.split("@")[0]}
                      </Link>
                      <p className="text-[10px] text-muted-foreground">{c.user.email}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{c.tier.name}</td>
                    <td className="px-4 py-3 tabular-nums text-xs">{fmt(c.dailyStartBalance)}</td>
                    <td className="px-4 py-3 tabular-nums text-xs">{fmt(c.balance)}</td>
                    <td className={`px-4 py-3 tabular-nums text-xs font-semibold ${riskColor(c.dailyLossUsedPct)}`}>
                      -{fmt(c.dailyLoss)}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-xs text-muted-foreground">{fmt(c.dailyLossLimit)}</td>
                    <td className={`px-4 py-3 tabular-nums text-xs font-bold ${riskColor(c.dailyLossUsedPct)}`}>
                      {c.dailyLossUsedPct.toFixed(0)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Stuck Picks */}
      {stuckPicks.length > 0 && (
        <section>
          <h2 className="text-base font-semibold mb-3">
            Stuck Picks — Pending &gt;24h ({stuckPicks.length})
          </h2>
          <div className="rounded-xl border border-red-500/20 bg-red-500/5 overflow-x-auto">
            <table className="w-full text-sm min-w-[600px]">
              <thead>
                <tr className="border-b border-red-500/20">
                  {["Trader", "Tier", "Event", "Stake", "Odds", "Age", "Placed"].map((h) => (
                    <th key={h} className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {stuckPicks.map((p) => {
                  const hoursOld = (now.getTime() - new Date(p.placedAt).getTime()) / 3_600_000;
                  return (
                    <tr key={p.id} className="border-b border-red-500/10 last:border-0">
                      <td className="px-4 py-3">
                        <p className="text-xs font-medium text-foreground">{p.user.name ?? p.user.email.split("@")[0]}</p>
                        <p className="text-[10px] text-muted-foreground">{p.user.email}</p>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{p.challenge?.tier.name ?? "—"}</td>
                      <td className="px-4 py-3 text-xs text-foreground max-w-[140px] truncate">
                        {p.eventName ?? p.event}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-xs">{fmt(p.stake)}</td>
                      <td className="px-4 py-3 tabular-nums text-xs">{p.odds.toFixed(2)}</td>
                      <td className="px-4 py-3 tabular-nums text-xs text-red-400 font-semibold">
                        {hoursOld.toFixed(0)}h
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(p.placedAt).toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Paused Challenges */}
      {paused.length > 0 && (
        <section>
          <h2 className="text-base font-semibold mb-3">
            Paused Challenges ({paused.length})
          </h2>
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-amber-500/20">
                  {["Trader", "Tier", "Phase", "Balance", "Unpauses At"].map((h) => (
                    <th key={h} className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paused.map((c) => (
                  <tr key={c.id} className="border-b border-amber-500/10 last:border-0">
                    <td className="px-4 py-3">
                      <p className="text-xs font-medium text-foreground">{c.user.name ?? c.user.email.split("@")[0]}</p>
                      <p className="text-[10px] text-muted-foreground">{c.user.email}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{c.tier.name}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground capitalize">{c.phase}</td>
                    <td className="px-4 py-3 tabular-nums text-xs">{fmt(c.balance)}</td>
                    <td className="px-4 py-3 text-xs text-amber-400 whitespace-nowrap">
                      {c.pausedUntil ? new Date(c.pausedUntil).toLocaleString() : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Big Open Positions */}
      <section>
        <h2 className="text-base font-semibold mb-3">
          Open Positions ({bigPositions.length} traders with pending picks)
        </h2>
        {bigPositions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No open positions.</p>
        ) : (
          <div className="rounded-xl border border-border overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  {["Trader", "Tier", "Balance", "Open Picks", "Staked", "Max Payout", "Balance at Risk"].map((h) => (
                    <th key={h} className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {bigPositions.map((c) => {
                  const balanceAtRiskPct = c.balance > 0 ? (c.openStake / c.balance) * 100 : 0;
                  return (
                    <tr key={c.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-3">
                        <Link href={`/admin/users/${c.user.id}` as never} className="text-xs font-medium text-foreground hover:text-pf-brand transition-colors">
                          {c.user.name ?? c.user.email.split("@")[0]}
                        </Link>
                        <p className="text-[10px] text-muted-foreground">{c.user.email}</p>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{c.tier.name}</td>
                      <td className="px-4 py-3 tabular-nums text-xs">{fmt(c.balance)}</td>
                      <td className="px-4 py-3 tabular-nums text-xs text-foreground">{c.picks.length}</td>
                      <td className="px-4 py-3 tabular-nums text-xs font-semibold">{fmt(c.openStake)}</td>
                      <td className="px-4 py-3 tabular-nums text-xs text-pf-brand">{fmt(c.openExposure)}</td>
                      <td className={`px-4 py-3 tabular-nums text-xs font-bold ${balanceAtRiskPct >= 10 ? "text-amber-400" : "text-muted-foreground"}`}>
                        {balanceAtRiskPct.toFixed(1)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Funded traders liability */}
      {fundedTraders.length > 0 && (
        <section>
          <h2 className="text-base font-semibold mb-3">
            Funded Traders — Payout Liability
          </h2>
          <div className="rounded-xl border border-border overflow-x-auto">
            <table className="w-full text-sm min-w-[600px]">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  {["Trader", "Tier", "Starting Bankroll", "Current Balance", "Profit", "Max Payout (split)", "Streak"].map((h) => (
                    <th key={h} className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {fundedTraders.map((c) => {
                  const profit = Math.max(0, c.balance - c.tier.fundedBankroll);
                  // max payout = gross profit (admin can see the liability before split)
                  return (
                    <tr key={c.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-3">
                        <Link href={`/admin/users/${c.user.id}` as never} className="text-xs font-medium text-foreground hover:text-pf-brand transition-colors">
                          {c.user.name ?? c.user.email.split("@")[0]}
                        </Link>
                        <p className="text-[10px] text-muted-foreground">{c.user.email}</p>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{c.tier.name}</td>
                      <td className="px-4 py-3 tabular-nums text-xs">{fmt(c.tier.fundedBankroll)}</td>
                      <td className="px-4 py-3 tabular-nums text-xs font-semibold">{fmt(c.balance)}</td>
                      <td className="px-4 py-3 tabular-nums text-xs font-semibold text-pf-brand">
                        +{fmt(profit)}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-xs text-amber-400 font-semibold">
                        {fmt(profit)}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-xs text-muted-foreground">
                        {c.currentStreak > 0 ? `${c.currentStreak} mo.` : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
