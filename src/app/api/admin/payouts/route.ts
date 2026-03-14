import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { prisma } from "@/lib/prisma";
import {
  sendEmail,
  payoutPaidEmail,
  payoutRejectedEmail,
} from "@/lib/email";
import { reviewPayoutByAdmin } from "@/lib/admin/review-service";

async function requireAdmin() {
  const supabase = await createServerClient();
  const {
    data: { user: authUser },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !authUser) return null;

  const user = await prisma.user.findFirst({
    where: { supabaseId: authUser.id },
  });
  if (!user || user.role !== "admin") return null;
  return user;
}

// GET /api/admin/payouts — list pending payouts
export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") ?? "pending";

  const payouts = await prisma.payout.findMany({
    where: { status: status as never, isRollover: false },
    include: {
      user: { select: { id: true, email: true, name: true } },
      challenge: { include: { tier: { select: { name: true } } } },
    },
    orderBy: { requestedAt: "asc" },
    take: 100,
  });

  return NextResponse.json({ payouts });
}

// PATCH /api/admin/payouts — approve or reject a payout
export async function PATCH(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json()) as {
    payoutId: string;
    action: "approve" | "reject";
    txRef?: string;
    adminNote?: string;
  };

  const { payoutId, action, txRef, adminNote } = body;
  if (!payoutId || !action) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const updated = await reviewPayoutByAdmin({
    db: prisma,
    adminId: admin.id,
    payoutId,
    action,
    txRef,
    adminNote,
  });
  if (!updated.ok) {
    if (updated.code === "RETRYABLE_CONFLICT") {
      return NextResponse.json(
        { error: "Payout changed during review. Retry the action.", code: updated.code },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: "Payout not found or not pending" }, { status: 404 });
  }

  if (action === "approve") {
    const { subject, html } = payoutPaidEmail(
      updated.payout.user.name,
      updated.payout.amount,
      updated.payout.method,
      txRef,
    );
    void sendEmail(updated.payout.user.email, subject, html);
  } else {
    const { subject, html } = payoutRejectedEmail(
      updated.payout.user.name,
      updated.payout.amount,
      adminNote,
    );
    void sendEmail(updated.payout.user.email, subject, html);
  }

  return NextResponse.json({ payout: updated.payout });
}
