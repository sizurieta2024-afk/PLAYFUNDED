import { prisma } from "@/lib/prisma";

function formatUSD(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export default async function AdminDashboardPage() {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const [
    totalRevenue,
    monthRevenue,
    lastMonthRevenue,
    activeChallenges,
    fundedChallenges,
    failedChallenges,
    pendingPayouts,
    pendingKyc,
    newUsersMonth,
    totalUsers,
    recentAudit,
  ] = await Promise.all([
    // Total revenue (completed payments)
    prisma.payment.aggregate({
      where: { status: "completed" },
      _sum: { amount: true },
    }),
    // This month revenue
    prisma.payment.aggregate({
      where: { status: "completed", createdAt: { gte: startOfMonth } },
      _sum: { amount: true },
    }),
    // Last month revenue
    prisma.payment.aggregate({
      where: {
        status: "completed",
        createdAt: { gte: startOfLastMonth, lt: startOfMonth },
      },
      _sum: { amount: true },
    }),
    // Active challenges
    prisma.challenge.count({ where: { status: "active" } }),
    // Funded challenges
    prisma.challenge.count({ where: { status: "funded" } }),
    // Failed challenges
    prisma.challenge.count({ where: { status: "failed" } }),
    // Pending payouts
    prisma.payout.count({ where: { status: "pending", isRollover: false } }),
    // Pending KYC
    prisma.kycSubmission.count({ where: { status: "pending" } }),
    // New users this month
    prisma.user.count({ where: { createdAt: { gte: startOfMonth } } }),
    // Total users
    prisma.user.count(),
    // Recent audit log
    prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { admin: { select: { name: true, email: true } } },
    }),
  ]);

  const totalSettled = fundedChallenges + failedChallenges;
  const passRate =
    totalSettled > 0
      ? Math.round((fundedChallenges / totalSettled) * 100)
      : 0;

  const thisMonthRev = monthRevenue._sum.amount ?? 0;
  const lastMonthRev = lastMonthRevenue._sum.amount ?? 0;
  const revenueGrowth =
    lastMonthRev > 0
      ? (((thisMonthRev - lastMonthRev) / lastMonthRev) * 100).toFixed(1)
      : null;

  const kpis = [
    {
      label: "Total Revenue",
      value: formatUSD(totalRevenue._sum.amount ?? 0),
      sub: `${formatUSD(thisMonthRev)} this month${revenueGrowth ? ` (${revenueGrowth}%)` : ""}`,
      color: "text-pf-brand",
    },
    {
      label: "Active Challenges",
      value: activeChallenges.toLocaleString(),
      sub: `${fundedChallenges} funded`,
      color: "text-blue-400",
    },
    {
      label: "Pass Rate",
      value: `${passRate}%`,
      sub: `${fundedChallenges} funded / ${failedChallenges} failed`,
      color: passRate >= 20 ? "text-pf-brand" : "text-amber-400",
    },
    {
      label: "Total Users",
      value: totalUsers.toLocaleString(),
      sub: `+${newUsersMonth} this month`,
      color: "text-foreground",
    },
    {
      label: "Pending Payouts",
      value: pendingPayouts.toLocaleString(),
      sub: "awaiting approval",
      color: pendingPayouts > 0 ? "text-amber-400" : "text-muted-foreground",
      href: "/admin/payouts",
    },
    {
      label: "Pending KYC",
      value: pendingKyc.toLocaleString(),
      sub: "awaiting review",
      color: pendingKyc > 0 ? "text-amber-400" : "text-muted-foreground",
      href: "/admin/kyc",
    },
  ];

  return (
    <div className="space-y-8 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold">Admin Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Platform overview · {now.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
        </p>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {kpis.map((kpi) => (
          <div
            key={kpi.label}
            className="rounded-xl border border-border bg-card p-5"
          >
            <p className="text-xs text-muted-foreground mb-1">{kpi.label}</p>
            <p className={`text-2xl font-bold tabular-nums ${kpi.color}`}>
              {kpi.value}
            </p>
            <p className="text-xs text-muted-foreground mt-1">{kpi.sub}</p>
            {kpi.href && (
              <a
                href={kpi.href}
                className="text-xs text-pf-brand hover:underline mt-2 inline-block"
              >
                View queue →
              </a>
            )}
          </div>
        ))}
      </div>

      {/* Recent Audit Log */}
      <div>
        <h2 className="text-base font-semibold mb-3">Recent admin actions</h2>
        {recentAudit.length === 0 ? (
          <p className="text-sm text-muted-foreground">No actions yet.</p>
        ) : (
          <div className="rounded-xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  {["Time", "Admin", "Action", "Target", "Note"].map((h) => (
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
                {recentAudit.map((log) => (
                  <tr
                    key={log.id}
                    className="border-b border-border last:border-0"
                  >
                    <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {log.admin.name ?? log.admin.email}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs text-foreground">
                      {log.action}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground text-xs font-mono">
                      {log.targetType}/{log.targetId.slice(0, 8)}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground text-xs max-w-xs truncate">
                      {log.note ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
