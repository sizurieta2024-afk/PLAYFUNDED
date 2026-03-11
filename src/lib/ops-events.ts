import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { PLATFORM_POLICY } from "@/lib/platform-policy";

type OpsLevel = "info" | "warn" | "error";

export interface OpsEvent {
  type: string;
  level?: OpsLevel;
  source?: string;
  actorUserId?: string;
  subjectType?: string;
  subjectId?: string;
  country?: string | null;
  details?: Record<string, unknown>;
}

function sanitizeDetails(
  details?: Record<string, unknown>,
): Record<string, unknown> | undefined {
  if (!details) return undefined;

  return Object.fromEntries(
    Object.entries(details).map(([key, value]) => {
      if (value instanceof Date) {
        return [key, value.toISOString()];
      }
      if (value instanceof Error) {
        return [key, value.message];
      }
      return [key, value];
    }),
  );
}

function emitToConsole(payload: Record<string, unknown>, level: OpsLevel): void {
  const line = `[ops] ${JSON.stringify(payload)}`;
  if (level === "error") {
    console.error(line);
    return;
  }
  if (level === "warn") {
    console.warn(line);
    return;
  }
  console.info(line);
}

function toInputJson(
  value: Record<string, unknown> | undefined,
): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined {
  if (value === undefined) {
    return undefined;
  }
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export async function recordOpsEvent({
  type,
  level = "info",
  source,
  actorUserId,
  subjectType,
  subjectId,
  country,
  details,
}: OpsEvent): Promise<void> {
  const payload = {
    ts: new Date().toISOString(),
    level,
    type,
    source: source ?? null,
    actorUserId: actorUserId ?? null,
    subjectType: subjectType ?? null,
    subjectId: subjectId ?? null,
    country: country ?? null,
    policyVersion: PLATFORM_POLICY.policyVersion,
    details: sanitizeDetails(details),
  };
  emitToConsole(payload, level);

  try {
    await prisma.opsEventLog.create({
      data: {
        type,
        level,
        source: source ?? null,
        actorUserId: actorUserId ?? null,
        subjectType: subjectType ?? null,
        subjectId: subjectId ?? null,
        country: country ?? null,
        policyVersion: PLATFORM_POLICY.policyVersion,
        details: toInputJson(payload.details),
      },
    });
  } catch (error) {
    emitToConsole(
      {
        ts: new Date().toISOString(),
        level: "warn",
        type: "ops_event_persist_failed",
        source: "ops-events",
        policyVersion: PLATFORM_POLICY.policyVersion,
        details: sanitizeDetails({
          originalType: type,
          originalLevel: level,
          error,
        }),
      },
      "warn",
    );
  }
}

export function logOpsEvent(event: OpsEvent): void {
  void recordOpsEvent(event);
}
