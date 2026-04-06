import { prisma } from "@/lib/prisma";
import { logOpsEvent, recordOpsEvent } from "@/lib/ops-events";

type OpsDetails = Record<string, unknown>;

interface RouteMetricOptions {
  route: string;
  source: string;
  actorUserId?: string;
  subjectType?: string;
  subjectId?: string;
  country?: string | null;
  details?: OpsDetails;
}

interface EventRow {
  type: string;
  level: string;
  source: string | null;
  details: unknown;
  createdAt: Date;
}

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function percentile(values: number[], target: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil(target * sorted.length) - 1),
  );
  return sorted[index] ?? null;
}

export async function withRouteMetric<T extends Response>(
  options: RouteMetricOptions,
  handler: () => Promise<T>,
): Promise<T> {
  const startedAt = Date.now();
  try {
    const response = await handler();
    const durationMs = Date.now() - startedAt;
    logOpsEvent({
      type: "route_request_completed",
      level:
        response.status >= 500
          ? "error"
          : response.status >= 400
            ? "warn"
            : "info",
      source: options.source,
      actorUserId: options.actorUserId,
      subjectType: options.subjectType,
      subjectId: options.subjectId,
      country: options.country ?? null,
      details: {
        route: options.route,
        status: response.status,
        durationMs,
        ...options.details,
      },
    });
    return response;
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    await recordOpsEvent({
      type: "route_request_failed",
      level: "error",
      source: options.source,
      actorUserId: options.actorUserId,
      subjectType: options.subjectType,
      subjectId: options.subjectId,
      country: options.country ?? null,
      details: {
        route: options.route,
        durationMs,
        error: error instanceof Error ? error.message : String(error),
        ...options.details,
      },
    });
    throw error;
  }
}

export interface OpsObservabilitySnapshot {
  checkedAt: string;
  db: {
    latencyMs: number | null;
    totalConnections: number | null;
    activeConnections: number | null;
    idleInTransaction: number | null;
    error: string | null;
  };
  routes: Array<{
    route: string;
    count: number;
    errorCount: number;
    avgMs: number | null;
    p95Ms: number | null;
    maxMs: number | null;
  }>;
  providers: Array<{
    provider: string;
    operation: string;
    successCount: number;
    failureCount: number;
    timeoutCount: number;
    quotaCount: number;
    outageCount: number;
    badResponseCount: number;
    lastFailureCode: string | null;
  }>;
  webhooks: {
    duplicateCount: number;
    failureCount: number;
  };
  crons: Array<{
    source: string;
    runs: number;
    failures: number;
    avgMs: number | null;
    p95Ms: number | null;
    lastRunAt: string | null;
  }>;
}

async function getDbMetrics(): Promise<OpsObservabilitySnapshot["db"]> {
  try {
    const latencyStart = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    const latencyMs = Date.now() - latencyStart;

    const rows = await prisma.$queryRaw<
      Array<{
        total_connections: number;
        active_connections: number;
        idle_in_transaction: number;
      }>
    >`
      SELECT
        COUNT(*)::int AS total_connections,
        COUNT(*) FILTER (WHERE state = 'active')::int AS active_connections,
        COUNT(*) FILTER (WHERE state = 'idle in transaction')::int AS idle_in_transaction
      FROM pg_stat_activity
      WHERE datname = current_database()
    `;

    const row = rows[0];
    return {
      latencyMs,
      totalConnections: row?.total_connections ?? null,
      activeConnections: row?.active_connections ?? null,
      idleInTransaction: row?.idle_in_transaction ?? null,
      error: null,
    };
  } catch (error) {
    return {
      latencyMs: null,
      totalConnections: null,
      activeConnections: null,
      idleInTransaction: null,
      error: error instanceof Error ? error.message : "db_metrics_failed",
    };
  }
}

