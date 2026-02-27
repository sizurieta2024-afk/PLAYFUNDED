// ============================================================
// ADMIN MANUAL SETTLEMENT
// POST /api/admin/picks/settle
// Admin provides pickId + result → settles the pick
// Used for API-Football events and any manual override.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createServerClient } from "@/lib/supabase";
import { buildPostSettlementUpdate } from "@/lib/settlement/settle";
import type { SettleStatus } from "@/lib/settlement/settle";

export async function POST(req: NextRequest) {
  // Auth: must be logged-in admin
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

  // Admin role check — server-side only
  const admin = await prisma.user.findFirst({
    where: { supabaseId: session.user.id, role: "admin" },
  });
  if (!admin) {
    return NextResponse.json(
      { error: "Forbidden", code: "FORBIDDEN" },
      { status: 403 },
    );
  }

  const body = (await req.json()) as {
    pickId: string;
    status: SettleStatus;
  };

  const { pickId, status } = body;

  if (!pickId || !["won", "lost", "void", "push"].includes(status)) {
    return NextResponse.json(
      { error: "pickId and status (won|lost|void|push) are required", code: "VALIDATION_ERROR" },
      { status: 400 },
    );
  }

  // Load pick with challenge + tier
  const pick = await prisma.pick.findUnique({
    where: { id: pickId },
    include: {
      challenge: {
        include: { tier: true },
      },
    },
  });

  if (!pick) {
    return NextResponse.json(
      { error: "Pick not found", code: "PICK_NOT_FOUND" },
      { status: 404 },
    );
  }

  if (pick.status !== "pending") {
    return NextResponse.json(
      { error: "Pick is already settled", code: "ALREADY_SETTLED" },
      { status: 400 },
    );
  }

  const now = new Date();
  const { challenge } = pick;

  // Calculate actualPayout based on result
  const actualPayout = status === "won" ? pick.potentialPayout : 0;

  // Count settled picks for phase check
  const settledCount = await prisma.pick.count({
    where: {
      challengeId: challenge.id,
      status: { in: ["won", "lost", "push"] },
    },
  });

  const settledPickCount =
    status === "void" ? settledCount : settledCount + 1;

  // Build settled pick object for post-settlement calculations
  const settledPick = {
    ...pick,
    status,
    actualPayout,
  };

  const { challengeUpdate } = buildPostSettlementUpdate(
    settledPick,
    challenge,
    challenge.tier,
    settledPickCount,
  );

  // Atomic transaction
  const [updatedPick, updatedChallenge] = await prisma.$transaction([
    prisma.pick.update({
      where: { id: pickId },
      data: {
        status,
        actualPayout,
        settledAt: now,
      },
    }),
    prisma.challenge.update({
      where: { id: challenge.id },
      data: challengeUpdate,
    }),
  ]);

  return NextResponse.json({
    ok: true,
    pick: updatedPick,
    challenge: {
      id: updatedChallenge.id,
      balance: updatedChallenge.balance,
      status: updatedChallenge.status,
      phase: updatedChallenge.phase,
    },
  });
}
