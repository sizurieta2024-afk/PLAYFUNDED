"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";

export function AuthHashSessionHandler() {
  const router = useRouter();

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
    // Validate redirect target — must be a same-origin relative path to prevent open redirect
    const rawNext = searchParams.get("redirectTo") ?? "";
    const next =
      rawNext.startsWith("/") &&
      !rawNext.startsWith("//") &&
      !rawNext.includes("://")
        ? rawNext
        : "/dashboard";

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
      .then(({ error }) => {
        if (cancelled || error) return;

        window.history.replaceState(
          null,
          "",
          `${window.location.pathname}${window.location.search}`,
        );
        router.replace(next);
        router.refresh();
      });

    return () => {
      cancelled = true;
    };
  }, [router]);

  return null;
}
