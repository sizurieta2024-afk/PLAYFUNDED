import { timingSafeEqual } from "crypto";
import { NextRequest } from "next/server";

/**
 * Timing-safe authorization check for cron/ops endpoints.
 * Compares the Bearer token in the Authorization header against CRON_SECRET.
 */
export function isCronAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const provided = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;

  if (provided.length !== expected.length) return false;

  return timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
}
