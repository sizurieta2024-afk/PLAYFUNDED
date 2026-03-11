import { Prisma, type PrismaClient } from "@prisma/client";

export async function withWebhookLock<T>(
  db: PrismaClient,
  provider: string,
  providerRef: string,
  run: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  const lockKey = `webhook:${provider}:${providerRef}`;

  return db.$transaction(
    async (tx) => {
      await tx.$queryRaw`
        select pg_advisory_xact_lock(hashtext(${lockKey}))
      `;
      return run(tx);
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    },
  );
}
