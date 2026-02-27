import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { prisma } from "@/lib/prisma";

async function requireAdmin() {
  const supabase = createServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return null;

  const user = await prisma.user.findFirst({
    where: { supabaseId: session.user.id },
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

  const payout = await prisma.payout.findUnique({ where: { id: payoutId } });
  if (!payout || payout.status !== "pending") {
    return NextResponse.json({ error: "Payout not found or not pending" }, { status: 404 });
  }

  const updated = await prisma.payout.update({
    where: { id: payoutId },
    data: {
      status: action === "approve" ? "paid" : "failed",
      txRef: txRef ?? null,
      adminNote: adminNote ?? null,
      approvedAt: action === "approve" ? new Date() : null,
      paidAt: action === "approve" ? new Date() : null,
    },
  });

  return NextResponse.json({ payout: updated });
}
