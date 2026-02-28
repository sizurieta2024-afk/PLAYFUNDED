import { prisma } from "@/lib/prisma";

export default async function AdminOddsPage() {
  const now = new Date();
  const tenMinAgo = new Date(now.getTime() - 10 * 60 * 1000);
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

  // Latest fetch per provider
  const latestByProvider = await prisma.oddsCache.groupBy({
    by: ["provider"],
    _max: { fetchedAt: true },
    _count: { id: true },
  });

  // Total cached events
  const totalEvents = await prisma.oddsCache.count();
  const liveEvents = await prisma.oddsCache.count({ where: { isLive: true } });
  const upcomingEvents = await prisma.oddsCache.count({
    where: { startTime: { gte: now } },
  });

  // Events by sport
  const bySport = await prisma.oddsCache.groupBy({
    by: ["sport"],
    _count: { id: true },
    orderBy: { _count: { id: "desc" } },
  });

  // Events by league
  const byLeague = await prisma.oddsCache.groupBy({
    by: ["sport", "league"],
    _count: { id: true },
    orderBy: { _count: { id: "desc" } },
    take: 15,
  });

  // Stale events (not fetched in 10 min)
  const staleEvents = await prisma.oddsCache.count({
    where: { fetchedAt: { lt: tenMinAgo }, startTime: { gte: now } },
  });

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold">Odds Feed Health</h1>
        <p className="text-sm text-muted-foreground">
          Last checked: {now.toLocaleTimeString()}
        </p>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total Events", value: totalEvents, color: "text-foreground" },
          { label: "Live Events", value: liveEvents, color: "text-pf-brand" },
          { label: "Upcoming", value: upcomingEvents, color: "text-blue-400" },
          {
            label: "Stale (>10min)",
            value: staleEvents,
            color: staleEvents > 0 ? "text-red-400" : "text-muted-foreground",
          },
        ].map((kpi) => (
          <div key={kpi.label} className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground mb-1">{kpi.label}</p>
            <p className={`text-2xl font-bold tabular-nums ${kpi.color}`}>
              {kpi.value}
            </p>
          </div>
        ))}
      </div>

      {/* Provider health */}
      <div>
        <h2 className="text-base font-semibold mb-3">Provider Status</h2>
        {latestByProvider.length === 0 ? (
          <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
            <p className="text-sm text-red-400">No odds data fetched yet. Trigger a sync: POST /api/odds/sync</p>
          </div>
        ) : (
          <div className="rounded-xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  {["Provider", "Last Fetch", "Cached Events", "Status"].map((h) => (
                    <th key={h} className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {latestByProvider.map((p) => {
                  const lastFetch = p._max.fetchedAt;
                  const isHealthy = lastFetch && lastFetch > tenMinAgo;
                  const isWarning = lastFetch && lastFetch > oneHourAgo && !isHealthy;
                  return (
                    <tr key={p.provider} className="border-b border-border last:border-0">
                      <td className="px-4 py-3 font-mono text-xs text-foreground">{p.provider}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {lastFetch ? new Date(lastFetch).toLocaleString() : "Never"}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-muted-foreground">{p._count.id}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-md text-xs font-semibold ${
                          isHealthy ? "bg-pf-brand/15 text-pf-brand" :
                          isWarning ? "bg-amber-500/15 text-amber-400" :
                          "bg-red-500/15 text-red-400"
                        }`}>
                          {isHealthy ? "Healthy" : isWarning ? "Stale" : "Down"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Events by sport */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div>
          <h2 className="text-base font-semibold mb-3">Events by Sport</h2>
          <div className="rounded-xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Sport</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Events</th>
                </tr>
              </thead>
              <tbody>
                {bySport.map((s) => (
                  <tr key={s.sport} className="border-b border-border last:border-0">
                    <td className="px-4 py-2.5 text-sm capitalize text-foreground">{s.sport}</td>
                    <td className="px-4 py-2.5 tabular-nums text-muted-foreground">{s._count.id}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <h2 className="text-base font-semibold mb-3">Top Leagues</h2>
          <div className="rounded-xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">League</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Events</th>
                </tr>
              </thead>
              <tbody>
                {byLeague.map((l) => (
                  <tr key={`${l.sport}-${l.league}`} className="border-b border-border last:border-0">
                    <td className="px-4 py-2.5 text-xs text-foreground">
                      <span className="text-muted-foreground">{l.sport} · </span>{l.league}
                    </td>
                    <td className="px-4 py-2.5 tabular-nums text-muted-foreground">{l._count.id}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Sync action */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-sm font-semibold mb-2">Manual Sync</h2>
        <p className="text-xs text-muted-foreground mb-3">
          Trigger an immediate odds sync. Requires CRON_SECRET header.
        </p>
        <code className="text-xs font-mono bg-muted px-3 py-2 rounded-lg block text-muted-foreground">
          curl -X POST /api/odds/sync -H &quot;Authorization: Bearer CRON_SECRET&quot;
        </code>
      </div>
    </div>
  );
}
