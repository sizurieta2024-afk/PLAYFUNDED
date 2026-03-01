import { prisma } from "@/lib/prisma";

function fmt(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function monthLabel(d: Date) {
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

export default async function AdminRevenuePage() {
  const now = new Date();

  // Build last 12 month boundaries
  const months: { start: Date; end: Date; label: string }[] = [];
  for (let i = 11; i >= 0; i--) {
    const start = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1),
    );
    const end = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i + 1, 1),
    );
    months.push({ start, end, label: monthLabel(start) });
  }

  // Revenue per month
  const revenuePerMonth = await Promise.all(
    months.map((m) =>
      prisma.payment.aggregate({
        where: {
          status: "completed",
          createdAt: { gte: m.start, lt: m.end },
        },
        _sum: { amount: true },
        _count: { id: true },
      }),
    ),
  );

  // Payouts paid per month
  const payoutsPerMonth = await Promise.all(
    months.map((m) =>
      prisma.payout.aggregate({
        where: {
          status: "paid",
          isRollover: false,
          isAffiliate: false,
          requestedAt: { gte: m.start, lt: m.end },
        },
        _sum: { amount: true },
      }),
    ),
  );

  // All-time revenue by tier
  const allTiers = await prisma.tier.findMany({
    select: { id: true, name: true },
    orderBy: { sortOrder: "asc" },
  });
  const revenueByTier = await Promise.all(
    allTiers.map((tier) =>
      prisma.payment.aggregate({
        where: { status: "completed", tierId: tier.id },
        _sum: { amount: true },
        _count: { id: true },
      }),
    ),
  );

  // All-time revenue by payment method
  const revenueByMethod = await prisma.payment.groupBy({
    by: ["method"],
    where: { status: "completed" },
    _sum: { amount: true },
    _count: { id: true },
    orderBy: { _sum: { amount: "desc" } },
  });

  // Affiliate payouts (separate line item)
  const affiliatePayouts = await prisma.payout.aggregate({
    where: { status: "paid", isAffiliate: true },
    _sum: { amount: true },
  });

  // Totals
  const totalRevenue = revenuePerMonth.reduce(
    (sum, r) => sum + (r._sum.amount ?? 0),
    0,
  );
  const totalPayouts = payoutsPerMonth.reduce(
    (sum, p) => sum + (p._sum.amount ?? 0),
    0,
  );
  const netRevenue = totalRevenue - totalPayouts;

  return (
    <div className="space-y-10 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold">Revenue</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Last 12 months · all amounts in USD
        </p>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: "All-time Revenue",
            value: fmt(totalRevenue),
            color: "text-pf-brand",
          },
          {
            label: "Total Payouts",
            value: fmt(totalPayouts),
            color: "text-amber-400",
          },
          {
            label: "Net Revenue",
            value: fmt(netRevenue),
            color: netRevenue >= 0 ? "text-pf-brand" : "text-red-400",
          },
          {
            label: "Affiliate Payouts",
            value: fmt(affiliatePayouts._sum.amount ?? 0),
            color: "text-muted-foreground",
          },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className="rounded-xl border border-border bg-card p-5"
          >
            <p className="text-xs text-muted-foreground mb-1">{kpi.label}</p>
            <p className={`text-2xl font-bold tabular-nums ${kpi.color}`}>
              {kpi.value}
            </p>
          </div>
        ))}
      </div>

      {/* Monthly table */}
      <div>
        <h2 className="text-base font-semibold mb-3">Monthly Breakdown</h2>
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                {["Month", "Challenges Sold", "Revenue", "Payouts Paid", "Net"].map(
                  (h) => (
                    <th
                      key={h}
                      className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground"
                    >
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {months.map((m, i) => {
                const rev = revenuePerMonth[i]._sum.amount ?? 0;
                const paid = payoutsPerMonth[i]._sum.amount ?? 0;
                const net = rev - paid;
                const count = revenuePerMonth[i]._count.id;
                const isCurrentMonth = i === months.length - 1;
                return (
                  <tr
                    key={m.label}
                    className={`border-b border-border last:border-0 ${isCurrentMonth ? "bg-pf-brand/5" : ""}`}
                  >
                    <td className="px-4 py-3 text-sm font-medium text-foreground whitespace-nowrap">
                      {m.label}
                      {isCurrentMonth && (
                        <span className="ml-2 text-[10px] text-pf-brand font-semibold">
                          MTD
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-muted-foreground">
                      {count}
                    </td>
                    <td className="px-4 py-3 tabular-nums font-semibold text-pf-brand">
                      {rev > 0 ? fmt(rev) : "—"}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-amber-400">
                      {paid > 0 ? fmt(paid) : "—"}
                    </td>
                    <td
                      className={`px-4 py-3 tabular-nums font-semibold ${net > 0 ? "text-pf-brand" : net < 0 ? "text-red-400" : "text-muted-foreground"}`}
                    >
                      {rev > 0 || paid > 0
                        ? `${net >= 0 ? "" : "-"}${fmt(Math.abs(net))}`
                        : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-muted/30 border-t border-border">
                <td className="px-4 py-3 text-xs font-semibold text-muted-foreground">
                  Total
                </td>
                <td className="px-4 py-3 tabular-nums font-semibold text-foreground">
                  {revenuePerMonth.reduce((s, r) => s + r._count.id, 0)}
                </td>
                <td className="px-4 py-3 tabular-nums font-bold text-pf-brand">
                  {fmt(totalRevenue)}
                </td>
                <td className="px-4 py-3 tabular-nums font-bold text-amber-400">
                  {fmt(totalPayouts)}
                </td>
                <td
                  className={`px-4 py-3 tabular-nums font-bold ${netRevenue >= 0 ? "text-pf-brand" : "text-red-400"}`}
                >
                  {fmt(netRevenue)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* By tier + by method */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <h2 className="text-base font-semibold mb-3">All-time by Tier</h2>
          <div className="rounded-xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  {["Tier", "Sold", "Revenue"].map((h) => (
                    <th
                      key={h}
                      className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {allTiers.map((tier, i) => {
                  const r = revenueByTier[i];
                  return (
                    <tr
                      key={tier.id}
                      className="border-b border-border last:border-0"
                    >
                      <td className="px-4 py-3 text-sm text-foreground">
                        {tier.name}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-muted-foreground">
                        {r._count.id}
                      </td>
                      <td className="px-4 py-3 tabular-nums font-semibold text-pf-brand">
                        {r._sum.amount ? fmt(r._sum.amount) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <h2 className="text-base font-semibold mb-3">
            All-time by Payment Method
          </h2>
          <div className="rounded-xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  {["Method", "Transactions", "Revenue"].map((h) => (
                    <th
                      key={h}
                      className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {revenueByMethod.map((r) => (
                  <tr
                    key={r.method}
                    className="border-b border-border last:border-0"
                  >
                    <td className="px-4 py-3 text-sm text-foreground capitalize">
                      {r.method}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-muted-foreground">
                      {r._count.id}
                    </td>
                    <td className="px-4 py-3 tabular-nums font-semibold text-pf-brand">
                      {fmt(r._sum.amount ?? 0)}
                    </td>
                  </tr>
                ))}
                {revenueByMethod.length === 0 && (
                  <tr>
                    <td
                      colSpan={3}
                      className="px-4 py-4 text-sm text-muted-foreground text-center"
                    >
                      No transactions yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
