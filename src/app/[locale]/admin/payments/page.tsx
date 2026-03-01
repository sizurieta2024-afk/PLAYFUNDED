import { prisma } from "@/lib/prisma";
import { Link } from "@/i18n/navigation";

function fmt(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

const STATUS_COLORS: Record<string, string> = {
  completed: "bg-pf-brand/15 text-pf-brand",
  pending: "bg-blue-500/15 text-blue-400",
  failed: "bg-red-500/15 text-red-400",
  expired: "bg-muted text-muted-foreground",
  refunded: "bg-amber-500/15 text-amber-400",
};

const METHOD_LABELS: Record<string, string> = {
  stripe: "Card (Stripe)",
  mercadopago: "Mercado Pago",
  usdt: "Crypto (USDT)",
  usdc: "Crypto (USDC)",
  btc: "Crypto (BTC)",
};

export default async function AdminPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const { status, page } = await searchParams;
  const statusFilter = status && status !== "all" ? status : undefined;
  const pageNum = Math.max(1, parseInt(page ?? "1", 10));
  const take = 50;
  const skip = (pageNum - 1) * take;
  const now = new Date();

  // Summary counts
  const [
    totalCompleted,
    totalRevenue,
    pendingCount,
    failedCount,
    expiredCount,
    expiringSoon,
  ] = await Promise.all([
    prisma.payment.count({ where: { status: "completed" } }),
    prisma.payment.aggregate({
      where: { status: "completed" },
      _sum: { amount: true },
    }),
    prisma.payment.count({ where: { status: "pending" } }),
    prisma.payment.count({ where: { status: "failed" } }),
    prisma.payment.count({ where: { status: "failed" } }),
    // Crypto payments expiring in the next 2 hours
    prisma.payment.count({
      where: {
        method: { in: ["usdt", "usdc", "btc"] as const },
        status: "pending",
        cryptoExpiry: {
          gt: now,
          lt: new Date(now.getTime() + 2 * 3_600_000),
        },
      },
    }),
  ]);

  const [payments, total] = await Promise.all([
    prisma.payment.findMany({
      where: statusFilter ? { status: statusFilter as never } : {},
      orderBy: { createdAt: "desc" },
      take,
      skip,
      include: {
        user: { select: { id: true, email: true, name: true } },
        tier: { select: { name: true } },
      },
    }),
    prisma.payment.count({
      where: statusFilter ? { status: statusFilter as never } : {},
    }),
  ]);

  const totalPages = Math.ceil(total / take);
  const statuses = ["all", "completed", "pending", "failed", "refunded"];

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold">Payments</h1>
        <p className="text-sm text-muted-foreground mt-1">
          All incoming transactions
        </p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          {
            label: "Total Revenue",
            value: fmt(totalRevenue._sum.amount ?? 0),
            sub: `${totalCompleted} completed`,
            color: "text-pf-brand",
          },
          {
            label: "Pending",
            value: pendingCount,
            sub: "awaiting confirmation",
            color: pendingCount > 0 ? "text-blue-400" : "text-muted-foreground",
          },
          {
            label: "Failed",
            value: failedCount,
            sub: "payment declined",
            color: failedCount > 0 ? "text-red-400" : "text-muted-foreground",
          },
          {
            label: "Expired",
            value: expiredCount,
            sub: "crypto timeout",
            color:
              expiredCount > 0
                ? "text-muted-foreground"
                : "text-muted-foreground",
          },
          {
            label: "Expiring Soon",
            value: expiringSoon,
            sub: "crypto, <2h left",
            color:
              expiringSoon > 0 ? "text-amber-400" : "text-muted-foreground",
          },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className="rounded-xl border border-border bg-card p-4"
          >
            <p className="text-xs text-muted-foreground mb-1">{kpi.label}</p>
            <p className={`text-2xl font-bold tabular-nums ${kpi.color}`}>
              {typeof kpi.value === "number" ? kpi.value : kpi.value}
            </p>
            <p className="text-xs text-muted-foreground mt-1">{kpi.sub}</p>
          </div>
        ))}
      </div>

      {/* Status filter */}
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
        <table className="w-full text-sm min-w-[800px]">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              {[
                "User",
                "Tier",
                "Amount",
                "Method",
                "Status",
                "Provider Ref",
                "Crypto",
                "Date",
              ].map((h) => (
                <th
                  key={h}
                  className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground whitespace-nowrap"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {payments.length === 0 && (
              <tr>
                <td
                  colSpan={8}
                  className="px-4 py-8 text-sm text-muted-foreground text-center"
                >
                  No payments found
                </td>
              </tr>
            )}
            {payments.map((p) => {
              const isExpiringSoon =
                (["usdt", "usdc", "btc"] as const).includes(
                  p.method as "usdt" | "usdc" | "btc",
                ) &&
                p.status === "pending" &&
                p.cryptoExpiry &&
                new Date(p.cryptoExpiry) <
                  new Date(now.getTime() + 2 * 3_600_000);

              const isExpired =
                p.cryptoExpiry && new Date(p.cryptoExpiry) < now;

              return (
                <tr
                  key={p.id}
                  className={`border-b border-border last:border-0 ${isExpiringSoon ? "bg-amber-500/5" : ""}`}
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/users/${p.user.id}` as never}
                      className="text-xs font-medium text-foreground hover:text-pf-brand transition-colors"
                    >
                      {p.user.name ?? p.user.email.split("@")[0]}
                    </Link>
                    <p className="text-[10px] text-muted-foreground">
                      {p.user.email}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {p.tier.name}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-xs font-semibold">
                    {fmt(p.amount)}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {METHOD_LABELS[p.method] ?? p.method}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex px-2 py-0.5 rounded-md text-xs font-semibold capitalize ${STATUS_COLORS[p.status] ?? "bg-muted text-muted-foreground"}`}
                    >
                      {p.status}
                    </span>
                    {isExpiringSoon && (
                      <span className="ml-1 text-[10px] text-amber-400 font-semibold">
                        ⚠ expiring
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground max-w-[120px] truncate">
                    {p.providerRef ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {(["usdt", "usdc", "btc"] as const).includes(
                      p.method as "usdt" | "usdc" | "btc",
                    ) ? (
                      <div className="space-y-0.5">
                        {p.cryptoNetwork && (
                          <p className="text-muted-foreground uppercase text-[10px]">
                            {p.cryptoNetwork}
                          </p>
                        )}
                        {p.cryptoAmount && (
                          <p className="tabular-nums text-foreground">
                            {p.cryptoAmount}
                          </p>
                        )}
                        {p.cryptoExpiry && (
                          <p
                            className={`text-[10px] ${isExpired ? "text-red-400" : isExpiringSoon ? "text-amber-400" : "text-muted-foreground"}`}
                          >
                            {isExpired
                              ? "Expired"
                              : `Exp ${new Date(p.cryptoExpiry).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`}
                          </p>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(p.createdAt).toLocaleDateString()}
                    <p className="text-[10px]">
                      {new Date(p.createdAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
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
            Page {pageNum} of {totalPages} · {total.toLocaleString()}{" "}
            transactions
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
