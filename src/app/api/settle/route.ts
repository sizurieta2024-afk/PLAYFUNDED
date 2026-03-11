// ============================================================
// SETTLE — cron endpoint: auto-settle picks via provider scores
// POST /api/settle  (Bearer CRON_SECRET required)
// Runs every 5 minutes via the production scheduler.
// Supports both The Odds API leagues and API-Football leagues.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { LEAGUE_CONFIG, type LeagueConfig } from "@/lib/odds/types";
import {
  fetchApiFootballScores,
  fetchOddsApiScores,
  type GameResult,
} from "@/lib/odds/scores";
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

function getLeagueConfig(sport: string, league: string): LeagueConfig | null {
  return (
    LEAGUE_CONFIG.find((entry) => entry.sport === sport && entry.league === league) ??
    null
  );
}

interface SettleReport {
  pickId: string;
  eventName: string | null;
  status: string;
  outcome: "settled" | "skipped" | "error";
  reason?: string;
}

// The scheduler sends GET — alias so both work
export { POST as GET };

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
  });

  if (pendingPicks.length === 0) {
    return NextResponse.json({ ok: true, settled: 0, skipped: 0, report: [] });
  }

  const scoreGroups = new Map<
    string,
    {
      config: LeagueConfig;
      eventIds: Set<string>;
    }
  >();

  for (const pick of pendingPicks) {
    const config = getLeagueConfig(pick.sport, pick.league);
    if (!config) continue;

    const key = `${config.provider}:${config.sport}:${config.league}`;
    const existing = scoreGroups.get(key);
    if (existing) {
      existing.eventIds.add(pick.event);
      continue;
    }

    scoreGroups.set(key, {
      config,
      eventIds: new Set([pick.event]),
    });
  }

  const scoresByEventId = new Map<string, GameResult>();
  for (const { config, eventIds } of scoreGroups.values()) {
    try {
      const results =
        config.provider === "odds_api"
          ? await fetchOddsApiScores(config.providerKey)
          : await fetchApiFootballScores(eventIds);
      for (const result of results) {
        scoresByEventId.set(result.eventId, result);
      }
    } catch (err) {
      console.error(
        `[settle] Failed to fetch scores for ${config.leagueDisplay} (${config.provider}):`,
        err,
      );
      // Continue — skip picks for this league rather than crashing
    }
  }

  const report: SettleReport[] = [];
  let settled = 0;
  let skipped = 0;

  for (const pick of pendingPicks) {
    try {
      const config = getLeagueConfig(pick.sport, pick.league);
      if (!config) {
        report.push({
          pickId: pick.id,
          eventName: pick.eventName,
          status: "pending",
          outcome: "skipped",
          reason: "Unsupported league configuration",
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
          reason:
            config.provider === "api_football"
              ? "Final score not yet available from API-Football"
              : "Score not yet available",
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

      const txResult = await prisma.$transaction(async (tx) => {
        const currentPick = await tx.pick.findUnique({
          where: { id: pick.id },
          include: {
            challenge: {
              include: {
                tier: true,
                user: { select: { email: true, name: true } },
              },
            },
          },
        });

        if (!currentPick || currentPick.status !== "pending" || currentPick.settledAt) {
          return {
            skipped: true,
            reason: "Pick already settled",
          } as const;
        }

        const settledCount = await tx.pick.count({
          where: {
            challengeId: currentPick.challenge.id,
            status: { in: ["won", "lost", "push"] },
          },
        });

        const settledPickCount =
          settlement.status === "void" ? settledCount : settledCount + 1;

        const settlePick = {
          ...currentPick,
          status: settlement.status as "won" | "lost" | "void" | "push",
          actualPayout: settlement.actualPayout,
        };

        const { challengeUpdate, autoFail, phaseAdvance } =
          buildPostSettlementUpdate(
            settlePick,
            currentPick.challenge,
            currentPick.challenge.tier,
            settledPickCount,
          );

        const challengeWrite = await tx.challenge.updateMany({
          where: {
            id: currentPick.challenge.id,
            updatedAt: currentPick.challenge.updatedAt,
          },
          data: challengeUpdate,
        });
        if (challengeWrite.count !== 1) {
          throw new Error("Challenge changed during settlement");
        }

        const pickWrite = await tx.pick.updateMany({
          where: {
            id: currentPick.id,
            status: "pending",
            settledAt: null,
          },
          data: {
            status: settlement.status,
            actualPayout: settlement.actualPayout,
            settledAt: now,
          },
        });
        if (pickWrite.count !== 1) {
          throw new Error("Pick changed during settlement");
        }

        return {
          skipped: false,
          autoFail,
          phaseAdvance,
          priorPhase: currentPick.challenge.phase,
          tierName: currentPick.challenge.tier.name,
          fundedBankroll: currentPick.challenge.tier.fundedBankroll,
          profitSplitPct: currentPick.challenge.tier.profitSplitPct,
          userEmail: currentPick.challenge.user.email,
          userName: currentPick.challenge.user.name,
        } as const;
      });

      if (txResult.skipped) {
        report.push({
          pickId: pick.id,
          eventName: pick.eventName,
          status: "pending",
          outcome: "skipped",
          reason: txResult.reason,
        });
        skipped++;
        continue;
      }

      // Fire transactional emails for significant challenge state changes
      if (txResult.autoFail) {
        const { subject, html } = challengeFailedEmail(
          txResult.userName,
          txResult.tierName,
          "drawdown or daily loss limit exceeded",
        );
        void sendEmail(txResult.userEmail, subject, html);
      } else if (txResult.phaseAdvance) {
        if (txResult.priorPhase === "phase1") {
          const { subject, html } = phase1PassedEmail(
            txResult.userName,
            txResult.tierName,
          );
          void sendEmail(txResult.userEmail, subject, html);
        } else if (txResult.priorPhase === "phase2") {
          const { subject, html } = fundedEmail(
            txResult.userName,
            txResult.tierName,
            txResult.fundedBankroll,
            txResult.profitSplitPct,
          );
          void sendEmail(txResult.userEmail, subject, html);
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
