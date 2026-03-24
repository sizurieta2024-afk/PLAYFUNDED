"use server";

import { createServerClient } from "@/lib/supabase";
import { prisma } from "@/lib/prisma";

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
  };
}
