import { NextRequest, NextResponse } from "next/server";
import { createServerClient, createServiceClient } from "@/lib/supabase";
import { prisma } from "@/lib/prisma";
import { recordOpsEvent } from "@/lib/ops-events";
import { validateKycFile } from "@/lib/kyc-file";
import {
  getKycQuarantineBucket,
  getKycScanMode,
  scanKycBuffer,
  shouldQuarantineKycUpload,
} from "@/lib/kyc-malware-scan";
import { resolveKycPayoutEligibility } from "@/lib/kyc/eligibility";
import { enforceRateLimit, rateLimitExceededResponse } from "@/lib/rate-limit";

const BUCKET = "kyc-documents";

async function uploadBuffer(
  bucket: string,
  path: string,
  contentType: string,
  buffer: Buffer,
) {
  const service = createServiceClient();
  return service.storage.from(bucket).upload(path, buffer, {
    contentType,
    upsert: false,
  });
}

export async function POST(req: NextRequest) {
  const limit = await enforceRateLimit(req, "api:kyc:upload", {
    windowMs: 60_000,
    max: 10,
  });
  if (!limit.allowed) {
    return rateLimitExceededResponse("Too many KYC upload attempts", limit);
  }

  // Auth check
  const supabase = await createServerClient();
  const {
    data: { user: authUser },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findFirst({
    where: { supabaseId: authUser.id },
  });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const eligibility = await resolveKycPayoutEligibility(prisma, user);
  if (!eligibility.allowed) {
    return NextResponse.json({ error: eligibility.code }, { status: 403 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const validation = validateKycFile(user.id, file, buffer);
  if (!validation.ok) {
    await recordOpsEvent({
      type: "kyc_upload_rejected",
      level: "warn",
      source: "api:kyc:upload",
      actorUserId: user.id,
      subjectType: "kyc_upload",
      subjectId: user.id,
      country: user.country,
      details: {
        reason: validation.error,
        reportedType: file.type || "unknown",
        size: file.size,
      },
    });
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const scanMode = getKycScanMode();
  const scanResult = await scanKycBuffer(buffer);

  if (shouldQuarantineKycUpload(scanResult, scanMode)) {
    const quarantineBucket = getKycQuarantineBucket();
    const quarantinePath = `quarantine/${validation.storageName}`;
    const { error: quarantineError } = await uploadBuffer(
      quarantineBucket,
      quarantinePath,
      validation.contentType,
      buffer,
    );

    await recordOpsEvent({
      type: quarantineError ? "kyc_upload_quarantine_failed" : "kyc_upload_quarantined",
      level:
        scanResult.status === "infected" && !quarantineError
          ? "warn"
          : quarantineError
            ? "error"
            : "warn",
      source: "api:kyc:upload",
      actorUserId: user.id,
      subjectType: "kyc_upload",
      subjectId: quarantineError ? validation.storageName : quarantinePath,
      country: user.country,
      details: {
        reason:
          scanResult.status === "infected" ? "file_malware_detected" : "scan_unavailable",
        quarantineBucket,
        quarantinePath,
        quarantineError: quarantineError?.message ?? null,
        scanStatus: scanResult.status,
        scanMode,
        scanEngine: scanResult.engine,
        scanSignature: scanResult.signature ?? null,
        scanDetail: scanResult.detail ?? null,
        sha256: validation.sha256,
        size: validation.size,
        contentType: validation.contentType,
      },
    });

    if (quarantineError) {
      return NextResponse.json({ error: "quarantine_failed" }, { status: 500 });
    }

    return NextResponse.json(
      {
        error:
          scanResult.status === "infected"
            ? "file_malware_detected"
            : "scan_unavailable",
      },
      { status: scanResult.status === "infected" ? 400 : 503 },
    );
  }

  const { error: uploadError } = await uploadBuffer(
    BUCKET,
    validation.storageName,
    validation.contentType,
    buffer,
  );

  if (uploadError) {
    await recordOpsEvent({
      type: "kyc_upload_failed",
      level: "error",
      source: "api:kyc:upload",
      actorUserId: user.id,
      subjectType: "kyc_upload",
      subjectId: user.id,
      country: user.country,
      details: {
        error: uploadError.message,
        size: validation.size,
        contentType: validation.contentType,
      },
    });
    return NextResponse.json({ error: "upload_failed" }, { status: 500 });
  }

  await recordOpsEvent({
    type: "kyc_upload_received",
    source: "api:kyc:upload",
    actorUserId: user.id,
    subjectType: "kyc_upload",
    subjectId: validation.storageName,
    country: user.country,
    details: {
      contentType: validation.contentType,
      extension: validation.extension,
      sha256: validation.sha256,
      size: validation.size,
      scanStatus: scanResult.status,
      scanMode,
      scanEngine: scanResult.engine,
      scanSignature: scanResult.signature ?? null,
      scanDetail: scanResult.detail ?? null,
    },
  });

  // Return the storage path (not a public URL — bucket is private)
  return NextResponse.json({
    path: validation.storageName,
    scanStatus: scanResult.status,
  });
}
