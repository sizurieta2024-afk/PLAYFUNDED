import { NextRequest, NextResponse } from "next/server";
import { createServerClient as createSsrClient } from "@supabase/ssr";
import { ALLOWED_FORWARDED_HOSTS } from "@/lib/allowed-hosts";
import { PENDING_VERIFICATION_COOKIE } from "@/lib/auth-verification";
import { syncAppUserFromAuthUser } from "@/lib/auth-user-sync";
import {
  buildDashboardPath,
  buildLoginPath,
  inferLocaleFromPath,
  normalizeLocale,
} from "@/i18n/navigation";
import { AnalyticsEvents } from "@/lib/analytics/events";
import { captureServerEvent } from "@/lib/analytics/posthog-server";

function loginPathForNext(next: string) {
  return buildLoginPath(inferLocaleFromPath(next));
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  // Validate redirect target — must be a same-origin relative path to prevent open redirect
  const rawNext = searchParams.get("next") ?? "";
  const fallbackLocale = normalizeLocale(
    request.cookies.get("NEXT_LOCALE")?.value,
  );
  const next =
    rawNext.startsWith("/") &&
    !rawNext.startsWith("//") &&
    !rawNext.includes("://")
      ? rawNext
      : buildDashboardPath(fallbackLocale);
  const callbackLocale = inferLocaleFromPath(next);
  const hadPendingVerification = Boolean(
    request.cookies.get(PENDING_VERIFICATION_COOKIE)?.value,
  );

  if (!code) {
    const fallbackTarget = `${origin}${loginPathForNext(next)}?redirectTo=${encodeURIComponent(next)}`;
    const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Redirecting…</title>
  </head>
  <body>
    <script>
      (function () {
        var hash = window.location.hash || "";
        var target = ${JSON.stringify(fallbackTarget)};
        window.location.replace(target + hash);
      })();
    </script>
    <noscript>
      <meta http-equiv="refresh" content="0;url=${fallbackTarget}" />
    </noscript>
  </body>
</html>`;

    return new NextResponse(html, {
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  }

  // Build the redirect response first so we can write session cookies onto it
  // Only trust x-forwarded-host if it matches our known production hostnames
  const forwardedHost = request.headers.get("x-forwarded-host");
  const trustedForwardedHost =
    forwardedHost && ALLOWED_FORWARDED_HOSTS.includes(forwardedHost)
      ? forwardedHost
      : null;
  const redirectBase = trustedForwardedHost
    ? `https://${trustedForwardedHost}`
    : origin;

  const response = NextResponse.redirect(`${redirectBase}${next}`);
  response.cookies.set({
    name: PENDING_VERIFICATION_COOKIE,
    value: "",
    path: "/",
    maxAge: 0,
  });

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
    return NextResponse.redirect(
      `${origin}${loginPathForNext(next)}?error=auth_failed`,
    );
  }

  const { user } = data.session;

  // Sync user to Postgres — fire-and-forget style so it never blocks the auth
  try {
    const refCode = request.cookies.get("pf_ref")?.value ?? null;
    await syncAppUserFromAuthUser(user, refCode);
  } catch (err) {
    console.error("[auth/callback] DB sync error:", err);
  }

  const provider =
    typeof user.app_metadata?.provider === "string"
      ? user.app_metadata.provider
      : "unknown";
  await captureServerEvent(
    hadPendingVerification
      ? AnalyticsEvents.EMAIL_VERIFIED
      : AnalyticsEvents.LOGIN_SUCCEEDED,
    user.id,
    {
      auth_provider: provider,
      callback_type: hadPendingVerification ? "email_verification" : "oauth",
      locale: callbackLocale,
    },
  );

  return response;
}
