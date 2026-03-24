// ============================================================
// PICKS API — place and list picks
// POST /api/picks  — place a new pick (deducts stake from balance)
// GET  /api/picks?challengeId=  — list picks for a challenge
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createServerClient } from "@/lib/supabase";
import { enforceRateLimit, rateLimitExceededResponse } from "@/lib/rate-limit";
import { checkStakeCap, checkMinStake, isEventLocked } from "@/lib/challenge";
import { findMarketOutcome, parseMarkets } from "@/lib/odds/markets";
import { placePickRequest } from "@/lib/picks/place-service";
import {
  placeParlayRequest,
  type ParlayLegInput,
} from "@/lib/picks/place-parlay-service";

// ── POST — place a pick ──────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const limit = await enforceRateLimit(req, "picks:post", {
    windowMs: 60_000,
    max: 20,
  });
  if (!limit.allowed)
    return rateLimitExceededResponse("Too many pick requests", limit);

  const supabase = await createServerClient();
  const {
    data: { user: authUser },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !authUser) {
    return NextResponse.json(
      { error: "Unauthorized", code: "UNAUTHORIZED" },
      { status: 401 },
    );
  }

  const body = (await req.json()) as {
    challengeId: string;
    sport: string;
    league: string;
    event: string;
    eventName?: string;
    marketType: string;
    selection: string;
    odds: number;
    linePoint?: number;
    stake: number; // integer cents
    // Parlay fields (only present when isParlay: true)
    isParlay?: boolean;
    legs?: Array<{
      sport: string;
      league: string;
      event: string;
      eventName?: string;
      marketType: string;
      selection: string;
      odds: number;
      linePoint?: number;
    }>;
  };

  // ── Parlay path ──────────────────────────────────────────────────────────────
  if (body.isParlay) {
    const { challengeId, stake, legs } = body;

    if (
      !challengeId ||
      !Array.isArray(legs) ||
      legs.length < 2 ||
      legs.length > 4
    ) {
      return NextResponse.json(
        {
          error: "Parlay must have 2–4 legs",
          code: "PARLAY_INVALID_LEG_COUNT",
        },
        { status: 400 },
      );
    }

    if (!Number.isInteger(stake) || stake < 100) {
      return NextResponse.json(
        { error: "Minimum stake is $1 (100 cents)", code: "INVALID_STAKE" },
        { status: 400 },
      );
    }

    // Resolve Prisma user
    const parlayUser = await prisma.user.findFirst({
      where: { supabaseId: authUser.id },
    });
    if (!parlayUser) {
      return NextResponse.json(
        { error: "User not found", code: "USER_NOT_FOUND" },
        { status: 404 },
      );
    }

    // Validate each leg against the odds cache
    const validatedLegs: ParlayLegInput[] = [];
    const now = new Date();
    const endOfTomorrow = new Date(now);
    endOfTomorrow.setDate(endOfTomorrow.getDate() + 1);
    endOfTomorrow.setHours(23, 59, 59, 999);

    for (const leg of legs) {
      if (
        !leg.sport ||
        !leg.league ||
        !leg.event ||
        !leg.marketType ||
        !leg.selection
      ) {
        return NextResponse.json(
          { error: "Missing fields in parlay leg", code: "VALIDATION_ERROR" },
          { status: 400 },
        );
      }
      if (typeof leg.odds !== "number" || leg.odds < 1.01) {
        return NextResponse.json(
          { error: "Invalid odds in parlay leg", code: "INVALID_ODDS" },
          { status: 400 },
        );
      }

      const oddsEvt = await prisma.oddsCache.findFirst({
        where: {
          sport: leg.sport,
          league: leg.league,
          OR: [{ event: leg.event }, { id: leg.event }],
        },
        orderBy: { fetchedAt: "desc" },
        select: {
          event: true,
          eventName: true,
          startTime: true,
          isLive: true,
          markets: true,
        },
      });
      if (!oddsEvt) {
        return NextResponse.json(
          {
            error: `Leg event no longer available: ${leg.event}`,
            code: "EVENT_NOT_FOUND",
          },
          { status: 404 },
        );
      }
      if (
        oddsEvt.isLive ||
        oddsEvt.startTime <= now ||
        isEventLocked(oddsEvt.startTime)
      ) {
        return NextResponse.json(
          {
            error: "A parlay leg event is locked or live",
            code: "EVENT_LOCKED",
          },
          { status: 409 },
        );
      }
      if (oddsEvt.startTime > endOfTomorrow) {
        return NextResponse.json(
          {
            error: "A parlay leg event is outside the betting window",
            code: "EVENT_OUT_OF_WINDOW",
          },
          { status: 400 },
        );
      }

      const legMarkets = parseMarkets(oddsEvt.markets);
      const matchedOutcome = findMarketOutcome(
        legMarkets,
        leg.marketType,
        leg.selection,
        leg.linePoint ?? null,
      );
      if (!matchedOutcome) {
        return NextResponse.json(
          {
            error:
              "Parlay leg market no longer available. Refresh and try again.",
            code: "MARKET_NOT_AVAILABLE",
          },
          { status: 409 },
        );
      }
      if (Math.abs(matchedOutcome.odds - leg.odds) > 0.000001) {
        return NextResponse.json(
          {
            error: "Parlay leg odds changed. Refresh the board and try again.",
            code: "ODDS_CHANGED",
          },
          { status: 409 },
        );
      }

      validatedLegs.push({
        sport: leg.sport,
        league: leg.league,
        event: oddsEvt.event,
        eventName: oddsEvt.eventName ?? leg.eventName ?? null,
        marketType: leg.marketType,
        selection: matchedOutcome.name,
        odds: matchedOutcome.odds,
        linePoint: matchedOutcome.point ?? null,
        eventStart: oddsEvt.startTime,
      });
    }

    try {
      const result = await placeParlayRequest({
        db: prisma,
        challengeId,
        userId: parlayUser.id,
        legs: validatedLegs,
        stake,
      });

      if (!result.ok) {
        return NextResponse.json(
          { error: result.error, code: result.code },
          { status: result.status },
        );
      }
      return NextResponse.json(result, { status: 201 });
    } catch (err) {
      console.error("[api/picks] Failed to place parlay:", err);
      return NextResponse.json(
        { error: "Failed to place parlay", code: "PARLAY_CREATE_FAILED" },
        { status: 500 },
      );
    }
  }
  // ── End parlay path ──────────────────────────────────────────────────────────

  const {
    challengeId,
    sport,
    league,
    event,
    eventName,
    marketType,
    selection,
    odds,
    linePoint,
    stake,
  } = body;

  // Field presence
  if (
    !challengeId ||
    !sport ||
    !league ||
    !event ||
    !marketType ||
    !selection
  ) {
    return NextResponse.json(
      { error: "Missing required fields", code: "VALIDATION_ERROR" },
      { status: 400 },
    );
  }

  // Odds must be decimal ≥ 1.01
  if (typeof odds !== "number" || odds < 1.01) {
    return NextResponse.json(
      { error: "Invalid odds", code: "INVALID_ODDS" },
      { status: 400 },
    );
  }

  // Stake must be integer cents ≥ 100 ($1 minimum)
  if (!Number.isInteger(stake) || stake < 100) {
    return NextResponse.json(
      { error: "Minimum stake is $1 (100 cents)", code: "INVALID_STAKE" },
      { status: 400 },
    );
  }

  const oddsEvent = await prisma.oddsCache.findFirst({
    where: {
      sport,
      league,
      OR: [{ event }, { id: event }],
    },
    orderBy: { fetchedAt: "desc" },
    select: {
      event: true,
      eventName: true,
      startTime: true,
      isLive: true,
      markets: true,
    },
  });
  if (!oddsEvent) {
    return NextResponse.json(
      { error: "Event is no longer available", code: "EVENT_NOT_FOUND" },
      { status: 404 },
    );
  }

  const markets = parseMarkets(oddsEvent.markets);
  const matchedOutcome = findMarketOutcome(
    markets,
    marketType,
    selection,
    linePoint ?? null,
  );
  if (!matchedOutcome) {
    return NextResponse.json(
      {
        error: "Market is no longer available. Refresh the odds and try again.",
        code: "MARKET_NOT_AVAILABLE",
      },
      { status: 409 },
    );
  }

  if (Math.abs(matchedOutcome.odds - odds) > 0.000001) {
    return NextResponse.json(
      {
        error: "Odds changed. Refresh the board and place the pick again.",
        code: "ODDS_CHANGED",
      },
      { status: 409 },
    );
  }

  // Resolve Prisma user
  const user = await prisma.user.findFirst({
    where: { supabaseId: authUser.id },
  });
  if (!user) {
    return NextResponse.json(
      { error: "User not found", code: "USER_NOT_FOUND" },
      { status: 404 },
    );
  }

  // Load challenge with tier (must belong to this user)
  const challenge = await prisma.challenge.findFirst({
    where: { id: challengeId, userId: user.id },
    include: { tier: true },
  });
  if (!challenge) {
    return NextResponse.json(
      { error: "Challenge not found", code: "CHALLENGE_NOT_FOUND" },
      { status: 404 },
    );
  }

  // Challenge must be active (phase1/phase2) or funded
  if (challenge.status !== "active" && challenge.status !== "funded") {
    return NextResponse.json(
      { error: "Challenge is not active", code: "CHALLENGE_NOT_ACTIVE" },
      { status: 400 },
    );
  }

  // Block picks while paused
  if (challenge.pausedUntil && new Date() < challenge.pausedUntil) {
    return NextResponse.json(
      { error: "Challenge is currently paused", code: "CHALLENGE_PAUSED" },
      { status: 400 },
    );
  }

  // Event window guard: always trust server-cached event timing, never client input.
  const parsedEventStart = oddsEvent.startTime;
  const now = new Date();
  const endOfTomorrow = new Date(now);
  endOfTomorrow.setDate(endOfTomorrow.getDate() + 1);
  endOfTomorrow.setHours(23, 59, 59, 999);
  if (
    oddsEvent.isLive ||
    parsedEventStart <= now ||
    isEventLocked(parsedEventStart)
  ) {
    return NextResponse.json(
      {
        error: "Event is locked before kickoff. Live betting is not allowed.",
        code: "EVENT_LOCKED",
      },
      { status: 409 },
    );
  }
  if (parsedEventStart > endOfTomorrow) {
    return NextResponse.json(
      {
        error: "Event is outside the allowed betting window",
        code: "EVENT_OUT_OF_WINDOW",
      },
      { status: 400 },
    );
  }

  // Stake cap: max 5% of phase starting balance
  const stakeViolation = checkStakeCap(challenge, stake);
  if (stakeViolation) {
    return NextResponse.json(
      { error: stakeViolation.error, code: stakeViolation.code },
      { status: 400 },
    );
  }

  // Stake minimum: 1% of original challenge balance
  const minStakeViolation = checkMinStake(challenge, stake);
  if (minStakeViolation) {
    return NextResponse.json(
      { error: minStakeViolation.error, code: minStakeViolation.code },
      { status: 422 },
    );
  }

  // potentialPayout = stake × odds, rounded to nearest cent
  const potentialPayout = Math.round(stake * matchedOutcome.odds);

  try {
    const result = await placePickRequest({
      db: prisma,
      challengeId,
      userId: user.id,
      sport,
      league,
      event: oddsEvent.event,
      eventName: oddsEvent.eventName ?? eventName ?? null,
      marketType,
      selection: matchedOutcome.name,
      odds: matchedOutcome.odds,
      linePoint: matchedOutcome.point ?? null,
      stake,
      potentialPayout,
      eventStart: parsedEventStart,
    });

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error, code: result.code },
        { status: result.status },
      );
    }

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("[api/picks] Failed to place pick:", error);
    return NextResponse.json(
      { error: "Failed to place pick", code: "PICK_CREATE_FAILED" },
      { status: 500 },
    );
  }
}

