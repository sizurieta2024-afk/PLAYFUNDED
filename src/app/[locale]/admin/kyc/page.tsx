import { prisma } from "@/lib/prisma";
import { createServiceClient } from "@/lib/supabase";
import { AdminKycQueue } from "@/components/admin/AdminKycQueue";

const BUCKET = "kyc-documents";

export default async function AdminKycPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const statusFilter = (status ?? "pending") as "pending" | "approved" | "rejected";

  const submissions = await prisma.kycSubmission.findMany({
    where: { status: statusFilter },
    orderBy: { createdAt: "asc" },
    take: 50,
    include: {
      user: { select: { email: true, name: true } },
    },
  });

  // Generate signed document URLs
  const service = createServiceClient();
  const extractPath = (url: string) => {
    const marker = `/object/${BUCKET}/`;
    const idx = url.indexOf(marker);
    return idx >= 0 ? url.slice(idx + marker.length) : url;
  };

  const withUrls = await Promise.all(
    submissions.map(async (s) => {
      const { data: front } = await service.storage
        .from(BUCKET)
        .createSignedUrl(extractPath(s.idFrontUrl), 3600);
      let backUrl: string | null = null;
      if (s.idBackUrl) {
        const { data: back } = await service.storage
          .from(BUCKET)
          .createSignedUrl(extractPath(s.idBackUrl), 3600);
        backUrl = back?.signedUrl ?? null;
      }
      return {
        id: s.id,
        status: s.status,
        fullName: s.fullName,
        dateOfBirth: s.dateOfBirth.toISOString(),
        country: s.country,
        idType: s.idType,
        idFrontSignedUrl: front?.signedUrl ?? null,
        idBackSignedUrl: backUrl,
        createdAt: s.createdAt.toISOString(),
        reviewNote: s.reviewNote,
        user: s.user,
      };
    }),
  );

  const statuses = ["pending", "approved", "rejected"];

  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-2xl font-bold">KYC Submissions</h1>

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

      <AdminKycQueue submissions={withUrls} />
    </div>
  );
}
