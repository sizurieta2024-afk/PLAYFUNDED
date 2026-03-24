import { prisma } from "@/lib/prisma";
import { AdminAffiliatesTable } from "@/components/admin/AdminAffiliatesTable";
import { AdminAffiliateApplicationsTable } from "@/components/admin/AdminAffiliateApplicationsTable";
import { AdminAffiliateCodeRequestsTable } from "@/components/admin/AdminAffiliateCodeRequestsTable";

export default async function AdminAffiliatesPage() {
  const [affiliates, conversionRows, applications, codeRequests] =
    await Promise.all([
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
      prisma.affiliateApplication.findMany({
        where: { status: "pending" },
        orderBy: { createdAt: "asc" },
        include: { user: { select: { email: true, name: true } } },
      }),
      prisma.affiliateCodeChangeRequest.findMany({
        where: { status: "pending" },
        orderBy: { createdAt: "asc" },
        include: {
          affiliate: {
            select: { code: true, user: { select: { email: true } } },
          },
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
    const existing = conversionStats.get(row.affiliateId) ?? {
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

  const serializedApplications = applications.map((a) => ({
    id: a.id,
    fullName: a.fullName,
    country: a.country,
    reason: a.reason,
    socialHandles: a.socialHandles as Record<string, string | null> | null,
    audienceSize: a.audienceSize,
    website: a.website,
    createdAt: a.createdAt.toISOString(),
    user: a.user,
  }));

  const serializedCodeRequests = codeRequests.map((r) => ({
    id: r.id,
    requestedCode: r.requestedCode,
    currentCode: r.affiliate.code,
    affiliateEmail: r.affiliate.user.email,
    createdAt: r.createdAt.toISOString(),
  }));

  return (
    <div className="space-y-10 max-w-5xl">
      {/* Pending Applications */}
      {serializedApplications.length > 0 && (
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-bold text-foreground">
              Affiliate Applications
            </h2>
            <p className="text-sm text-muted-foreground">
              {serializedApplications.length} pending
            </p>
          </div>
          <AdminAffiliateApplicationsTable
            applications={serializedApplications}
          />
        </div>
      )}

      {/* Pending Code Change Requests */}
      {serializedCodeRequests.length > 0 && (
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-bold text-foreground">
              Code Change Requests
            </h2>
            <p className="text-sm text-muted-foreground">
              {serializedCodeRequests.length} pending
            </p>
          </div>
          <AdminAffiliateCodeRequestsTable requests={serializedCodeRequests} />
        </div>
      )}

      {/* Active Affiliates */}
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold">Affiliates</h1>
          <p className="text-sm text-muted-foreground">
            {affiliates.length} affiliate partners · codes, discounts, and
            conversion stats
          </p>
        </div>
        <AdminAffiliatesTable affiliates={serialized} />
      </div>
    </div>
  );
}
