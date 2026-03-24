import { prisma } from "@/lib/prisma";
import { Link } from "@/i18n/navigation";
import {
  getNonFixtureChallengeWhere,
  getNonFixtureKycWhere,
  getNonFixturePaymentWhere,
  getNonFixturePickWhere,
  getNonFixturePayoutWhere,
  getNonFixtureUserWhere,
} from "@/lib/fixture-data";

function fmt(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function pct(n: number, d: number) {
  if (!d) return "—";
  return `${Math.round((n / d) * 100)}%`;
}

function change(current: number, previous: number) {
  if (!previous) return null;
  const delta = ((current - previous) / previous) * 100;
  return { delta: delta.toFixed(1), up: delta >= 0 };
}

export default async function AdminDashboardPage() {
  const now = new Date();
  const startOfToday = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const startOfMonth = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
  );
  const startOfLastMonth = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1),
  );
  const endOfLastMonth = startOfMonth;
  const completedPaymentWhere = getNonFixturePaymentWhere({
    status: "completed",
  });
  const monthCompletedPaymentWhere = getNonFixturePaymentWhere({
    status: "completed",
    createdAt: { gte: startOfMonth },
  });
  const lastMonthCompletedPaymentWhere = getNonFixturePaymentWhere({
    status: "completed",
    createdAt: { gte: startOfLastMonth, lt: endOfLastMonth },
  });
  const paidPayoutWhere = getNonFixturePayoutWhere({
    status: "paid",
    isRollover: false,
    isAffiliate: false,
  });
  const monthPaidPayoutWhere = getNonFixturePayoutWhere({
    status: "paid",
    isRollover: false,
    isAffiliate: false,
    requestedAt: { gte: startOfMonth },
  });
  const pendingPayoutWhere = getNonFixturePayoutWhere({
    status: "pending",
    isRollover: false,
  });
  const activeChallengeWhere = getNonFixtureChallengeWhere({
    status: "active",
  });
  const fundedChallengeWhere = getNonFixtureChallengeWhere({
    status: "funded",
  });
  const failedChallengeWhere = getNonFixtureChallengeWhere({
    status: "failed",
  });

  const [
    // Revenue
    totalRevenue,
    monthRevenue,
    lastMonthRevenue,
    totalPaidPayouts,
    monthPaidPayouts,
    // Revenue by tier this month
    revenueByTier,
    // Revenue by method this month
    revenueByMethod,
    // Users
    totalUsers,
    newUsersMonth,
    // Challenges
    activeChallenges,
    fundedChallenges,
    failedChallenges,
    phase1Count,
    phase2Count,
    // Risk exposure
    fundedBalances,
    // Picks today
    picksToday,
    wonToday,
    lostToday,
    // Queues
    pendingPayoutsCount,
    pendingPayoutsAmount,
    pendingKyc,
    // Top funded traders
    topFundedTraders,
    // Recent audit
    recentAudit,
  ] = await Promise.all([
    // All-time completed revenue
    prisma.payment.aggregate({
      where: completedPaymentWhere,
      _sum: { amount: true },
    }),
    // This month revenue
    prisma.payment.aggregate({
      where: monthCompletedPaymentWhere,
      _sum: { amount: true },
    }),
    // Last month revenue
    prisma.payment.aggregate({
      where: lastMonthCompletedPaymentWhere,
      _sum: { amount: true },
    }),
    // All-time paid payouts
    prisma.payout.aggregate({
      where: paidPayoutWhere,
      _sum: { amount: true },
    }),
    // This month paid payouts
    prisma.payout.aggregate({
      where: monthPaidPayoutWhere,
      _sum: { amount: true },
    }),
    // Revenue by tier this month
    prisma.payment.groupBy({
      by: ["tierId"],
      where: monthCompletedPaymentWhere,
      _sum: { amount: true },
      orderBy: { _sum: { amount: "desc" } },
    }),
    // Revenue by payment method this month
    prisma.payment.groupBy({
      by: ["method"],
      where: monthCompletedPaymentWhere,
      _sum: { amount: true },
      orderBy: { _sum: { amount: "desc" } },
    }),
    // Total users
    prisma.user.count({ where: getNonFixtureUserWhere() }),
    // New users this month
    prisma.user.count({
      where: getNonFixtureUserWhere({ createdAt: { gte: startOfMonth } }),
    }),
    // Active challenges
    prisma.challenge.count({ where: activeChallengeWhere }),
    // Funded
    prisma.challenge.count({ where: fundedChallengeWhere }),
    // Failed
    prisma.challenge.count({ where: failedChallengeWhere }),
    // Phase 1
    prisma.challenge.count({
      where: getNonFixtureChallengeWhere({ status: "active", phase: "phase1" }),
    }),
    // Phase 2
    prisma.challenge.count({
      where: getNonFixtureChallengeWhere({ status: "active", phase: "phase2" }),
    }),
    // Total funded balance (risk exposure)
    prisma.challenge.aggregate({
      where: fundedChallengeWhere,
      _sum: { balance: true },
    }),
    // Picks placed today
    prisma.pick.count({
      where: getNonFixturePickWhere({ placedAt: { gte: startOfToday } }),
    }),
    // Won today
    prisma.pick.count({
      where: getNonFixturePickWhere({
        status: "won",
        settledAt: { gte: startOfToday },
      }),
    }),
    // Lost today
    prisma.pick.count({
      where: getNonFixturePickWhere({
        status: "lost",
        settledAt: { gte: startOfToday },
      }),
    }),
    // Pending payouts count
    prisma.payout.count({ where: pendingPayoutWhere }),
    // Pending payouts total amount
    prisma.payout.aggregate({
      where: pendingPayoutWhere,
      _sum: { amount: true },
    }),
    // Pending KYC
    prisma.kycSubmission.count({
      where: getNonFixtureKycWhere({ status: "pending" }),
    }),
    // Top funded traders by balance
    prisma.challenge.findMany({
      where: fundedChallengeWhere,
      orderBy: { balance: "desc" },
      take: 8,
      include: {
        user: { select: { email: true, name: true } },
      },
    }),
    // Recent audit log
    prisma.auditLog.findMany({
      where: { admin: { is: getNonFixtureUserWhere() } },
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { admin: { select: { name: true, email: true } } },
    }),
  ]);

  // Resolve tier names for the revenue-by-tier breakdown
  const tierIds = revenueByTier.map((r) => r.tierId);
  const tiers = await prisma.tier.findMany({
    where: { id: { in: tierIds } },
    select: { id: true, name: true },
  });
  const tierMap = Object.fromEntries(tiers.map((t) => [t.id, t.name]));
  const fundedTraderTierIds = Array.from(
    new Set(topFundedTraders.map((challenge) => challenge.tierId)),
  );
  const fundedTraderTiers = await prisma.tier.findMany({
    where: { id: { in: fundedTraderTierIds } },
    select: { id: true, name: true, fundedBankroll: true },
  });
  const fundedTraderTierMap = new Map(
    fundedTraderTiers.map((tier) => [tier.id, tier]),
  );

  // Derived numbers
  const thisMonthRev = monthRevenue._sum.amount ?? 0;
  const lastMonthRev = lastMonthRevenue._sum.amount ?? 0;
  const revChange = change(thisMonthRev, lastMonthRev);
  const totalRev = totalRevenue._sum.amount ?? 0;
  const totalPaid = totalPaidPayouts._sum.amount ?? 0;
  const netRevenue = totalRev - totalPaid;
  const riskExposure = fundedBalances._sum.balance ?? 0;
  const pendingAmount = pendingPayoutsAmount._sum.amount ?? 0;

  const totalSettled = fundedChallenges + failedChallenges;
  const passRate = totalSettled > 0 ? Math.round((fundedChallenges / totalSettled) * 100) : 0;

  return (
    <div className="space-y-10 max-w-6xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Overview</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {now.toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
            year: "numeric",
          })}
        </p>
      </div>

      {/* ── Revenue Row ─────────────────────────────────────────────── */}
      <section>
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Revenue
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              label: "All-time Revenue",
              value: fmt(totalRev),
              sub: `${fmt(totalPaid)} paid out`,
              color: "text-pf-brand",
            },
            {
              label: "Net Revenue",
              value: fmt(netRevenue),
              sub: "Revenue minus paid payouts",
              color: netRevenue >= 0 ? "text-pf-brand" : "text-red-400",
            },
            {
              label: "This Month",
              value: fmt(thisMonthRev),
              sub: revChange
                ? `${revChange.up ? "▲" : "▼"} ${revChange.delta}% vs last month`
                : `Last month: ${fmt(lastMonthRev)}`,
              color: "text-foreground",
            },
            {
              label: "This Month Payouts",
              value: fmt(monthPaidPayouts._sum.amount ?? 0),
              sub: "Paid to funded traders",
              color: "text-amber-400",
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
              <p className="text-xs text-muted-foreground mt-1">{kpi.sub}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Platform Health Row ──────────────────────────────────────── */}
      <section>
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Platform
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              label: "Total Users",
              value: totalUsers.toLocaleString(),
              sub: `+${newUsersMonth} this month`,
              color: "text-foreground",
            },
            {
              label: "Active Challenges",
              value: activeChallenges.toLocaleString(),
              sub: `Phase 1: ${phase1Count} · Phase 2: ${phase2Count}`,
              color: "text-blue-400",
            },
            {
              label: "Pass Rate",
              value: `${passRate}%`,
              sub: `${fundedChallenges} funded · ${failedChallenges} failed`,
              color: passRate >= 20 ? "text-pf-brand" : "text-amber-400",
            },
            {
              label: "Risk Exposure",
              value: fmt(riskExposure),
              sub: `${fundedChallenges} funded traders`,
              color: "text-red-400",
              href: "/admin/challenges?status=funded",
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
              <p className="text-xs text-muted-foreground mt-1">{kpi.sub}</p>
              {"href" in kpi && kpi.href && (
                <Link
                  href={kpi.href as never}
                  className="text-xs text-pf-brand hover:underline mt-1 inline-block"
                >
                  View →
                </Link>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ── Action Queues + Today Row ────────────────────────────────── */}
      <section>
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Action Required
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Link
            href="/admin/payouts"
            className="rounded-xl border border-border bg-card p-5 hover:border-amber-500/40 transition-colors block"
          >
            <p className="text-xs text-muted-foreground mb-1">
              Pending Payouts
            </p>
            <p
              className={`text-2xl font-bold tabular-nums ${pendingPayoutsCount > 0 ? "text-amber-400" : "text-muted-foreground"}`}
            >
              {pendingPayoutsCount}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {fmt(pendingAmount)} total
            </p>
          </Link>

          <Link
            href="/admin/kyc"
            className="rounded-xl border border-border bg-card p-5 hover:border-amber-500/40 transition-colors block"
          >
            <p className="text-xs text-muted-foreground mb-1">Pending KYC</p>
            <p
              className={`text-2xl font-bold tabular-nums ${pendingKyc > 0 ? "text-amber-400" : "text-muted-foreground"}`}
            >
              {pendingKyc}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              awaiting review
            </p>
          </Link>

          <Link
            href="/admin/picks"
            className="rounded-xl border border-border bg-card p-5 hover:border-border/80 transition-colors block"
          >
            <p className="text-xs text-muted-foreground mb-1">Picks Today</p>
            <p className="text-2xl font-bold tabular-nums text-foreground">
              {picksToday}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              placed since midnight UTC
            </p>
          </Link>

          <div className="rounded-xl border border-border bg-card p-5">
            <p className="text-xs text-muted-foreground mb-1">
              Settled Today
            </p>
            <p className="text-2xl font-bold tabular-nums text-foreground">
              {wonToday + lostToday}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {wonToday}W · {lostToday}L · win rate{" "}
              {pct(wonToday, wonToday + lostToday)}
            </p>
          </div>
        </div>
      </section>

      {/* ── Revenue breakdown + Top funded traders ───────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue this month by tier + method */}
        <div className="space-y-6">
          <div>
            <h2 className="text-sm font-semibold mb-3">
              This Month by Tier
            </h2>
            {revenueByTier.length === 0 ? (
              <p className="text-xs text-muted-foreground">No sales yet</p>
            ) : (
              <div className="rounded-xl border border-border overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Tier</th>
                      <th className="text-right px-4 py-2 text-xs font-medium text-muted-foreground">Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {revenueByTier.map((r) => (
                      <tr key={r.tierId} className="border-b border-border last:border-0">
                        <td className="px-4 py-2.5 text-sm text-foreground">{tierMap[r.tierId] ?? r.tierId}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-pf-brand font-semibold">
                          {fmt(r._sum.amount ?? 0)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div>
            <h2 className="text-sm font-semibold mb-3">
              This Month by Payment Method
            </h2>
            {revenueByMethod.length === 0 ? (
              <p className="text-xs text-muted-foreground">No sales yet</p>
            ) : (
              <div className="rounded-xl border border-border overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Method</th>
                      <th className="text-right px-4 py-2 text-xs font-medium text-muted-foreground">Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {revenueByMethod.map((r) => (
                      <tr key={r.method} className="border-b border-border last:border-0">
                        <td className="px-4 py-2.5 text-sm text-foreground capitalize">{r.method}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-pf-brand font-semibold">
                          {fmt(r._sum.amount ?? 0)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Top funded traders (risk exposure) */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold">Funded Traders</h2>
            <Link
              href="/admin/challenges?status=funded"
              className="text-xs text-pf-brand hover:underline"
            >
              View all →
            </Link>
          </div>
          {topFundedTraders.length === 0 ? (
            <div className="rounded-xl border border-border bg-card p-6 text-center">
              <p className="text-sm text-muted-foreground">
                No funded traders yet
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Trader</th>
                    <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Tier</th>
                    <th className="text-right px-4 py-2 text-xs font-medium text-muted-foreground">Balance</th>
                    <th className="text-right px-4 py-2 text-xs font-medium text-muted-foreground">P&L</th>
                  </tr>
                </thead>
                <tbody>
                  {topFundedTraders.map((c) => {
                    const tier = fundedTraderTierMap.get(c.tierId);
                    const pnl = c.balance - (tier?.fundedBankroll ?? c.startBalance);
                    return (
                      <tr key={c.id} className="border-b border-border last:border-0">
                        <td className="px-4 py-2.5">
                          <p className="text-xs font-medium text-foreground truncate max-w-[120px]">
                            {c.user.name ?? c.user.email.split("@")[0]}
                          </p>
                          <p className="text-[10px] text-muted-foreground truncate max-w-[120px]">
                            {c.user.email}
                          </p>
                        </td>
                        <td className="px-4 py-2.5 text-xs text-muted-foreground">
                          {tier?.name ?? "Unknown tier"}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-xs">{fmt(c.balance)}</td>
                        <td className={`px-4 py-2.5 text-right tabular-nums text-xs font-semibold ${pnl >= 0 ? "text-pf-brand" : "text-red-400"}`}>
                          {pnl >= 0 ? "+" : ""}{fmt(pnl)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── Recent Audit Log ─────────────────────────────────────────── */}
      <div>
        <h2 className="text-sm font-semibold mb-3">Recent Admin Actions</h2>
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
                  <tr key={log.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap text-xs">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground text-xs">
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