// ── GET — list picks for a challenge ────────────────────────────────────────

export async function GET(req: NextRequest) {
  const supabase = await createServerClient();
  const {
    data: { user: authUser },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !authUser) {
    return NextResponse.json(
      { error: "Unauthorized", code: "UNAUTHORIZED" },
      { status: 401 },
    );
  }

  const { searchParams } = new URL(req.url);
  const challengeId = searchParams.get("challengeId");

  if (!challengeId) {
    return NextResponse.json(
      { error: "challengeId is required", code: "VALIDATION_ERROR" },
      { status: 400 },
    );
  }

  const user = await prisma.user.findFirst({
    where: { supabaseId: authUser.id },
  });
  if (!user) {
    return NextResponse.json(
      { error: "User not found", code: "USER_NOT_FOUND" },
      { status: 404 },
    );
  }

  // Ownership check
  const challenge = await prisma.challenge.findFirst({
    where: { id: challengeId, userId: user.id },
  });
  if (!challenge) {
    return NextResponse.json(
      { error: "Challenge not found", code: "CHALLENGE_NOT_FOUND" },
      { status: 404 },
    );
  }

  const picks = await prisma.pick.findMany({
    where: { challengeId },
    orderBy: { placedAt: "desc" },
    take: 50,
  });

  return NextResponse.json({ picks, count: picks.length });
}
