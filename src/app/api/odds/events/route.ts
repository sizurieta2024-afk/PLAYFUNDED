// ============================================================
// ODDS EVENTS — serve cached events to frontend
// Used by pick placement UI (Session 8)
// Public endpoint (no auth required to browse events)
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { EVENT_LOCK_MINUTES } from "@/lib/challenge";
import { getNonFixtureOddsWhere } from "@/lib/fixture-data";
import { enforceRateLimit, rateLimitExceededResponse } from "@/lib/rate-limit";

export async function GET(req: NextRequest) {
  const limit = await enforceRateLimit(req, "odds:events", {
    windowMs: 60_000,
    max: 60,
  });
  if (!limit.allowed)
    return rateLimitExceededResponse("Too many requests", limit);

  const { searchParams } = new URL(req.url);
  const sport = searchParams.get("sport");
  const league = searchParams.get("league");

  // Only return events starting today or tomorrow and still open for picks.
  const now = new Date();
  const openWindowStart = new Date(
    now.getTime() + EVENT_LOCK_MINUTES * 60 * 1000,
  );
  const endOfTomorrow = new Date(now);
  endOfTomorrow.setDate(endOfTomorrow.getDate() + 1);
  endOfTomorrow.setHours(23, 59, 59, 999);

  const events = await prisma.oddsCache.findMany({
    where: getNonFixtureOddsWhere({
      ...(sport ? { sport } : {}),
      ...(league ? { league } : {}),
      isLive: false,
      startTime: { gt: openWindowStart, lte: endOfTomorrow },
    }),
    orderBy: { startTime: "asc" },
    take: 100,
    select: {
      id: true,
      event: true,
      sport: true,
      league: true,
      eventName: true,
      startTime: true,
      isLive: true,
      markets: true,
      fetchedAt: true,
    },
  });

  return NextResponse.json({ events, count: events.length });
}
