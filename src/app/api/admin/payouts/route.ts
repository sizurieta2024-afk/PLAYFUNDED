import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { prisma } from "@/lib/prisma";
import { sendEmail, payoutPaidEmail, payoutRejectedEmail } from "@/lib/email";
import { reviewPayoutByAdmin } from "@/lib/admin/review-service";
import { enforceRateLimit, rateLimitExceededResponse } from "@/lib/rate-limit";
import { withRouteMetric } from "@/lib/ops-observability";
import { z } from "zod";

const statusSchema = z.enum(["pending", "paid", "rejected"]);
const patchBodySchema = z.object({
  payoutId: z.string().uuid(),
  action: z.enum(["approve", "reject"]),
  txRef: z.string().max(200).optional(),
  adminNote: z.string().max(1000).optional(),
});

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
  return withRouteMetric(
    {
      route: "GET /api/admin/payouts",
      source: "api:admin:payouts",
    },
    async () => {
      const limit = await enforceRateLimit(req, "admin:payouts:get", {
        windowMs: 60_000,
        max: 60,
      });
      if (!limit.allowed)
        return rateLimitExceededResponse("Too many requests", limit);

      const admin = await requireAdmin();
      if (!admin) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      const { searchParams } = new URL(req.url);
      const parsed = statusSchema.safeParse(searchParams.get("status") ?? "pending");
      if (!parsed.success) {
        return NextResponse.json(
          { error: "Invalid status filter" },
          { status: 400 },
        );
      }
      const status = parsed.data;

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
    },
  );
}

// PATCH /api/admin/payouts — approve or reject a payout
export async function PATCH(req: NextRequest) {
  return withRouteMetric(
    {
      route: "PATCH /api/admin/payouts",
      source: "api:admin:payouts",
    },
    async () => {
      const patchLimit = await enforceRateLimit(req, "admin:payouts:patch", {
        windowMs: 60_000,
        max: 30,
      });
      if (!patchLimit.allowed)
        return rateLimitExceededResponse("Too many requests", patchLimit);

      const admin = await requireAdmin();
      if (!admin) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      let body: z.infer<typeof patchBodySchema>;
      try {
        body = patchBodySchema.parse(await req.json());
      } catch {
        return NextResponse.json({ error: "Missing fields" }, { status: 400 });
      }

      const { payoutId, action, txRef, adminNote } = body;

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
            {
              error: "Payout changed during review. Retry the action.",
              code: updated.code,
            },
            { status: 409 },
          );
        }
        if (updated.code === "CRYPTO_DESTINATION_REQUIRED") {
          return NextResponse.json(
            {
              error: updated.error ?? "Crypto destination is required",
              code: updated.code,
            },
            { status: 400 },
          );
        }
        if (updated.code === "PROVIDER_ERROR") {
          return NextResponse.json(
            {
              error:
                updated.error ??
                "Payout provider failed. The payout was left pending.",
              code: updated.code,
            },
            { status: 502 },
          );
        }
        return NextResponse.json(
          { error: "Payout not found or not pending" },
          { status: 404 },
        );
      }

      if (action === "approve" && updated.payout.status === "paid") {
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
    },
  );
}