export async function getOpsObservabilitySnapshot(): Promise<OpsObservabilitySnapshot> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [db, events] = await Promise.all([
    getDbMetrics(),
    prisma.opsEventLog.findMany({
      where: {
        createdAt: { gte: since },
        type: {
          in: [
            "route_request_completed",
            "route_request_failed",
            "provider_read_completed",
            "provider_read_failed",
            "webhook_duplicate",
            "webhook_handler_failed",
            "cron_odds_sync_completed",
            "cron_odds_sync_failed",
            "cron_settle_completed",
            "cron_settle_failed",
            "cron_payout_sync_completed",
          ],
        },
      },
      orderBy: { createdAt: "desc" },
      take: 1000,
      select: {
        type: true,
        level: true,
        source: true,
        details: true,
        createdAt: true,
      },
    }),
  ]);

  const routeMap = new Map<
    string,
    { durations: number[]; count: number; errorCount: number }
  >();
  const providerMap = new Map<
    string,
    {
      provider: string;
      operation: string;
      successCount: number;
      failureCount: number;
      timeoutCount: number;
      quotaCount: number;
      outageCount: number;
      badResponseCount: number;
      lastFailureCode: string | null;
    }
  >();
  const cronMap = new Map<
    string,
    { source: string; durations: number[]; runs: number; failures: number; lastRunAt: string | null }
  >();

  let webhookDuplicateCount = 0;
  let webhookFailureCount = 0;

  for (const event of events as EventRow[]) {
    const details = asObject(event.details);

    if (event.type === "route_request_completed" || event.type === "route_request_failed") {
      const route = asString(details?.route) ?? event.source ?? "unknown";
      const durationMs = asNumber(details?.durationMs);
      const entry = routeMap.get(route) ?? { durations: [], count: 0, errorCount: 0 };
      entry.count += 1;
      if (durationMs !== null) {
        entry.durations.push(durationMs);
      }
      if (
        event.type === "route_request_failed" ||
        (asNumber(details?.status) ?? 200) >= 500
      ) {
        entry.errorCount += 1;
      }
      routeMap.set(route, entry);
      continue;
    }

    if (event.type === "provider_read_completed" || event.type === "provider_read_failed") {
      const provider = asString(details?.provider) ?? event.source ?? "unknown";
      const operation = asString(details?.operation) ?? "unknown";
      const key = `${provider}:${operation}`;
      const entry =
        providerMap.get(key) ??
        {
          provider,
          operation,
          successCount: 0,
          failureCount: 0,
          timeoutCount: 0,
          quotaCount: 0,
          outageCount: 0,
          badResponseCount: 0,
          lastFailureCode: null,
        };
      if (event.type === "provider_read_completed") {
        entry.successCount += 1;
      } else {
        entry.failureCount += 1;
        const code = asString(details?.code);
        entry.lastFailureCode = entry.lastFailureCode ?? code;
        if (code === "timeout") entry.timeoutCount += 1;
        if (code === "quota_exhausted") entry.quotaCount += 1;
        if (code === "provider_outage") entry.outageCount += 1;
        if (code === "bad_response" || code === "network_error") {
          entry.badResponseCount += 1;
        }
      }
      providerMap.set(key, entry);
      continue;
    }

    if (event.type === "webhook_duplicate") {
      webhookDuplicateCount += 1;
      continue;
    }
    if (event.type === "webhook_handler_failed") {
      webhookFailureCount += 1;
      continue;
    }

    if (event.type.startsWith("cron_")) {
      const source = event.source ?? event.type;
      const entry =
        cronMap.get(source) ??
        {
          source,
          durations: [],
          runs: 0,
          failures: 0,
          lastRunAt: null,
        };
      entry.runs += 1;
      entry.lastRunAt = entry.lastRunAt ?? event.createdAt.toISOString();
      const durationMs = asNumber(details?.durationMs);
      if (durationMs !== null) {
        entry.durations.push(durationMs);
      }
      if (event.type.endsWith("_failed")) {
        entry.failures += 1;
      }
      cronMap.set(source, entry);
    }
  }

  const routes = Array.from(routeMap.entries())
    .map(([route, value]) => ({
      route,
      count: value.count,
      errorCount: value.errorCount,
      avgMs:
        value.durations.length > 0
          ? Math.round(
              value.durations.reduce((sum, item) => sum + item, 0) /
                value.durations.length,
            )
          : null,
      p95Ms: percentile(value.durations, 0.95),
      maxMs: value.durations.length > 0 ? Math.max(...value.durations) : null,
    }))
    .sort((a, b) => (b.p95Ms ?? 0) - (a.p95Ms ?? 0))
    .slice(0, 8);

  const providers = Array.from(providerMap.values())
    .sort((a, b) => b.failureCount - a.failureCount || b.successCount - a.successCount)
    .slice(0, 12);

  const crons = Array.from(cronMap.values())
    .map((entry) => ({
      source: entry.source,
      runs: entry.runs,
      failures: entry.failures,
      avgMs:
        entry.durations.length > 0
          ? Math.round(
              entry.durations.reduce((sum, item) => sum + item, 0) /
                entry.durations.length,
            )
          : null,
      p95Ms: percentile(entry.durations, 0.95),
      lastRunAt: entry.lastRunAt,
    }))
    .sort((a, b) => b.failures - a.failures || (b.p95Ms ?? 0) - (a.p95Ms ?? 0));

  return {
    checkedAt: new Date().toISOString(),
    db,
    routes,
    providers,
    webhooks: {
      duplicateCount: webhookDuplicateCount,
      failureCount: webhookFailureCount,
    },
    crons,
  };
}
