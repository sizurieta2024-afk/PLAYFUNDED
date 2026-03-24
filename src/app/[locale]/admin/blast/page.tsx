import { prisma } from "@/lib/prisma";
import { AdminBlastForm } from "@/components/admin/AdminBlastForm";

export default async function AdminBlastPage() {
  const [allUsers, activeChallenges, fundedChallenges] = await Promise.all([
    prisma.user.count({ where: { isBanned: false } }),
    prisma.challenge.groupBy({
      by: ["userId"],
      where: { status: "active" },
    }),
    prisma.challenge.groupBy({
      by: ["userId"],
      where: { status: "funded" },
    }),
  ]);

  const counts = {
    all: allUsers,
    active_challenge: activeChallenges.length,
    funded: fundedChallenges.length,
  } as const;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Email Blast</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Send a message to a segment of users.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card p-6">
        <AdminBlastForm counts={counts} />
      </div>
    </div>
  );
}
