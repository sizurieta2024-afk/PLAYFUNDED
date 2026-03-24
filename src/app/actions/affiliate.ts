"use server";

import { prisma } from "@/lib/prisma";
import { createServerClient } from "@/lib/supabase";
import { z } from "zod";

async function getAuthUser() {
  const supabase = await createServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) throw new Error("Unauthenticated");
  const dbUser = await prisma.user.findUnique({
    where: { supabaseId: user.id },
    select: { id: true },
  });
  if (!dbUser) throw new Error("User not found");
  return dbUser;
}

const applicationSchema = z.object({
  fullName: z.string().min(2).max(100),
  country: z.string().min(2).max(100),
  reason: z.string().min(50).max(2000),
  tiktok: z.string().max(100).optional(),
  instagram: z.string().max(100).optional(),
  twitter: z.string().max(100).optional(),
  youtube: z.string().max(100).optional(),
  audienceSize: z.enum(["under_1k", "1k_5k", "5k_20k", "20k_plus"]).optional(),
  website: z.string().url().max(200).optional().or(z.literal("")),
});

export async function submitAffiliateApplication(
  formData: z.infer<typeof applicationSchema>,
): Promise<{ error?: string }> {
  const user = await getAuthUser();

  const parsed = applicationSchema.safeParse(formData);
  if (!parsed.success) return { error: "invalid_input" };

  // Already an affiliate
  const existing = await prisma.affiliate.findUnique({
    where: { userId: user.id },
    select: { id: true },
  });
  if (existing) return { error: "already_affiliate" };

  // Already has a pending application
  const pendingApp = await prisma.affiliateApplication.findFirst({
    where: { userId: user.id, status: "pending" },
    select: { id: true },
  });
  if (pendingApp) return { error: "application_pending" };

  const {
    fullName,
    country,
    reason,
    tiktok,
    instagram,
    twitter,
    youtube,
    audienceSize,
    website,
  } = parsed.data;

  const socialHandles =
    tiktok || instagram || twitter || youtube
      ? {
          tiktok: tiktok || null,
          instagram: instagram || null,
          twitter: twitter || null,
          youtube: youtube || null,
        }
      : null;

  await prisma.affiliateApplication.create({
    data: {
      userId: user.id,
      fullName,
      country,
      reason,
      socialHandles: socialHandles ?? undefined,
      audienceSize: audienceSize ?? null,
      website: website || null,
    },
  });

  return {};
}

const codeSchema = z.object({
  code: z
    .string()
    .min(3)
    .max(20)
    .regex(
      /^[A-Z0-9_-]+$/,
      "Only uppercase letters, numbers, hyphens, underscores",
    ),
});

export async function requestAffiliateCodeChange(
  raw: string,
): Promise<{ error?: string }> {
  const user = await getAuthUser();

  const parsed = codeSchema.safeParse({ code: raw.trim().toUpperCase() });
  if (!parsed.success) return { error: "invalid_code" };
  const { code } = parsed.data;

  const affiliate = await prisma.affiliate.findUnique({
    where: { userId: user.id },
    select: { id: true, code: true },
  });
  if (!affiliate) return { error: "not_affiliate" };
  if (affiliate.code === code) return { error: "same_code" };

  // Check code not taken
  const taken = await prisma.affiliate.findUnique({
    where: { code },
    select: { id: true },
  });
  if (taken) return { error: "code_taken" };

  // Check for pending request
  const pending = await prisma.affiliateCodeChangeRequest.findFirst({
    where: { affiliateId: affiliate.id, status: "pending" },
    select: { id: true },
  });
  if (pending) return { error: "request_pending" };

  await prisma.affiliateCodeChangeRequest.create({
    data: { affiliateId: affiliate.id, requestedCode: code },
  });

  return {};
}

export async function getAffiliateData() {
  const user = await getAuthUser();

  const affiliate = await prisma.affiliate.findUnique({
    where: { userId: user.id },
    select: {
      id: true,
      code: true,
      discountPct: true,
      commissionRate: true,
      isActive: true,
      totalClicks: true,
      totalConversions: true,
      totalEarned: true,
      pendingPayout: true,
      createdAt: true,
      conversions: {
        select: {
          id: true,
          paidAmount: true,
          discountAmount: true,
          commissionEarned: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: 20,
      },
      codeRequests: {
        where: { status: "pending" },
        select: { id: true, requestedCode: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  const application = !affiliate
    ? await prisma.affiliateApplication.findFirst({
        where: { userId: user.id },
        select: { id: true, status: true, reviewNote: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      })
    : null;

  return { affiliate, application };
}
