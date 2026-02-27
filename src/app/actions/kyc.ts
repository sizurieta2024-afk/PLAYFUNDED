"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createServerClient } from "@/lib/supabase";
import type { IdType } from "@prisma/client";

export async function submitKyc(formData: {
  fullName: string;
  dateOfBirth: string; // ISO date string YYYY-MM-DD
  country: string;
  idType: IdType;
  idFrontPath: string;
  idBackPath?: string;
}): Promise<{ error?: string }> {
  const supabase = createServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) redirect("/auth/login");

  const user = await prisma.user.findFirst({
    where: { supabaseId: session.user.id },
    include: { kycSubmission: true },
  });
  if (!user) redirect("/auth/login");

  // Don't re-submit if already approved
  if (user.kycSubmission?.status === "approved") {
    return {};
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
