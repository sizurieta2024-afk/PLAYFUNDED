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
import { gradePick, type SettleStatus } from "@/lib/settlement/settle";
import {
  sendEmail,
  phase1PassedEmail,
  fundedEmail,
  challengeFailedEmail,
  drawdownWarningEmail,
  dailyLossWarningEmail,
} from "@/lib/email";
import { recordOpsEvent } from "@/lib/ops-events";
import { settlePendingPick } from "@/lib/settlement/settle-service";
import { settlePendingParlay } from "@/lib/settlement/settle-parlay";

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

function getLeagueConfig(sport: string, league: string): LeagueConfig | null {
  return (
    LEAGUE_CONFIG.find(
      (entry) => entry.sport === sport && entry.league === league,
    ) ?? null
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
      isParlay: false,
    },
  });

  if (pendingPicks.length === 0) {
    const settledAt = now.toISOString();
    await recordOpsEvent({
      type: "cron_settle_completed",
      level: "info",
      source: "api:settle",
      subjectType: "cron",
      subjectId: "settle",
      details: {
        settledAt,
        settled: 0,
        skipped: 0,
        errorCount: 0,
        pendingPicks: 0,
        noop: true,
      },
    });

    return NextResponse.json({
      ok: true,
      settledAt,
      settled: 0,
      skipped: 0,
      report: [],
    });
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

      const txResult = await settlePendingPick(prisma, {
        pickId: pick.id,
        status: settlement.status as SettleStatus,
        settledAt: now,
      });

      if (!txResult.ok) {
        report.push({
          pickId: pick.id,
          eventName: pick.eventName,
          status: "pending",
          outcome: "skipped",
          reason:
            txResult.code === "ALREADY_SETTLED"
              ? "Pick already settled"
              : txResult.error,
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
            txResult.minPicks,
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
      } else {
        // Warning emails: fire when crossing 70% of respective limits
        const { balance, startBalance, dailyStartBalance, phase } =
          txResult.challenge;

        // Drawdown warning: 70% of 15% = 10.5% used
        const drawdownRef = startBalance;
        const drawdownPct =
          drawdownRef > 0
            ? (Math.max(0, drawdownRef - balance) / drawdownRef) * 100
            : 0;
        if (drawdownPct >= 10.5) {
          const { subject, html } = drawdownWarningEmail(
            txResult.userName,
            txResult.tierName,
            drawdownPct,
          );
          void sendEmail(txResult.userEmail, subject, html);
        }

        // Daily loss warning: 70% of 10% = 7% used — phases only
        if (phase !== "funded") {
          const dailyLossPct =
            dailyStartBalance > 0
              ? (Math.max(0, dailyStartBalance - balance) / dailyStartBalance) *
                100
              : 0;
          if (dailyLossPct >= 7) {
            const { subject, html } = dailyLossWarningEmail(
              txResult.userName,
              txResult.tierName,
              dailyLossPct,
            );
            void sendEmail(txResult.userEmail, subject, html);
          }
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

  // ── Parlay settlement pass ────────────────────────────────────────────────────
  // A parlay is settleable once all its legs' events have started (eventStart ≤ now).
  const pendingParlays = await prisma.pick.findMany({
    where: {
      status: "pending",
      settledAt: null,
      eventStart: { lte: now },
      isParlay: true,
    },
    include: { parlayLegs: true },
  });

  for (const parlay of pendingParlays) {
    try {
      // Collect all distinct event IDs from legs
      const parlayEventIds = new Set(parlay.parlayLegs.map((l) => l.event));

      // Collect the leagues for fetching scores
      const parlayLeagueGroups = new Map<
        string,
        { config: ReturnType<typeof getLeagueConfig>; eventIds: Set<string> }
      >();
      for (const leg of parlay.parlayLegs) {
        const cfg = getLeagueConfig(leg.sport, leg.league);
        if (!cfg) continue;
        const key = `${cfg.provider}:${cfg.sport}:${cfg.league}`;
        const existing = parlayLeagueGroups.get(key);
        if (existing) {
          existing.eventIds.add(leg.event);
        } else {
          parlayLeagueGroups.set(key, {
            config: cfg,
            eventIds: new Set([leg.event]),
          });
        }
      }

      // Fetch scores for all leagues needed by this parlay
      const parlayScores = new Map<string, GameResult>();
      for (const { config, eventIds } of parlayLeagueGroups.values()) {
        if (!config) continue;
        try {
          const results =
            config.provider === "odds_api"
              ? await fetchOddsApiScores(config.providerKey)
              : await fetchApiFootballScores(eventIds);
          for (const result of results) {
            parlayScores.set(result.eventId, result);
          }
        } catch {
          // skip this league
        }
      }

      // Check all leg events have scores
      const allLegsHaveScores = [...parlayEventIds].every((id) =>
        parlayScores.has(id),
      );
      if (!allLegsHaveScores) {
        report.push({
          pickId: parlay.id,
          eventName: parlay.eventName,
          status: "pending",
          outcome: "skipped",
          reason: "Not all parlay leg scores are available yet",
        });
        skipped++;
        continue;
      }

      const txResult = await settlePendingParlay(prisma, {
        pickId: parlay.id,
        settledAt: now,
        scoresByEventId: parlayScores,
      });

      if (!txResult.ok) {
        report.push({
          pickId: parlay.id,
          eventName: parlay.eventName,
          status: "pending",
          outcome: "skipped",
          reason:
            txResult.code === "ALREADY_SETTLED"
              ? "Parlay already settled"
              : txResult.error,
        });
        skipped++;
        continue;
      }

      // Fire emails for parlay settlement outcomes
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
            txResult.minPicks,
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
        pickId: parlay.id,
        eventName: parlay.eventName,
        status: txResult.pick.status,
        outcome: "settled",
      });
      settled++;
    } catch (err) {
      console.error(`[settle] Error settling parlay ${parlay.id}:`, err);
      report.push({
        pickId: parlay.id,
        eventName: parlay.eventName,
        status: "pending",
        outcome: "error",
        reason: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }
  // ── End parlay settlement pass ────────────────────────────────────────────────

  const settledAt = now.toISOString();
  const errorCount = report.filter((entry) => entry.outcome === "error").length;

  await recordOpsEvent({
    type: errorCount > 0 ? "cron_settle_failed" : "cron_settle_completed",
    level: errorCount > 0 ? "warn" : "info",
    source: "api:settle",
    subjectType: "cron",
    subjectId: "settle",
    details: {
      settledAt,
      settled,
      skipped,
      errorCount,
    },
  });

  return NextResponse.json({
    ok: true,
    settledAt,
    settled,
    skipped,
    report,
  });
}
