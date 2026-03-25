import type { User as SupabaseUser } from "@supabase/supabase-js";
import { prisma } from "@/lib/prisma";
import { sendEmail, welcomeEmail } from "@/lib/email";

export async function syncAppUserFromAuthUser(
  user: SupabaseUser,
  refCode?: string | null,
) {
  const existingUser = await prisma.user.findUnique({
    where: { supabaseId: user.id },
    select: { id: true },
  });
  const isNewUser = !existingUser;

  const upsertedUser = await prisma.user.upsert({
    where: { supabaseId: user.id },
    create: {
      supabaseId: user.id,
      email: user.email!,
      name:
        (user.user_metadata?.full_name as string | undefined) ??
        (user.user_metadata?.name as string | undefined) ??
        null,
      avatar:
        (user.user_metadata?.avatar_url as string | undefined) ??
        (user.user_metadata?.picture as string | undefined) ??
        null,
      referredByCode: refCode ?? null,
    },
    update: {
      email: user.email!,
      name:
        (user.user_metadata?.full_name as string | undefined) ??
        (user.user_metadata?.name as string | undefined) ??
        undefined,
      avatar:
        (user.user_metadata?.avatar_url as string | undefined) ??
        (user.user_metadata?.picture as string | undefined) ??
        undefined,
      ...(isNewUser && refCode ? { referredByCode: refCode } : {}),
    },
  });

  if (isNewUser && user.email) {
    const { subject, html } = welcomeEmail(upsertedUser.name);
    void sendEmail(user.email, subject, html);
  }

  return upsertedUser;
}
