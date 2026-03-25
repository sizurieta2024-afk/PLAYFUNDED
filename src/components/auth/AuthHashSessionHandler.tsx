"use client";

import { useEffect } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { buildDashboardPath } from "@/lib/auth-verification";

const DEFAULT_LOCALE = "es-419";

function inferLocaleFromPath(pathname: string) {
  const [, maybeLocale] = pathname.split("/");
  return maybeLocale === "en" || maybeLocale === "pt-BR" || maybeLocale === "es-419"
    ? maybeLocale
    : DEFAULT_LOCALE;
}

export function AuthHashSessionHandler() {
  useEffect(() => {
    const hash = window.location.hash;
    const hasSessionTokens =
      hash.includes("access_token=") && hash.includes("refresh_token=");

    if (!hasSessionTokens) {
      return;
    }

    const params = new URLSearchParams(hash.slice(1));
    const searchParams = new URLSearchParams(window.location.search);
    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");
    const locale = inferLocaleFromPath(window.location.pathname);
    // Validate redirect target — must be a same-origin relative path to prevent open redirect
    const rawNext = searchParams.get("redirectTo") ?? "";
    const next =
      rawNext.startsWith("/") &&
      !rawNext.startsWith("//") &&
      !rawNext.includes("://")
        ? rawNext
        : buildDashboardPath(locale);

    if (!accessToken || !refreshToken) {
      return;
    }

    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );

    let cancelled = false;

    void supabase.auth
      .setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      })
      .then(async ({ error }) => {
        if (cancelled || error) return;

        const syncResponse = await fetch("/api/auth/sync-user", {
          method: "POST",
          credentials: "same-origin",
          headers: {
            "content-type": "application/json",
          },
        });

        if (cancelled || !syncResponse.ok) {
          window.history.replaceState(
            null,
            "",
            `${window.location.pathname}${window.location.search}`,
          );
          window.location.replace(
            locale === DEFAULT_LOCALE
              ? "/auth/login?error=auth_failed"
              : `/${locale}/auth/login?error=auth_failed`,
          );
          return;
        }

        window.history.replaceState(
          null,
          "",
          `${window.location.pathname}${window.location.search}`,
        );
        window.location.replace(next);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
