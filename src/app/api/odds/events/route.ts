// ============================================================
// ODDS EVENTS — serve cached events to frontend
// Used by pick placement UI (Session 8)
// Public endpoint (no auth required to browse events)
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sport = searchParams.get("sport");
  const league = searchParams.get("league");
  const live = searchParams.get("live") === "true";

  // Only return events starting within the next 7 days (or live)
  const now = new Date();
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const events = await prisma.oddsCache.findMany({
    where: {
      ...(sport ? { sport } : {}),
      ...(league ? { league } : {}),
      ...(live
        ? { isLive: true }
        : { startTime: { gte: now, lte: sevenDaysFromNow } }),
    },
    orderBy: { startTime: "asc" },
    take: 100,
    select: {
      id: true,
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
