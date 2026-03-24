"use server";

import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase";
import { prisma } from "@/lib/prisma";
import { sendEmail, selfExclusionEmail } from "@/lib/email";

async function getAuthUser() {
  const supabase = await createServerClient();
  const {
    data: { user: authUser },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !authUser) throw new Error("Unauthenticated");
  const user = await prisma.user.findFirst({
    where: { supabaseId: authUser.id },
    select: {
      id: true,
      email: true,
      name: true,
      weeklyDepositLimit: true,
      selfExcludedUntil: true,
      isPermExcluded: true,
    },
  });
  if (!user) throw new Error("User not found");
  return user;
}

export async function getSettings() {
  const user = await getAuthUser();
  return {
    email: user.email,
    name: user.name,
    weeklyDepositLimitUsd: user.weeklyDepositLimit
      ? user.weeklyDepositLimit / 100
      : null,
    selfExcludedUntil: user.selfExcludedUntil?.toISOString() ?? null,
    isPermExcluded: user.isPermExcluded,
  };
}

export async function updateWeeklyLimit(limitUsd: number | null) {
  const user = await getAuthUser();

  if (limitUsd !== null && (limitUsd < 10 || limitUsd > 100_000)) {
    return { errorCode: "LIMIT_INVALID" as const };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      weeklyDepositLimit: limitUsd !== null ? Math.round(limitUsd * 100) : null,
    },
  });

  revalidatePath("/dashboard/settings");
  return { success: true };
}

export async function selfExclude(
  period: "30d" | "60d" | "90d" | "permanent",
) {
  const user = await getAuthUser();

  if (user.isPermExcluded) {
    return { errorCode: "PERM_EXCLUDED" as const };
  }

  const periodLabel =
    period === "permanent"
      ? "permanent"
      : period === "30d"
        ? "30 days"
        : period === "60d"
          ? "60 days"
        : period === "90d"
          ? "90 days"
          : "";

  if (period === "permanent") {
    await prisma.user.update({
      where: { id: user.id },
      data: { isPermExcluded: true, selfExcludedUntil: null },
    });
  } else {
    const days = period === "30d" ? 30 : period === "60d" ? 60 : 90;
    const until = new Date();
    until.setDate(until.getDate() + days);
    await prisma.user.update({
      where: { id: user.id },
      data: { selfExcludedUntil: until, isPermExcluded: false },
    });
  }

  const { subject, html } = selfExclusionEmail(user.name, periodLabel);
  void sendEmail(user.email, subject, html);

  revalidatePath("/dashboard/settings");
  return { success: true };
}

export async function cancelTempExclusion() {
  const user = await getAuthUser();

  if (user.isPermExcluded) {
    return { errorCode: "PERM_EXCLUSION_LOCKED" as const };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { selfExcludedUntil: null },
  });

  revalidatePath("/dashboard/settings");
  return { success: true };
}
