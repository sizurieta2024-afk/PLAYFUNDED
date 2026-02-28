import { prisma } from "@/lib/prisma";
import { AdminChallengesTable } from "@/components/admin/AdminChallengesTable";

export default async function AdminChallengesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const { status, page } = await searchParams;
  const pageNum = Math.max(1, parseInt(page ?? "1", 10));
  const take = 50;
  const skip = (pageNum - 1) * take;

  const statusFilter =
    status && status !== "all" ? { status: status as never } : {};

  const [challenges, total] = await Promise.all([
    prisma.challenge.findMany({
      where: statusFilter,
      orderBy: { createdAt: "desc" },
      take,
      skip,
      include: {
        user: { select: { email: true, name: true } },
        tier: { select: { name: true } },
      },
    }),
    prisma.challenge.count({ where: statusFilter }),
  ]);

  const serialized = challenges.map((c) => ({
    id: c.id,
    status: c.status,
    phase: c.phase,
    balance: c.balance,
    startBalance: c.startBalance,
    createdAt: c.createdAt.toISOString(),
    user: c.user,
    tier: c.tier,
  }));

  const statuses = ["all", "active", "funded", "failed", "passed"];

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold">Challenges</h1>
        <p className="text-sm text-muted-foreground">
          {total.toLocaleString()} total
        </p>
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

      <AdminChallengesTable challenges={serialized} />

      {Math.ceil(total / take) > 1 && (
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
            Page {pageNum} of {Math.ceil(total / take)}
          </span>
          {pageNum < Math.ceil(total / take) && (
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
