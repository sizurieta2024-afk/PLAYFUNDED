"use client";

import { useEffect } from "react";
import { useLocale } from "next-intl";
import { createBrowserClient } from "@supabase/ssr";
import posthog from "posthog-js";
import { isPostHogConfigured } from "@/lib/posthog";

function identifyUser(
  user: {
    id: string;
  },
  locale: string,
) {
  posthog.identify(user.id, {
    locale,
  });
}

function PostHogUserIdentity() {
  const locale = useLocale();

  useEffect(() => {
    if (!isPostHogConfigured()) return;

    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
    let mounted = true;

    supabase.auth.getUser().then(({ data }) => {
      if (!mounted || !data.user) return;
      identifyUser(data.user, locale);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        identifyUser(session.user, locale);
      } else if (event === "SIGNED_OUT") {
        posthog.reset();
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [locale]);

  return null;
}

export function PostHogAnalytics() {
  if (!isPostHogConfigured()) return null;

  return <PostHogUserIdentity />;
}
