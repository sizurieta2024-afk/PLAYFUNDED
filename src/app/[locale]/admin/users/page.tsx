import { prisma } from "@/lib/prisma";
import { AdminUsersTable } from "@/components/admin/AdminUsersTable";

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { q, page } = await searchParams;
  const pageNum = Math.max(1, parseInt(page ?? "1", 10));
  const take = 50;
  const skip = (pageNum - 1) * take;

  const where = q
    ? {
        OR: [
          { email: { contains: q, mode: "insensitive" as const } },
          { name: { contains: q, mode: "insensitive" as const } },
        ],
      }
    : {};

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take,
      skip,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isBanned: true,
        banReason: true,
        country: true,
        createdAt: true,
        _count: { select: { challenges: true, payouts: true } },
      },
    }),
    prisma.user.count({ where }),
  ]);

  const totalPages = Math.ceil(total / take);

  const serialized = users.map((u) => ({
    ...u,
    createdAt: u.createdAt.toISOString(),
  }));

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Users</h1>
          <p className="text-sm text-muted-foreground">{total.toLocaleString()} total</p>
        </div>
        <form method="GET" className="flex gap-2">
          <input
            name="q"
            defaultValue={q}
            placeholder="Search email or name…"
            className="px-3 py-2 rounded-xl border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-pf-brand/40 w-64"
          />
          <button
            type="submit"
            className="px-4 py-2 rounded-xl bg-pf-brand text-white text-sm font-semibold hover:bg-pf-brand/90 transition-colors"
          >
            Search
          </button>
        </form>
      </div>

      <AdminUsersTable users={serialized} />

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center gap-2 text-sm">
          {pageNum > 1 && (
            <a
              href={`?q=${q ?? ""}&page=${pageNum - 1}`}
              className="px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            >
              ← Prev
            </a>
          )}
          <span className="text-muted-foreground">
            Page {pageNum} of {totalPages}
          </span>
          {pageNum < totalPages && (
            <a
              href={`?q=${q ?? ""}&page=${pageNum + 1}`}
              className="px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            >
              Next →
            </a>
          )}
        </div>
      )}
    </div>
  );
}
