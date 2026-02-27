// ============================================================
// ODDS SYNC — cron endpoint
// Called by Vercel Cron every 10 minutes (pre-game)
// Protected by CRON_SECRET header
// Fetches from both providers and upserts into OddsCache
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { OddsApiProvider } from "@/lib/odds/odds-api";
import { ApiFootballProvider } from "@/lib/odds/api-football";
import { LEAGUE_CONFIG } from "@/lib/odds/types";
import type { OddsEvent } from "@/lib/odds/types";

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

interface SyncResult {
  league: string;
  provider: string;
  fetched: number;
  upserted: number;
  error?: string;
}

async function upsertEvents(events: OddsEvent[], provider: string): Promise<number> {
  let count = 0;
  for (const event of events) {
    await prisma.oddsCache.upsert({
      where: {
        sport_league_event_startTime: {
          sport: event.sport,
          league: event.league,
          event: event.id,
          startTime: event.startTime,
        },
      },
      update: {
        eventName: `${event.homeTeam} vs ${event.awayTeam}`,
        markets: event.markets as object[],
        fetchedAt: new Date(),
        isLive: event.isLive,
        provider,
      },
      create: {
        sport: event.sport,
        league: event.league,
        event: event.id,
        eventName: `${event.homeTeam} vs ${event.awayTeam}`,
        startTime: event.startTime,
        markets: event.markets as object[],
        fetchedAt: new Date(),
        isLive: event.isLive,
        provider,
      },
    });
    count++;
  }
  return count;
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const oddsApi = new OddsApiProvider();
  const apiFootball = new ApiFootballProvider();

  const results: SyncResult[] = [];

  for (const config of LEAGUE_CONFIG) {
    const provider = config.provider === "odds_api" ? oddsApi : apiFootball;
    try {
      const events = await provider.getEvents(config.sport, config.league);
      const upserted = await upsertEvents(events, config.provider);
      results.push({
        league: config.leagueDisplay,
        provider: config.provider,
        fetched: events.length,
        upserted,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[odds/sync] Failed for ${config.leagueDisplay}:`, message);
      results.push({
        league: config.leagueDisplay,
        provider: config.provider,
        fetched: 0,
        upserted: 0,
        error: message,
      });
    }
  }

  const totalFetched = results.reduce((sum, r) => sum + r.fetched, 0);
  const totalErrors = results.filter((r) => r.error).length;

  return NextResponse.json({
    ok: true,
    syncedAt: new Date().toISOString(),
    totalFetched,
    totalErrors,
    results,
  });
}

// Allow GET for manual health check (still requires auth)
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const latest = await prisma.oddsCache.findFirst({
    orderBy: { fetchedAt: "desc" },
    select: { fetchedAt: true, provider: true, league: true },
  });

  const countByLeague = await prisma.oddsCache.groupBy({
    by: ["league", "provider"],
    _count: { id: true },
    orderBy: { league: "asc" },
  });

  return NextResponse.json({
    lastSync: latest?.fetchedAt ?? null,
    lastProvider: latest?.provider ?? null,
    leagues: countByLeague.map((r) => ({
      league: r.league,
      provider: r.provider,
      count: r._count.id,
    })),
  });
}
