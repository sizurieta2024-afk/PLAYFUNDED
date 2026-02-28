import { prisma } from "@/lib/prisma";
import { AdminAffiliatesTable } from "@/components/admin/AdminAffiliatesTable";

export default async function AdminAffiliatesPage() {
  const affiliates = await prisma.affiliate.findMany({
    orderBy: { totalEarned: "desc" },
    include: { user: { select: { email: true, name: true } } },
  });

  const serialized = affiliates.map((a) => ({
    id: a.id,
    code: a.code,
    commissionRate: a.commissionRate,
    totalClicks: a.totalClicks,
    totalConversions: a.totalConversions,
    totalEarned: a.totalEarned,
    pendingPayout: a.pendingPayout,
    user: a.user,
  }));

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold">Affiliates</h1>
        <p className="text-sm text-muted-foreground">
          {affiliates.length} affiliates · toggle commission rate 5% ↔ 10%
        </p>
      </div>
      <AdminAffiliatesTable affiliates={serialized} />
    </div>
  );
}
