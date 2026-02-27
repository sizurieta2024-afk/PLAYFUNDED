import { NextRequest, NextResponse } from "next/server";
import { createServerClient, createServiceClient } from "@/lib/supabase";
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

// GET /api/admin/kyc — list pending KYC submissions with signed document URLs
export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") ?? "pending";

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
}

// PATCH /api/admin/kyc — approve or reject KYC submission
export async function PATCH(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json()) as {
    submissionId: string;
    action: "approve" | "reject";
    reviewNote?: string;
  };

  const { submissionId, action, reviewNote } = body;
  if (!submissionId || !action) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const submission = await prisma.kycSubmission.findUnique({
    where: { id: submissionId },
  });
  if (!submission || submission.status !== "pending") {
    return NextResponse.json(
      { error: "Submission not found or not pending" },
      { status: 404 },
    );
  }

  const updated = await prisma.kycSubmission.update({
    where: { id: submissionId },
    data: {
      status: action === "approve" ? "approved" : "rejected",
      reviewedAt: new Date(),
      reviewNote: reviewNote ?? null,
    },
  });

  return NextResponse.json({ submission: updated });
}
