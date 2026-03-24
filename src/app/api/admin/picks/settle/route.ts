// ============================================================
// ADMIN MANUAL SETTLEMENT
// POST /api/admin/picks/settle
// Admin provides pickId + result → settles the pick
// Used for manual overrides, disputed grading, and edge cases.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createServerClient } from "@/lib/supabase";
import type { SettleStatus } from "@/lib/settlement/settle";
import { settlePendingPick } from "@/lib/settlement/settle-service";
import { enforceRateLimit, rateLimitExceededResponse } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  const limit = await enforceRateLimit(req, "api:admin:picks:settle", {
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

  try {
    const result = await settlePendingPick(prisma, {
      pickId,
      status,
      settledAt: new Date(),
    });

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error, code: result.code },
        { status: result.status },
      );
    }

    return NextResponse.json({
      ok: true,
      pick: result.pick,
      challenge: result.challenge,
    });
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
}
