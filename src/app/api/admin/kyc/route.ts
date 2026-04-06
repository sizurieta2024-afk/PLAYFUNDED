import { NextRequest, NextResponse } from "next/server";
import { createServerClient, createServiceClient } from "@/lib/supabase";
import { prisma } from "@/lib/prisma";
import { sendEmail, kycApprovedEmail, kycRejectedEmail } from "@/lib/email";
import { reviewKycByAdmin } from "@/lib/admin/review-service";
import { enforceRateLimit, rateLimitExceededResponse } from "@/lib/rate-limit";
import { withRouteMetric } from "@/lib/ops-observability";
import { z } from "zod";

const statusSchema = z.enum(["pending", "approved", "rejected"]);
const patchBodySchema = z.object({
  submissionId: z.string().uuid(),
  action: z.enum(["approve", "reject"]),
  reviewNote: z.string().max(1000).optional(),
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

// GET /api/admin/kyc — list pending KYC submissions with signed document URLs
export async function GET(req: NextRequest) {
  return withRouteMetric(
    {
      route: "GET /api/admin/kyc",
      source: "api:admin:kyc",
    },
    async () => {
      const limit = await enforceRateLimit(req, "admin:kyc:get", {
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

      const submissions = await prisma.kycSubmission.findMany({
        where: { status: status as never },
        include: {
          user: { select: { id: true, email: true, name: true } },
        },
        orderBy: { createdAt: "asc" },
        take: 100,
      });

  // Generate short-lived signed URLs for documents (60 min)
      const service = createServiceClient();
      const BUCKET = "kyc-documents";

      const withSignedUrls = await Promise.all(
        submissions.map(async (s) => {
      // Extract storage path from full URL
      const extractPath = (url: string) => {
        const marker = `/object/${BUCKET}/`;
        const idx = url.indexOf(marker);
        return idx >= 0 ? url.slice(idx + marker.length) : url;
      };

      const frontPath = extractPath(s.idFrontUrl);
      const { data: frontSigned } = await service.storage
        .from(BUCKET)
        .createSignedUrl(frontPath, 3600);

      let backSignedUrl: string | null = null;
      if (s.idBackUrl) {
        const backPath = extractPath(s.idBackUrl);
        const { data: backSigned } = await service.storage
          .from(BUCKET)
          .createSignedUrl(backPath, 3600);
        backSignedUrl = backSigned?.signedUrl ?? null;
      }

      return {
        ...s,
        dateOfBirth: s.dateOfBirth.toISOString(),
        createdAt: s.createdAt.toISOString(),
        updatedAt: s.updatedAt.toISOString(),
        reviewedAt: s.reviewedAt?.toISOString() ?? null,
        idFrontSignedUrl: frontSigned?.signedUrl ?? null,
        idBackSignedUrl: backSignedUrl,
      };
        }),
      );

      return NextResponse.json({ submissions: withSignedUrls });
    },
  );
}

// PATCH /api/admin/kyc — approve or reject KYC submission
export async function PATCH(req: NextRequest) {
  return withRouteMetric(
    {
      route: "PATCH /api/admin/kyc",
      source: "api:admin:kyc",
    },
    async () => {
      const patchLimit = await enforceRateLimit(req, "admin:kyc:patch", {
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

      const { submissionId, action, reviewNote } = body;

      const updated = await reviewKycByAdmin({
        db: prisma,
        adminId: admin.id,
        submissionId,
        action,
        reviewNote,
      });
      if (!updated) {
        return NextResponse.json(
          { error: "Submission not found or not pending" },
          { status: 404 },
        );
      }

      if (action === "approve") {
        const { subject, html } = kycApprovedEmail(updated.user.name);
        void sendEmail(updated.user.email, subject, html);
      } else {
        const { subject, html } = kycRejectedEmail(updated.user.name, reviewNote);
        void sendEmail(updated.user.email, subject, html);
      }

      return NextResponse.json({ submission: updated });
    },
  );
}
