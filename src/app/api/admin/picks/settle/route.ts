// ============================================================
// ADMIN MANUAL SETTLEMENT
// POST /api/admin/picks/settle
// Admin provides pickId + result → settles the pick
// Used for manual overrides, disputed grading, and edge cases.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createServerClient } from "@/lib/supabase";
import { buildPostSettlementUpdate } from "@/lib/settlement/settle";
import type { SettleStatus } from "@/lib/settlement/settle";
import { enforceRateLimit, rateLimitExceededResponse } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  const limit = enforceRateLimit(req, "api:admin:picks:settle", {
    windowMs: 60_000,
    max: 60,
  });
  if (!limit.allowed) {
    return rateLimitExceededResponse("Too many settlement requests", limit);
  }

  // Auth: must be logged-in admin
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

  // Admin role check — server-side only
  const admin = await prisma.user.findFirst({
    where: { supabaseId: authUser.id, role: "admin" },
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

  const now = new Date();
  let updatedPick:
    | {
        id: string;
        status: string;
        actualPayout: number;
      }
    | undefined;
  let updatedChallenge:
    | {
        id: string;
        balance: number;
        status: string;
        phase: string;
      }
    | undefined;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const pick = await tx.pick.findUnique({
        where: { id: pickId },
        include: {
          challenge: {
            include: { tier: true },
          },
        },
      });

      if (!pick) {
        throw new Error("PICK_NOT_FOUND");
      }

      if (pick.status !== "pending") {
        throw new Error("ALREADY_SETTLED");
      }

      const actualPayout = status === "won" ? pick.potentialPayout : 0;
      const settledCount = await tx.pick.count({
        where: {
          challengeId: pick.challenge.id,
          status: { in: ["won", "lost", "push"] },
        },
      });

      const settledPickCount =
        status === "void" ? settledCount : settledCount + 1;

      const settledPick = {
        ...pick,
        status,
        actualPayout,
      };

      const { challengeUpdate } = buildPostSettlementUpdate(
        settledPick,
        pick.challenge,
        pick.challenge.tier,
        settledPickCount,
      );

      const challengeWrite = await tx.challenge.updateMany({
        where: {
          id: pick.challenge.id,
          updatedAt: pick.challenge.updatedAt,
        },
        data: challengeUpdate,
      });
      if (challengeWrite.count !== 1) {
        throw new Error("CHALLENGE_CONFLICT");
      }

      const pickWrite = await tx.pick.updateMany({
        where: {
          id: pickId,
          status: "pending",
          settledAt: null,
        },
        data: {
          status,
          actualPayout,
          settledAt: now,
        },
      });
      if (pickWrite.count !== 1) {
        throw new Error("PICK_CONFLICT");
      }

      const updatedPick = await tx.pick.findUnique({
        where: { id: pickId },
        select: { id: true, status: true, actualPayout: true },
      });
      const updatedChallenge = await tx.challenge.findUnique({
        where: { id: pick.challenge.id },
        select: { id: true, balance: true, status: true, phase: true },
      });

      if (!updatedPick || !updatedChallenge) {
        throw new Error("SETTLEMENT_READBACK_FAILED");
      }

      return { updatedPick, updatedChallenge };
    });

    updatedPick = result.updatedPick;
    updatedChallenge = result.updatedChallenge;
  } catch (error) {
    const code = error instanceof Error ? error.message : "SETTLEMENT_FAILED";
    if (code === "PICK_NOT_FOUND") {
      return NextResponse.json(
        { error: "Pick not found", code },
        { status: 404 },
      );
    }
    if (code === "ALREADY_SETTLED") {
      return NextResponse.json(
        { error: "Pick is already settled", code },
        { status: 400 },
      );
    }
    if (code === "CHALLENGE_CONFLICT" || code === "PICK_CONFLICT") {
      return NextResponse.json(
        { error: "Pick changed during settlement. Retry the action.", code },
        { status: 409 },
      );
    }

    console.error("[api/admin/picks/settle] Failed to settle pick:", error);
    return NextResponse.json(
      { error: "Failed to settle pick", code: "SETTLEMENT_FAILED" },
      { status: 500 },
    );
  }

  if (!updatedPick || !updatedChallenge) {
    return NextResponse.json(
      { error: "Failed to settle pick", code: "SETTLEMENT_READBACK_FAILED" },
      { status: 500 },
    );
  }

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
