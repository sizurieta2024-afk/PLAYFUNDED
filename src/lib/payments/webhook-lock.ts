import { Prisma, type PrismaClient } from "@prisma/client";

async function acquireWebhookLock(
  tx: Prisma.TransactionClient,
  lockKey: string,
) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const rows = await tx.$queryRaw<Array<{ locked: boolean }>>`
      select pg_try_advisory_xact_lock(hashtext(${lockKey})) as locked
    `;
    if (rows[0]?.locked) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }

  throw new Error("WEBHOOK_LOCK_TIMEOUT");
}

export async function withWebhookLock<T>(
  db: PrismaClient,
  provider: string,
  providerRef: string,
  run: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  const lockKey = `webhook:${provider}:${providerRef}`;

  return db.$transaction(
    async (tx) => {
      await acquireWebhookLock(tx, lockKey);
      return run(tx);
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    },
  );
}
