import { NextRequest, NextResponse } from "next/server";

interface RateLimitOptions {
  windowMs: number;
  max: number;
}

interface Bucket {
  count: number;
  resetAt: number;
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

const globalBuckets = globalThis as unknown as {
  __playfundedRateLimitBuckets?: Map<string, Bucket>;
};

function getStore(): Map<string, Bucket> {
  if (!globalBuckets.__playfundedRateLimitBuckets) {
    globalBuckets.__playfundedRateLimitBuckets = new Map<string, Bucket>();
  }
  return globalBuckets.__playfundedRateLimitBuckets;
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

function pruneExpired(store: Map<string, Bucket>, now: number) {
  // Guard memory growth in long-lived processes.
  if (store.size < 5000) return;
  store.forEach((value, key) => {
    if (value.resetAt <= now) store.delete(key);
  });
}

export function enforceRateLimit(
  request: NextRequest,
  routeKey: string,
  options: RateLimitOptions,
): RateLimitResult {
  const now = Date.now();
  const store = getStore();
  pruneExpired(store, now);

  const ip = extractClientIp(request);
  const key = `${routeKey}:${ip}`;
  const current = store.get(key);

  const bucket =
    current && current.resetAt > now
      ? current
      : { count: 0, resetAt: now + options.windowMs };

  bucket.count += 1;
  store.set(key, bucket);

  const remaining = Math.max(0, options.max - bucket.count);
  return {
    allowed: bucket.count <= options.max,
    limit: options.max,
    remaining,
    reset: Math.ceil(bucket.resetAt / 1000),
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
        "Retry-After": String(Math.max(1, result.reset - Math.floor(Date.now() / 1000))),
      },
    },
  );
}
