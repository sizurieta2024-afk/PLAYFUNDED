// ============================================================
// SETTLE — cron endpoint: auto-settle picks via Odds API scores
// POST /api/settle  (Bearer CRON_SECRET required)
// Runs every 5 minutes via Vercel Cron.
// Only auto-settles picks for Odds API events.
// API-Football events (LATAM leagues) require manual settlement.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { LEAGUE_CONFIG } from "@/lib/odds/types";
import { fetchScores, type GameResult } from "@/lib/odds/scores";
import { gradePick, buildPostSettlementUpdate } from "@/lib/settlement/settle";
import {
  sendEmail,
  phase1PassedEmail,
  fundedEmail,
  challengeFailedEmail,
} from "@/lib/email";

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

// Map sport+league → Odds API sport key (for the scores endpoint)
function getOddsApiSportKey(sport: string, league: string): string | null {
  const config = LEAGUE_CONFIG.find(
    (l) =>
      l.sport === sport && l.league === league && l.provider === "odds_api",
  );
  return config?.providerKey ?? null;
}

interface SettleReport {
  pickId: string;
  eventName: string | null;
  status: string;
  outcome: "settled" | "skipped" | "error";
  reason?: string;
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json(
      { error: "Unauthorized", code: "UNAUTHORIZED" },
      { status: 401 },
    );
  }

  const now = new Date();

  // Find all picks that can potentially be settled:
  // - status = pending (settledAt IS NULL via Prisma default)
  // - eventStart <= now (event has started)
  // - settledAt is null (idempotency guard)
  const pendingPicks = await prisma.pick.findMany({
    where: {
      status: "pending",
      settledAt: null,
      eventStart: { lte: now },
      isParlay: false, // parlays handled separately (not yet in UI)
    },
    include: {
      challenge: {
        include: {
          tier: true,
          user: { select: { email: true, name: true } },
        },
      },
    },
  });

  if (pendingPicks.length === 0) {
    return NextResponse.json({ ok: true, settled: 0, skipped: 0, report: [] });
  }

  // Fetch scores for each unique sport key (batch)
  const sportKeys = Array.from(
    new Set(
      pendingPicks
        .map((p) => getOddsApiSportKey(p.sport, p.league))
        .filter((k): k is string => k !== null),
    ),
  );

  const scoresByEventId = new Map<string, GameResult>();
  for (const sportKey of sportKeys) {
    try {
      const results = await fetchScores(sportKey);
      for (const result of results) {
        scoresByEventId.set(result.eventId, result);
      }
    } catch (err) {
      console.error(`[settle] Failed to fetch scores for ${sportKey}:`, err);
      // Continue — skip picks for this sport key rather than crashing
    }
  }

  const report: SettleReport[] = [];
  let settled = 0;
  let skipped = 0;

  for (const pick of pendingPicks) {
    const { challenge } = pick;

    try {
      // Is this an Odds API event?
      const sportKey = getOddsApiSportKey(pick.sport, pick.league);
      if (!sportKey) {
        report.push({
          pickId: pick.id,
          eventName: pick.eventName,
          status: "pending",
          outcome: "skipped",
          reason: "API-Football event — requires manual settlement",
        });
        skipped++;
        continue;
      }

      // Look up score for this event
      const gameResult = scoresByEventId.get(pick.event);
      if (!gameResult) {
        report.push({
          pickId: pick.id,
          eventName: pick.eventName,
          status: "pending",
          outcome: "skipped",
          reason: "Score not yet available",
        });
        skipped++;
        continue;
      }

      // Grade the pick
      const settlement = gradePick(
        {
          marketType: pick.marketType,
          selection: pick.selection,
          linePoint: pick.linePoint,
          stake: pick.stake,
          potentialPayout: pick.potentialPayout,
        },
        {
          homeTeam: gameResult.homeTeam,
          awayTeam: gameResult.awayTeam,
          homeScore: gameResult.homeScore,
          awayScore: gameResult.awayScore,
        },
      );

      // Count settled picks for phase check (non-pending, non-void)
      const settledCount = await prisma.pick.count({
        where: {
          challengeId: challenge.id,
          status: { in: ["won", "lost", "push"] },
        },
      });

      // The new pick is about to join settled count if won/lost/push
      const settledPickCount =
        settlement.status === "void" ? settledCount : settledCount + 1;

      // Build challenge update
      const settlePick = {
        ...pick,
        status: settlement.status as "won" | "lost" | "void" | "push",
        actualPayout: settlement.actualPayout,
      };

      const { challengeUpdate, autoFail, phaseAdvance } =
        buildPostSettlementUpdate(
          settlePick,
          challenge,
          challenge.tier,
          settledPickCount,
        );

      // Atomic transaction: update pick + challenge
      await prisma.$transaction([
        prisma.pick.update({
          where: { id: pick.id },
          data: {
            status: settlement.status,
            actualPayout: settlement.actualPayout,
            settledAt: now,
          },
        }),
        prisma.challenge.update({
          where: { id: challenge.id },
          data: challengeUpdate,
        }),
      ]);

      // Fire transactional emails for significant challenge state changes
      const userEmail = challenge.user.email;
      const userName = challenge.user.name;
      if (autoFail) {
        const { subject, html } = challengeFailedEmail(
          userName,
          challenge.tier.name,
          "drawdown or daily loss limit exceeded",
        );
        void sendEmail(userEmail, subject, html);
      } else if (phaseAdvance) {
        if (challenge.phase === "phase1") {
          const { subject, html } = phase1PassedEmail(
            userName,
            challenge.tier.name,
          );
          void sendEmail(userEmail, subject, html);
        } else if (challenge.phase === "phase2") {
          const { subject, html } = fundedEmail(
            userName,
            challenge.tier.name,
            challenge.tier.fundedBankroll,
            challenge.tier.profitSplitPct,
          );
          void sendEmail(userEmail, subject, html);
        }
      }

      report.push({
        pickId: pick.id,
        eventName: pick.eventName,
        status: settlement.status,
        outcome: "settled",
      });
      settled++;
    } catch (err) {
      console.error(`[settle] Error settling pick ${pick.id}:`, err);
      report.push({
        pickId: pick.id,
        eventName: pick.eventName,
        status: "pending",
        outcome: "error",
        reason: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  return NextResponse.json({
    ok: true,
    settledAt: now.toISOString(),
    settled,
    skipped,
    report,
  });
}
