import { prisma } from "@/lib/prisma";

function fmt(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-blue-500/15 text-blue-400",
  won: "bg-pf-brand/15 text-pf-brand",
  lost: "bg-red-500/15 text-red-400",
  void: "bg-muted text-muted-foreground",
  push: "bg-amber-500/15 text-amber-400",
};

export default async function AdminPicksPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const { status, page } = await searchParams;
  const statusFilter = status && status !== "all" ? status : undefined;
  const pageNum = Math.max(1, parseInt(page ?? "1", 10));
  const take = 50;
  const skip = (pageNum - 1) * take;

  // Summary stats
  const [total, pending, won, lost, totalProfit] =
    await Promise.all([
      prisma.pick.count(),
      prisma.pick.count({ where: { status: "pending" } }),
      prisma.pick.count({ where: { status: "won" } }),
      prisma.pick.count({ where: { status: "lost" } }),
      // Profit = sum(actualPayout - stake) for settled picks
      prisma.pick.aggregate({
        where: { status: { in: ["won", "lost"] } },
        _sum: { actualPayout: true, stake: true },
      }),
    ]);

  const settled = won + lost;
  const winRate = settled > 0 ? Math.round((won / settled) * 100) : null;
  const grossProfit =
    (totalProfit._sum.actualPayout ?? 0) - (totalProfit._sum.stake ?? 0);

  // Picks list
  const [picks, count] = await Promise.all([
    prisma.pick.findMany({
      where: statusFilter ? { status: statusFilter as never } : {},
      orderBy: { placedAt: "desc" },
      take,
      skip,
      include: {
        user: { select: { email: true, name: true } },
        challenge: { include: { tier: { select: { name: true } } } },
      },
    }),
    prisma.pick.count({
      where: statusFilter ? { status: statusFilter as never } : {},
    }),
  ]);

  const totalPages = Math.ceil(count / take);
  const statuses = ["all", "pending", "won", "lost", "void", "push"];

  return (
    <div className="space-y-6 max-w-7xl">
      <div>
        <h1 className="text-2xl font-bold">Picks Monitor</h1>
        <p className="text-sm text-muted-foreground mt-1">
          All picks across all traders
        </p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: "Total", value: total, color: "text-foreground" },
          { label: "Pending", value: pending, color: "text-blue-400" },
          { label: "Won", value: won, color: "text-pf-brand" },
          { label: "Lost", value: lost, color: "text-red-400" },
          {
            label: "Win Rate",
            value: winRate !== null ? `${winRate}%` : "—",
            color: winRate !== null && winRate >= 50 ? "text-pf-brand" : "text-amber-400",
          },
          {
            label: "Trader P&L",
            value: fmt(grossProfit),
            color: grossProfit >= 0 ? "text-pf-brand" : "text-red-400",
          },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className="rounded-xl border border-border bg-card p-4"
          >
            <p className="text-xs text-muted-foreground mb-1">{kpi.label}</p>
            <p className={`text-xl font-bold tabular-nums ${kpi.color}`}>
              {kpi.value}
            </p>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="flex gap-2 flex-wrap">
        {statuses.map((s) => (
          <a
            key={s}
            href={`?status=${s}`}
            className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors capitalize ${
              (status ?? "all") === s
                ? "border-pf-brand bg-pf-brand/10 text-pf-brand"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {s}
          </a>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              {[
                "Trader",
                "Tier",
                "Event",
                "Market",
                "Selection",
                "Odds",
                "Stake",
                "Status",
                "P&L",
                "Placed",
              ].map((h) => (
                <th
                  key={h}
                  className="text-left px-3 py-2.5 text-xs font-medium text-muted-foreground whitespace-nowrap"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {picks.length === 0 && (
              <tr>
                <td
                  colSpan={10}
                  className="px-4 py-8 text-sm text-muted-foreground text-center"
                >
                  No picks found
                </td>
              </tr>
            )}
            {picks.map((p) => {
              const pnl = p.status === "won"
                ? p.actualPayout - p.stake
                : p.status === "lost"
                  ? -p.stake
                  : 0;
              return (
                <tr key={p.id} className="border-b border-border last:border-0">
                  <td className="px-3 py-3">
                    <p className="text-xs font-medium text-foreground truncate max-w-[110px]">
                      {p.user.name ?? p.user.email.split("@")[0]}
                    </p>
                    <p className="text-[10px] text-muted-foreground truncate max-w-[110px]">
                      {p.user.email}
                    </p>
                  </td>
                  <td className="px-3 py-3 text-xs text-muted-foreground">
                    {p.challenge?.tier.name ?? "—"}
                  </td>
                  <td className="px-3 py-3 text-xs text-foreground max-w-[140px]">
                    <p className="truncate">{p.eventName ?? p.event}</p>
                    <p className="text-[10px] text-muted-foreground capitalize">
                      {p.sport} · {p.league}
                    </p>
                  </td>
                  <td className="px-3 py-3 text-xs text-muted-foreground capitalize">
                    {p.marketType.replace(/_/g, " ")}
                  </td>
                  <td className="px-3 py-3 text-xs text-foreground max-w-[100px] truncate">
                    {p.selection}
                    {p.linePoint !== null && (
                      <span className="text-muted-foreground ml-1">
                        ({p.linePoint > 0 ? "+" : ""}
                        {p.linePoint})
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3 tabular-nums text-xs text-foreground">
                    {p.odds.toFixed(2)}
                  </td>
                  <td className="px-3 py-3 tabular-nums text-xs text-foreground">
                    {fmt(p.stake)}
                  </td>
                  <td className="px-3 py-3">
                    <span
                      className={`inline-flex px-2 py-0.5 rounded-md text-xs font-semibold ${STATUS_COLORS[p.status] ?? "bg-muted text-muted-foreground"}`}
                    >
                      {p.status}
                    </span>
                  </td>
                  <td
                    className={`px-3 py-3 tabular-nums text-xs font-semibold ${pnl > 0 ? "text-pf-brand" : pnl < 0 ? "text-red-400" : "text-muted-foreground"}`}
                  >
                    {p.status === "pending"
                      ? "—"
                      : `${pnl >= 0 ? "+" : ""}${fmt(pnl)}`}
                  </td>
                  <td className="px-3 py-3 text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(p.placedAt).toLocaleDateString()}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center gap-2 text-sm">
          {pageNum > 1 && (
            <a
              href={`?status=${status ?? "all"}&page=${pageNum - 1}`}
              className="px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground"
            >
              ← Prev
            </a>
          )}
          <span className="text-muted-foreground">
            Page {pageNum} of {totalPages} · {count.toLocaleString()} picks
          </span>
          {pageNum < totalPages && (
            <a
              href={`?status=${status ?? "all"}&page=${pageNum + 1}`}
              className="px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground"
            >
              Next →
            </a>
          )}
        </div>
      )}
    </div>
  );
}
