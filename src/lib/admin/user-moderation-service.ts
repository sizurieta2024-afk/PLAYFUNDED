import { Prisma, type PrismaClient } from "@prisma/client";

export async function setUserBanState(
  db: PrismaClient,
  input: {
    adminId: string;
    userId: string;
    banned: boolean;
    reason?: string | null;
  },
) {
  return db.$transaction(
    async (tx) => {
      const user = await tx.user.update({
        where: { id: input.userId },
        data: {
          isBanned: input.banned,
          banReason: input.banned ? input.reason ?? null : null,
        },
      });

      const audit = await tx.auditLog.create({
        data: {
          adminId: input.adminId,
          action: input.banned ? "ban_user" : "unban_user",
          targetType: "user",
          targetId: input.userId,
          note: input.banned ? input.reason ?? null : null,
        },
      });

      return { user, audit };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    },
  );
}
