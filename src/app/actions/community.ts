"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { createServerClient } from "@/lib/supabase";

async function getAuthenticatedUser() {
  const supabase = createServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) redirect("/auth/login");
  const user = await prisma.user.findFirst({
    where: { supabaseId: session.user.id },
    select: { id: true },
  });
  if (!user) redirect("/auth/login");
  return user;
}

export async function followTrader(
  traderId: string,
): Promise<{ error?: string }> {
  const user = await getAuthenticatedUser();
  if (user.id === traderId) return { error: "cannot_follow_self" };

  await prisma.follow.upsert({
    where: { followerId_followingId: { followerId: user.id, followingId: traderId } },
    create: { followerId: user.id, followingId: traderId },
    update: {},
  });

  revalidatePath(`/traders/${traderId}`);
  return {};
}

export async function unfollowTrader(
  traderId: string,
): Promise<{ error?: string }> {
  const user = await getAuthenticatedUser();

  await prisma.follow.deleteMany({
    where: { followerId: user.id, followingId: traderId },
  });

  revalidatePath(`/traders/${traderId}`);
  return {};
}
