import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

interface RateLimitOptions {
  windowMs: number;
  max: number;
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

interface RateLimitRow {
  count: number;
  resetAt: Date;
}

function extractClientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() ?? "unknown";
  }

  const candidates = [
    request.headers.get("x-real-ip"),
    request.headers.get("cf-connecting-ip"),
    request.headers.get("x-vercel-forwarded-for"),
  ];

  return candidates.find(Boolean) ?? "unknown";
}

function extractClientKey(request: NextRequest): string {
  const ip = extractClientIp(request);
  const userAgent = request.headers.get("user-agent") ?? "unknown";
  return `${ip}:${userAgent.slice(0, 120)}`;
}

async function pruneExpiredBuckets(now: Date) {
  try {
    await prisma.$executeRaw(Prisma.sql`
      DELETE FROM "RateLimitBucket"
      WHERE "resetAt" < ${new Date(now.getTime() - 24 * 60 * 60 * 1000)}
    `);
  } catch {
    // Pruning is best-effort only.
  }
}

async function incrementBucket(
  routeKey: string,
  clientKey: string,
  options: RateLimitOptions,
  now: Date,
): Promise<RateLimitRow> {
  const key = `${routeKey}:${clientKey}`;
  const nextReset = new Date(now.getTime() + options.windowMs);

  const rows = await prisma.$queryRaw<RateLimitRow[]>(Prisma.sql`
    INSERT INTO "RateLimitBucket" (
      "key",
      "routeKey",
      "clientKey",
      "count",
      "resetAt",
      "createdAt",
      "updatedAt"
    )
    VALUES (
      ${key},
      ${routeKey},
      ${clientKey},
      1,
      ${nextReset},
      ${now},
      ${now}
    )
    ON CONFLICT ("key") DO UPDATE
    SET
      "count" = CASE
        WHEN "RateLimitBucket"."resetAt" <= ${now} THEN 1
        ELSE "RateLimitBucket"."count" + 1
      END,
      "resetAt" = CASE
        WHEN "RateLimitBucket"."resetAt" <= ${now} THEN ${nextReset}
        ELSE "RateLimitBucket"."resetAt"
      END,
      "updatedAt" = ${now}
    RETURNING "count", "resetAt"
  `);

  const bucket = rows[0];
  if (!bucket) {
    throw new Error("RATE_LIMIT_WRITE_FAILED");
  }
  return bucket;
}

export async function enforceRateLimit(
  request: NextRequest,
  routeKey: string,
  options: RateLimitOptions,
): Promise<RateLimitResult> {
  const now = new Date();
  const clientKey = extractClientKey(request);
  const bucket = await incrementBucket(routeKey, clientKey, options, now);

  // Only one request in ~100 does opportunistic cleanup.
  if (Math.random() < 0.01) {
    void pruneExpiredBuckets(now);
  }

  const remaining = Math.max(0, options.max - bucket.count);
  return {
    allowed: bucket.count <= options.max,
    limit: options.max,
    remaining,
    reset: Math.ceil(bucket.resetAt.getTime() / 1000),
  };
}

export function buildRateLimitHeaders(result: RateLimitResult): HeadersInit {
  return {
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(result.reset),
  };
}

export function rateLimitExceededResponse(
  message: string,
  result: RateLimitResult,
): NextResponse {
  return NextResponse.json(
    { error: message, code: "RATE_LIMITED" },
    {
      status: 429,
      headers: {
        ...buildRateLimitHeaders(result),
        "Retry-After": String(
          Math.max(1, result.reset - Math.floor(Date.now() / 1000)),
        ),
      },
    },
  );
}
