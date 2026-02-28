"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createServerClient } from "@/lib/supabase";
import type { PayoutMethod } from "@prisma/client";

async function getAuthenticatedUser() {
  const supabase = createServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) redirect("/auth/login");

  const user = await prisma.user.findFirst({
    where: { supabaseId: session.user.id },
  });
  if (!user) redirect("/auth/login");
  return user;
}

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "PF-";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export async function becomeAffiliate(): Promise<{ error?: string; code?: string }> {
  const user = await getAuthenticatedUser();

  const existing = await prisma.affiliate.findUnique({
    where: { userId: user.id },
  });
  if (existing) return { code: existing.code };

  // Generate a unique code (retry on collision)
  let code = generateCode();
  for (let i = 0; i < 5; i++) {
    const collision = await prisma.affiliate.findUnique({ where: { code } });
    if (!collision) break;
    code = generateCode();
  }

  const affiliate = await prisma.affiliate.create({
    data: { userId: user.id, code },
  });

  return { code: affiliate.code };
}

export async function requestAffiliatePayout(
  method: PayoutMethod,
): Promise<{ error?: string }> {
  const user = await getAuthenticatedUser();

  const affiliate = await prisma.affiliate.findUnique({
    where: { userId: user.id },
  });
  if (!affiliate) return { error: "not_affiliate" };
  if (affiliate.pendingPayout <= 0) return { error: "no_pending" };

  // Guard: no duplicate pending affiliate payout
  const existing = await prisma.payout.findFirst({
    where: {
      userId: user.id,
      isAffiliate: true,
      status: "pending",
    },
  });
  if (existing) return { error: "pending_exists" };

  await prisma.$transaction([
    prisma.payout.create({
      data: {
        userId: user.id,
        amount: affiliate.pendingPayout,
        splitPct: 100, // affiliate gets 100% of their commission
        method,
        status: "pending",
        isAffiliate: true,
      },
    }),
    // Zero out pending — admin will mark paid after processing
    prisma.affiliate.update({
      where: { id: affiliate.id },
      data: { pendingPayout: 0 },
    }),
  ]);

  return {};
}
