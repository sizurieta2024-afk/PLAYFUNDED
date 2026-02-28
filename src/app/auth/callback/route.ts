import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { prisma } from "@/lib/prisma";
import { sendEmail, welcomeEmail } from "@/lib/email";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (!code) {
    return NextResponse.redirect(`${origin}/auth/login?error=missing_code`);
  }

  const supabase = createServerClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.session) {
    return NextResponse.redirect(`${origin}/auth/login?error=auth_failed`);
  }

  const { user } = data.session;

  // Capture referral code from cookie (set before signup via /ref/[code])
  const refCode = request.cookies.get("pf_ref")?.value ?? null;

  // Check if this is a truly new user (for ref attribution)
  const existingUser = await prisma.user.findUnique({
    where: { supabaseId: user.id },
    select: { id: true, referredByCode: true },
  });
  const isNewUser = !existingUser;

  // Sync Supabase user into our Postgres User table
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
      referredByCode: refCode,
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
      // Only set referredByCode on first-ever login, never overwrite
      ...(isNewUser && refCode ? { referredByCode: refCode } : {}),
    },
  });

  // Send welcome email to new users
  if (isNewUser && user.email) {
    const { subject, html } = welcomeEmail(upsertedUser.name);
    void sendEmail(user.email, subject, html);
  }

  // Respect x-forwarded-host in production (e.g. Vercel)
  const forwardedHost = request.headers.get("x-forwarded-host");
  if (forwardedHost && process.env.NODE_ENV !== "development") {
    return NextResponse.redirect(`https://${forwardedHost}${next}`);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
