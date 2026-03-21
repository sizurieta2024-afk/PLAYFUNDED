import { prisma } from "@/lib/prisma";
import { AdminAffiliatesTable } from "@/components/admin/AdminAffiliatesTable";

export default async function AdminAffiliatesPage() {
  const [affiliates, conversionRows] = await Promise.all([
    prisma.affiliate.findMany({
      orderBy: { totalEarned: "desc" },
      include: { user: { select: { email: true, name: true } } },
    }),
    prisma.affiliateConversion.findMany({
      select: {
        affiliateId: true,
        userId: true,
        paidAmount: true,
        discountAmount: true,
      },
    }),
  ]);

  const conversionStats = new Map<
    string,
    {
      purchaseCount: number;
      grossSales: number;
      discountsGiven: number;
      userIds: Set<string>;
    }
  >();

  for (const row of conversionRows) {
    const existing =
      conversionStats.get(row.affiliateId) ??
      {
        purchaseCount: 0,
        grossSales: 0,
        discountsGiven: 0,
        userIds: new Set<string>(),
      };
    existing.purchaseCount += 1;
    existing.grossSales += row.paidAmount;
    existing.discountsGiven += row.discountAmount;
    existing.userIds.add(row.userId);
    conversionStats.set(row.affiliateId, existing);
  }

  const serialized = affiliates.map((a) => ({
    ...(() => {
      const stats = conversionStats.get(a.id);
      return {
        purchaseCount: stats?.purchaseCount ?? 0,
        uniqueCustomers: stats ? stats.userIds.size : 0,
        grossSales: stats?.grossSales ?? 0,
        discountsGiven: stats?.discountsGiven ?? 0,
      };
    })(),
    id: a.id,
    code: a.code,
    commissionRate: a.commissionRate,
    discountPct: a.discountPct,
    isActive: a.isActive,
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
          {affiliates.length} affiliate partners · codes, discounts, and conversion stats
        </p>
      </div>
      <AdminAffiliatesTable affiliates={serialized} />
    </div>
  );
}
