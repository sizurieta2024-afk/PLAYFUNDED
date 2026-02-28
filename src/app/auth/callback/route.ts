import { NextRequest, NextResponse } from "next/server";
import { createServerClient as createSsrClient } from "@supabase/ssr";
import { prisma } from "@/lib/prisma";
import { sendEmail, welcomeEmail } from "@/lib/email";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (!code) {
    return NextResponse.redirect(`${origin}/auth/login?error=missing_code`);
  }

  // Build the redirect response first so we can write session cookies onto it
  const forwardedHost = request.headers.get("x-forwarded-host");
  const redirectBase =
    forwardedHost && process.env.NODE_ENV !== "development"
      ? `https://${forwardedHost}`
      : origin;

  const response = NextResponse.redirect(`${redirectBase}${next}`);

  // Create Supabase client that writes cookies directly to the response
  const supabase = createSsrClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.session) {
    return NextResponse.redirect(`${origin}/auth/login?error=auth_failed`);
  }

  const { user } = data.session;

  // Sync user to Postgres — fire-and-forget style so it never blocks the auth
  try {
    const refCode = request.cookies.get("pf_ref")?.value ?? null;

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
        ...(isNewUser && refCode ? { referredByCode: refCode } : {}),
      },
    });

    if (isNewUser && user.email) {
      const { subject, html } = welcomeEmail(upsertedUser.name);
      void sendEmail(user.email, subject, html);
    }
  } catch (err) {
    console.error("[auth/callback] DB sync error:", err);
  }

  return response;
}
