import { prisma } from "@/lib/prisma";

export async function hasTradingGroupAccess(userId: string): Promise<boolean> {
  const [challengeCount, completedPaymentCount] = await Promise.all([
    prisma.challenge.count({ where: { userId } }),
    prisma.payment.count({
      where: { userId, status: "completed" },
    }),
  ]);

  return challengeCount > 0 || completedPaymentCount > 0;
}
