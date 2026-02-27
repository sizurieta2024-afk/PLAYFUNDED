// ============================================================
// PICKS API — place and list picks
// POST /api/picks  — place a new pick (deducts stake from balance)
// GET  /api/picks?challengeId=  — list picks for a challenge
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createServerClient } from "@/lib/supabase";
import { checkStakeCap, isEventLocked } from "@/lib/challenge";

// ── POST — place a pick ──────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const supabase = createServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
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
    eventStart?: string;
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
    eventStart,
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

  // Resolve Prisma user
  const user = await prisma.user.findFirst({
    where: { supabaseId: session.user.id },
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

  // Funded phase: enforce 30-minute pre-event lock
  if (challenge.phase === "funded" && eventStart) {
    if (isEventLocked(new Date(eventStart))) {
      return NextResponse.json(
        {
          error:
            "Event starts in less than 30 minutes — pick window closed for funded accounts",
          code: "EVENT_LOCKED",
        },
        { status: 400 },
      );
    }
  }

  // Stake cap: max 5% of current balance
  const stakeViolation = checkStakeCap(challenge, stake);
  if (stakeViolation) {
    return NextResponse.json(
      { error: stakeViolation.error, code: stakeViolation.code },
      { status: 400 },
    );
  }

  // potentialPayout = stake × odds, rounded to nearest cent
  const potentialPayout = Math.round(stake * odds);

  // Create pick + deduct stake atomically
  const pick = await prisma.$transaction(async (tx) => {
    const newPick = await tx.pick.create({
      data: {
        challengeId,
        userId: user.id,
        sport,
        league,
        event,
        eventName: eventName ?? null,
        marketType,
        selection,
        odds,
        linePoint: linePoint ?? null,
        stake,
        potentialPayout,
        eventStart: eventStart ? new Date(eventStart) : null,
      },
    });

    await tx.challenge.update({
      where: { id: challengeId },
      data: { balance: { decrement: stake } },
    });

    return newPick;
  });

  return NextResponse.json(
    { pick, newBalance: challenge.balance - stake },
    { status: 201 },
  );
}

// ── GET — list picks for a challenge ────────────────────────────────────────

export async function GET(req: NextRequest) {
  const supabase = createServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
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
    where: { supabaseId: session.user.id },
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
