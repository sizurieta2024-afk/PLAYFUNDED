import { NextRequest, NextResponse } from "next/server";
import { createServerClient as createSsrClient } from "@supabase/ssr";
import { ALLOWED_FORWARDED_HOSTS } from "@/lib/allowed-hosts";

function buildCallbackBase(request: NextRequest) {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const requestOrigin = new URL(request.url).origin;

  // Only trust x-forwarded-host if it matches our known production hostnames
  if (forwardedHost && ALLOWED_FORWARDED_HOSTS.includes(forwardedHost)) {
    return `${forwardedProto ?? "https"}://${forwardedHost}`;
  }

  return process.env.NEXT_PUBLIC_APP_URL?.trim() || requestOrigin;
}

export async function GET(request: NextRequest) {
  const callbackBase = buildCallbackBase(request);
  const loginUrl = new URL("/auth/login?error=oauth_failed", callbackBase);
  const response = NextResponse.next();

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

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${callbackBase}/auth/callback`,
    },
  });

  if (error || !data.url) {
    console.error("[auth/google] signInWithOAuth failed:", error);
    return NextResponse.redirect(loginUrl);
  }

  const redirect = NextResponse.redirect(data.url);
  response.cookies.getAll().forEach((cookie) => {
    redirect.cookies.set(cookie);
  });

  return redirect;
}
