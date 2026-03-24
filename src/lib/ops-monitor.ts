import { prisma } from "@/lib/prisma";

export interface OpsHealthSummary {
  ok: boolean;
  checkedAt: string;
  windows: {
    cronMinutes: number;
    errorMinutes: number;
    duplicateMinutes: number;
  };
  checks: Array<{
    key: string;
    ok: boolean;
    message: string;
    value?: number | string | null;
  }>;
}

export async function getOpsHealthSummary(): Promise<OpsHealthSummary> {
  const now = new Date();
  const cronSince = new Date(now.getTime() - 30 * 60 * 1000);
  const errorSince = new Date(now.getTime() - 15 * 60 * 1000);
  const duplicateSince = new Date(now.getTime() - 15 * 60 * 1000);

  const [
    latestOddsSyncSuccess,
    latestSettlementSuccess,
    recentCronFailures,
    recentWebhookFailures,
    recentWebhookDuplicates,
  ] = await Promise.all([
    prisma.opsEventLog.findFirst({
      where: { type: "cron_odds_sync_completed" },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
    prisma.opsEventLog.findFirst({
      where: { type: "cron_settle_completed" },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
    prisma.opsEventLog.count({
      where: {
        type: { in: ["cron_odds_sync_failed", "cron_settle_failed"] },
        createdAt: { gte: errorSince },
      },
    }),
    prisma.opsEventLog.count({
      where: {
        type: "webhook_handler_failed",
        createdAt: { gte: errorSince },
      },
    }),
    prisma.opsEventLog.count({
      where: {
        type: "webhook_duplicate",
        createdAt: { gte: duplicateSince },
      },
    }),
  ]);

  const checks = [
    {
      key: "odds_sync_recent",
      ok:
        !!latestOddsSyncSuccess &&
        latestOddsSyncSuccess.createdAt >= cronSince,
      message: "Odds sync has succeeded recently.",
      value: latestOddsSyncSuccess?.createdAt.toISOString() ?? null,
    },
    {
      key: "settle_recent",
      ok:
        !!latestSettlementSuccess &&
        latestSettlementSuccess.createdAt >= cronSince,
      message: "Settlement has succeeded recently.",
      value: latestSettlementSuccess?.createdAt.toISOString() ?? null,
    },
    {
      key: "cron_failures",
      ok: recentCronFailures === 0,
      message: "No recent cron failures.",
      value: recentCronFailures,
    },
    {
      key: "webhook_failures",
      ok: recentWebhookFailures === 0,
      message: "No recent webhook handler failures.",
      value: recentWebhookFailures,
    },
    {
      key: "webhook_duplicates_spike",
      ok: recentWebhookDuplicates < 25,
      message: "Webhook duplicates are below the spike threshold.",
      value: recentWebhookDuplicates,
    },
  ];

  return {
    ok: checks.every((check) => check.ok),
    checkedAt: now.toISOString(),
    windows: {
      cronMinutes: 30,
      errorMinutes: 15,
      duplicateMinutes: 15,
    },
    checks,
  };
}
