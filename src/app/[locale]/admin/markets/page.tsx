import { prisma } from "@/lib/prisma";
import { AdminMarketsQueue } from "@/components/admin/AdminMarketsQueue";

export default async function AdminMarketsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const statusFilter = (status ?? "pending") as never;

  const requests = await prisma.marketRequest.findMany({
    where: { status: statusFilter },
    orderBy: { createdAt: "asc" },
    take: 100,
    include: { user: { select: { email: true, name: true } } },
  });

  const serialized = requests.map((r) => ({
    id: r.id,
    sport: r.sport,
    league: r.league,
    description: r.description,
    status: r.status,
    adminNote: r.adminNote,
    createdAt: r.createdAt.toISOString(),
    user: r.user,
  }));

  const statuses = ["pending", "reviewed", "approved", "rejected"];

  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-2xl font-bold">Market Requests</h1>

      <div className="flex gap-2">
        {statuses.map((s) => (
          <a key={s} href={`?status=${s}`} className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors capitalize ${
            statusFilter === s ? "border-pf-brand bg-pf-brand/10 text-pf-brand" : "border-border text-muted-foreground hover:text-foreground"
          }`}>{s}</a>
        ))}
      </div>

      <AdminMarketsQueue requests={serialized} />
    </div>
  );
}
