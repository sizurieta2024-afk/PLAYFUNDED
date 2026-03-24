"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createServerClient } from "@/lib/supabase";
import type { IdType } from "@prisma/client";
import { resolveKycPayoutEligibility } from "@/lib/kyc/eligibility";

export async function submitKyc(formData: {
  fullName: string;
  dateOfBirth: string; // ISO date string YYYY-MM-DD
  country: string;
  idType: IdType;
  idFrontPath: string;
  idBackPath?: string;
}): Promise<{ error?: string }> {
  const supabase = await createServerClient();
  const {
    data: { user: authUser },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !authUser) redirect("/auth/login");

  const user = await prisma.user.findFirst({
    where: { supabaseId: authUser.id },
    include: { kycSubmission: true },
  });
  if (!user) redirect("/auth/login");

  // Don't re-submit if already approved
  if (user.kycSubmission?.status === "approved") {
    return {};
  }

  const eligibility = await resolveKycPayoutEligibility(prisma, user);
  if (!eligibility.allowed) {
    return { error: eligibility.code };
  }

  // Validate storage paths — must belong to this user and match expected format.
  // Prevents a user from submitting another user's document path or an arbitrary path.
  const KYC_PATH_RE =
    /^[a-zA-Z0-9-]+\/[0-9]+-[a-zA-Z0-9-]+\.(jpg|jpeg|png|pdf)$/i;
  const validateKycPath = (path: string, field: string): string | null => {
    if (!path.startsWith(`${user.id}/`))
      return `${field} does not belong to your account`;
    if (!KYC_PATH_RE.test(path)) return `${field} has an invalid format`;
    return null;
  };

  const frontErr = validateKycPath(formData.idFrontPath, "idFrontPath");
  if (frontErr) return { error: frontErr };
  if (formData.idBackPath) {
    const backErr = validateKycPath(formData.idBackPath, "idBackPath");
    if (backErr) return { error: backErr };
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const bucket = "kyc-documents";
  const toUrl = (path: string) =>
    `${supabaseUrl}/storage/v1/object/${bucket}/${path}`;

  if (user.kycSubmission) {
    // Resubmission after rejection — update existing record
    await prisma.kycSubmission.update({
      where: { id: user.kycSubmission.id },
      data: {
        status: "pending",
        fullName: formData.fullName,
        dateOfBirth: new Date(formData.dateOfBirth),
        country: formData.country,
        idType: formData.idType,
        idFrontUrl: toUrl(formData.idFrontPath),
        idBackUrl: formData.idBackPath ? toUrl(formData.idBackPath) : null,
        reviewedAt: null,
        reviewNote: null,
      },
    });
  } else {
    await prisma.kycSubmission.create({
      data: {
        userId: user.id,
        status: "pending",
        fullName: formData.fullName,
        dateOfBirth: new Date(formData.dateOfBirth),
        country: formData.country,
        idType: formData.idType,
        idFrontUrl: toUrl(formData.idFrontPath),
        idBackUrl: formData.idBackPath ? toUrl(formData.idBackPath) : null,
      },
    });
  }

  return {};
}
