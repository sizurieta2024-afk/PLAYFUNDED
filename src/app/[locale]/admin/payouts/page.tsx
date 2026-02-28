import { prisma } from "@/lib/prisma";
import { AdminPayoutsQueue } from "@/components/admin/AdminPayoutsQueue";

export default async function AdminPayoutsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const statusFilter = (status ?? "pending") as "pending" | "processing" | "paid" | "failed";

  const payouts = await prisma.payout.findMany({
    where: { status: statusFilter, isRollover: false },
    orderBy: { requestedAt: "asc" },
    take: 100,
    include: {
      user: { select: { email: true, name: true } },
      challenge: { include: { tier: { select: { name: true } } } },
    },
  });

  const serialized = payouts.map((p) => ({
    id: p.id,
    amount: p.amount,
    splitPct: p.splitPct,
    method: p.method,
    status: p.status,
    requestedAt: p.requestedAt.toISOString(),
    user: p.user,
    challenge: { tier: p.challenge.tier },
  }));

  const statuses = ["pending", "processing", "paid", "failed"];

  return (
    <div className="space-y-6 max-w-4xl">
      <h1 className="text-2xl font-bold">Payouts</h1>

      <div className="flex gap-2">
        {statuses.map((s) => (
          <a
            key={s}
            href={`?status=${s}`}
            className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors capitalize ${
              statusFilter === s
                ? "border-pf-brand bg-pf-brand/10 text-pf-brand"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {s}
          </a>
        ))}
      </div>

      <AdminPayoutsQueue payouts={serialized} />
    </div>
  );
}
