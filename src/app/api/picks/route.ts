// ============================================================
// PICKS API — place and list picks
// POST /api/picks  — place a new pick (deducts stake from balance)
// GET  /api/picks?challengeId=  — list picks for a challenge
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createServerClient } from "@/lib/supabase";
import { checkStakeCap, checkMinStake, isEventLocked } from "@/lib/challenge";
import { findMarketOutcome, parseMarkets } from "@/lib/odds/markets";

class PickRequestError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

// ── POST — place a pick ──────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
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
    linePoint?: number; // spread or total line (null for moneyline)
    stake: number; // integer cents
  };

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
    where: { sport, league, event },
    orderBy: { fetchedAt: "desc" },
    select: {
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
  if (oddsEvent.isLive || parsedEventStart <= now || isEventLocked(parsedEventStart)) {
    return NextResponse.json(
      {
        error:
          "Event is locked before kickoff. Live betting is not allowed.",
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

  // Stake minimum: 1% of current balance
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
    const result = await prisma.$transaction(async (tx) => {
      const freshChallenge = await tx.challenge.findFirst({
        where: { id: challengeId, userId: user.id },
        include: { tier: true },
      });

      if (!freshChallenge) {
        throw new PickRequestError(404, "CHALLENGE_NOT_FOUND", "Challenge not found");
      }

      if (freshChallenge.status !== "active" && freshChallenge.status !== "funded") {
        throw new PickRequestError(
          400,
          "CHALLENGE_NOT_ACTIVE",
          "Challenge is not active",
        );
      }

      if (freshChallenge.pausedUntil && new Date() < freshChallenge.pausedUntil) {
        throw new PickRequestError(
          400,
          "CHALLENGE_PAUSED",
          "Challenge is currently paused",
        );
      }

      if (stake > freshChallenge.balance) {
        throw new PickRequestError(
          422,
          "INSUFFICIENT_BALANCE",
          "Insufficient balance for this pick",
        );
      }

      const currentStakeViolation = checkStakeCap(freshChallenge, stake);
      if (currentStakeViolation) {
        throw new PickRequestError(
          400,
          currentStakeViolation.code,
          currentStakeViolation.error,
        );
      }

      const currentMinStakeViolation = checkMinStake(freshChallenge, stake);
      if (currentMinStakeViolation) {
        throw new PickRequestError(
          422,
          currentMinStakeViolation.code,
          currentMinStakeViolation.error,
        );
      }

      const updated = await tx.challenge.updateMany({
        where: {
          id: challengeId,
          userId: user.id,
          balance: freshChallenge.balance,
        },
        data: { balance: { decrement: stake } },
      });

      if (updated.count !== 1) {
        throw new PickRequestError(
          409,
          "CHALLENGE_BALANCE_CHANGED",
          "Balance changed while placing the pick. Try again.",
        );
      }

      const pick = await tx.pick.create({
        data: {
          challengeId,
          userId: user.id,
          sport,
          league,
          event,
          eventName: oddsEvent.eventName ?? eventName ?? null,
          marketType,
          selection: matchedOutcome.name,
          odds: matchedOutcome.odds,
          linePoint: matchedOutcome.point ?? null,
          stake,
          potentialPayout,
          eventStart: parsedEventStart,
        },
      });

      return {
        pick,
        newBalance: freshChallenge.balance - stake,
      };
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof PickRequestError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status },
      );
    }

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
