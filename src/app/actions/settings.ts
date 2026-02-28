"use server";

import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase";
import { prisma } from "@/lib/prisma";
import { sendEmail, selfExclusionEmail } from "@/lib/email";

async function getAuthUser() {
  const supabase = createServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error("Unauthenticated");
  const user = await prisma.user.findFirst({
    where: { supabaseId: session.user.id },
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
    return { error: "Limit must be between $10 and $100,000" };
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
  period: "30d" | "90d" | "180d" | "permanent",
) {
  const user = await getAuthUser();

  if (user.isPermExcluded) {
    return { error: "Account is permanently excluded" };
  }

  const periodLabel =
    period === "permanent"
      ? "permanent"
      : period === "30d"
        ? "30 days"
        : period === "90d"
          ? "90 days"
          : "6 months";

  if (period === "permanent") {
    await prisma.user.update({
      where: { id: user.id },
      data: { isPermExcluded: true, selfExcludedUntil: null },
    });
  } else {
    const days = period === "30d" ? 30 : period === "90d" ? 90 : 180;
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
    return { error: "Permanent exclusion cannot be cancelled" };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { selfExcludedUntil: null },
  });

  revalidatePath("/dashboard/settings");
  return { success: true };
}
