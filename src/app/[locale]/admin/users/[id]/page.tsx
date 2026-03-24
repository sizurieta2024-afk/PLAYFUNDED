import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AdminUserActions } from "@/components/admin/AdminUserActions";
import { AdminSendMessageForm } from "@/components/admin/AdminSendMessageForm";

function fmt(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

const STATUS_COLORS: Record<string, string> = {
  active: "bg-blue-500/15 text-blue-400",
  funded: "bg-pf-brand/15 text-pf-brand",
  failed: "bg-red-500/15 text-red-400",
  passed: "bg-muted text-muted-foreground",
  won: "bg-pf-brand/15 text-pf-brand",
  lost: "bg-red-500/15 text-red-400",
  pending: "bg-blue-500/15 text-blue-400",
  void: "bg-muted text-muted-foreground",
  completed: "bg-pf-brand/15 text-pf-brand",
  refunded: "bg-amber-500/15 text-amber-400",
  paid: "bg-pf-brand/15 text-pf-brand",
  processing: "bg-amber-500/15 text-amber-400",
};

function Badge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex px-2 py-0.5 rounded-md text-xs font-semibold capitalize ${STATUS_COLORS[status] ?? "bg-muted text-muted-foreground"}`}
    >
      {status}
    </span>
  );
}

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      challenges: {
        orderBy: { createdAt: "desc" },
        include: { tier: { select: { name: true, fundedBankroll: true } } },
      },
      payments: {
        orderBy: { createdAt: "desc" },
        take: 20,
        include: { tier: { select: { name: true } } },
      },
      payouts: {
        where: { isRollover: false },
        orderBy: { requestedAt: "desc" },
        take: 20,
        include: {
          challenge: { include: { tier: { select: { name: true } } } },
        },
      },
      kycSubmission: true,
    },
  });

  if (!user) notFound();

  // Aggregate stats
  const totalInvested = user.payments
    .filter((p) => p.status === "completed")
    .reduce((s, p) => s + p.amount, 0);

  const totalEarned = user.payouts
    .filter((p) => p.status === "paid")
    .reduce((s, p) => s + p.amount, 0);

  const wonPicks = await prisma.pick.count({
    where: { userId: user.id, status: "won" },
  });
  const settledPicks = await prisma.pick.count({
    where: { userId: user.id, status: { in: ["won", "lost"] } },
  });

  const recentPicks = await prisma.pick.findMany({
    where: { userId: user.id },
    orderBy: { placedAt: "desc" },
    take: 15,
    include: { challenge: { include: { tier: { select: { name: true } } } } },
  });

  const winRate =
    settledPicks > 0 ? Math.round((wonPicks / settledPicks) * 100) : null;

  const latestKyc = user.kycSubmission ?? null;

  return (
    <div className="space-y-8 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">
            {user.name ?? user.email.split("@")[0]}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">{user.email}</p>
          <div className="flex items-center gap-2 mt-2">
            <Badge status={user.role} />
            {user.isBanned && (
              <span className="inline-flex px-2 py-0.5 rounded-md text-xs font-semibold bg-red-500/15 text-red-400">
                BANNED: {user.banReason}
              </span>
            )}
            {latestKyc && <Badge status={`KYC: ${latestKyc.status}`} />}
          </div>
        </div>
        <AdminUserActions
          userId={user.id}
          isBanned={user.isBanned}
          banReason={user.banReason}
          role={user.role}
        />
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: "Total Invested",
            value: fmt(totalInvested),
            sub: `${user.payments.filter((p) => p.status === "completed").length} purchases`,
            color: "text-foreground",
          },
          {
            label: "Total Earned",
            value: fmt(totalEarned),
            sub: `${user.payouts.filter((p) => p.status === "paid").length} payouts`,
            color: "text-pf-brand",
          },
          {
            label: "Win Rate",
            value: winRate !== null ? `${winRate}%` : "—",
            sub: `${wonPicks}W / ${settledPicks - wonPicks}L (${settledPicks} settled)`,
            color:
              winRate !== null && winRate >= 50
                ? "text-pf-brand"
                : "text-muted-foreground",
          },
          {
            label: "Challenges",
            value: user.challenges.length.toLocaleString(),
            sub: `${user.challenges.filter((c) => c.status === "funded").length} funded · ${user.challenges.filter((c) => c.status === "failed").length} failed`,
            color: "text-foreground",
          },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className="rounded-xl border border-border bg-card p-4"
          >
            <p className="text-xs text-muted-foreground mb-1">{kpi.label}</p>
            <p className={`text-2xl font-bold tabular-nums ${kpi.color}`}>
              {kpi.value}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">{kpi.sub}</p>
          </div>
        ))}
      </div>

      {/* Profile details */}
      <section className="rounded-xl border border-border bg-card p-5 grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Country", value: user.country ?? "—" },
          {
            label: "Joined",
            value: new Date(user.createdAt).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            }),
          },
          { label: "Referral code used", value: user.referredByCode ?? "—" },
        ].map((f) => (
          <div key={f.label}>
            <p className="text-xs text-muted-foreground">{f.label}</p>
            <p className="text-sm font-medium mt-0.5">{f.value}</p>
          </div>
        ))}
      </section>

      {/* Challenges */}
      <section>
        <h2 className="text-base font-semibold mb-3">
          Challenges ({user.challenges.length})
        </h2>
        {user.challenges.length === 0 ? (
          <p className="text-sm text-muted-foreground">No challenges</p>
        ) : (
          <div className="rounded-xl border border-border overflow-x-auto">
            <table className="w-full text-sm min-w-[600px]">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  {["Tier", "Phase", "Status", "Balance", "P&L", "Started"].map(
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
                {user.challenges.map((c) => {
                  const pnl = c.balance - c.tier.fundedBankroll;
                  return (
                    <tr
                      key={c.id}
                      className="border-b border-border last:border-0"
                    >
                      <td className="px-4 py-3 text-xs font-medium text-foreground">
                        {c.tier.name}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground capitalize">
                        {c.phase}
                      </td>
                      <td className="px-4 py-3">
                        <Badge status={c.status} />
                      </td>
                      <td className="px-4 py-3 tabular-nums text-xs">
                        {fmt(c.balance)}
                      </td>
                      <td
                        className={`px-4 py-3 tabular-nums text-xs font-semibold ${pnl >= 0 ? "text-pf-brand" : "text-red-400"}`}
                      >
                        {pnl >= 0 ? "+" : ""}
                        {fmt(pnl)}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(c.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Recent Picks */}
      <section>
        <h2 className="text-base font-semibold mb-3">Recent Picks</h2>
        {recentPicks.length === 0 ? (
          <p className="text-sm text-muted-foreground">No picks placed</p>
        ) : (
          <div className="rounded-xl border border-border overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  {[
                    "Event",
                    "Market",
                    "Selection",
                    "Odds",
                    "Stake",
                    "Status",
                    "P&L",
                    "Date",
                  ].map((h) => (
                    <th
                      key={h}
                      className="text-left px-3 py-2.5 text-xs font-medium text-muted-foreground"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentPicks.map((p) => {
                  const pnl =
                    p.status === "won"
                      ? p.actualPayout - p.stake
                      : p.status === "lost"
                        ? -p.stake
                        : 0;
                  return (
                    <tr
                      key={p.id}
                      className="border-b border-border last:border-0"
                    >
                      <td className="px-3 py-2.5 text-xs text-foreground max-w-[140px] truncate">
                        {p.eventName ?? p.event}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground capitalize">
                        {p.marketType.replace(/_/g, " ")}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-foreground max-w-[100px] truncate">
                        {p.selection}
                      </td>
                      <td className="px-3 py-2.5 tabular-nums text-xs">
                        {p.odds.toFixed(2)}
                      </td>
                      <td className="px-3 py-2.5 tabular-nums text-xs">
                        {fmt(p.stake)}
                      </td>
                      <td className="px-3 py-2.5">
                        <Badge status={p.status} />
                      </td>
                      <td
                        className={`px-3 py-2.5 tabular-nums text-xs font-semibold ${pnl > 0 ? "text-pf-brand" : pnl < 0 ? "text-red-400" : "text-muted-foreground"}`}
                      >
                        {p.status === "pending"
                          ? "—"
                          : `${pnl >= 0 ? "+" : ""}${fmt(pnl)}`}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(p.placedAt).toLocaleDateString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Payments */}
      <section>
        <h2 className="text-base font-semibold mb-3">Payments</h2>
        {user.payments.length === 0 ? (
          <p className="text-sm text-muted-foreground">No payments</p>
        ) : (
          <div className="rounded-xl border border-border overflow-x-auto">
            <table className="w-full text-sm min-w-[500px]">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  {["Tier", "Amount", "Method", "Status", "Ref", "Date"].map(
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
                {user.payments.map((p) => (
                  <tr
                    key={p.id}
                    className="border-b border-border last:border-0"
                  >
                    <td className="px-4 py-3 text-xs text-foreground">
                      {p.tier.name}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-xs font-semibold">
                      {fmt(p.amount)}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground capitalize">
                      {p.method}
                    </td>
                    <td className="px-4 py-3">
                      <Badge status={p.status} />
                    </td>
                    <td className="px-4 py-3 text-xs font-mono text-muted-foreground max-w-[100px] truncate">
                      {p.providerRef ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(p.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Send message */}
      <AdminSendMessageForm userId={user.id} />

      {/* Payouts */}
      <section>
        <h2 className="text-base font-semibold mb-3">Payouts</h2>
        {user.payouts.length === 0 ? (
          <p className="text-sm text-muted-foreground">No payout requests</p>
        ) : (
          <div className="rounded-xl border border-border overflow-x-auto">
            <table className="w-full text-sm min-w-[500px]">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  {["Amount", "Split %", "Method", "Status", "Requested"].map(
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
                {user.payouts.map((p) => (
                  <tr
                    key={p.id}
                    className="border-b border-border last:border-0"
                  >
                    <td className="px-4 py-3 tabular-nums text-xs font-semibold text-pf-brand">
                      {fmt(p.amount)}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-xs text-muted-foreground">
                      {p.splitPct}%
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground capitalize">
                      {p.method}
                    </td>
                    <td className="px-4 py-3">
                      <Badge status={p.status} />
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(p.requestedAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
