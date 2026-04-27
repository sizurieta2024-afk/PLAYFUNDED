import * as Sentry from "@sentry/nextjs";
import posthog from "posthog-js";
import {
  isPostHogConfigured,
  POSTHOG_HOST,
  POSTHOG_TOKEN,
} from "@/lib/posthog";

let postHogRouteTrackingInstalled = false;

function capturePostHogPageview() {
  if (typeof window === "undefined") return;

  posthog.capture("$pageview", {
    $current_url: window.location.href,
  });
}

function installPostHogRouteTracking() {
  if (typeof window === "undefined" || postHogRouteTrackingInstalled) return;

  postHogRouteTrackingInstalled = true;
  let currentUrl = window.location.href;

  const schedulePageview = () => {
    window.setTimeout(() => {
      if (window.location.href === currentUrl) return;
      currentUrl = window.location.href;
      capturePostHogPageview();
    }, 0);
  };

  const originalPushState = window.history.pushState.bind(window.history);
  const originalReplaceState = window.history.replaceState.bind(window.history);

  window.history.pushState = ((...args) => {
    originalPushState(...args);
    schedulePageview();
  }) as typeof window.history.pushState;

  window.history.replaceState = ((...args) => {
    originalReplaceState(...args);
    schedulePageview();
  }) as typeof window.history.replaceState;

  window.addEventListener("popstate", schedulePageview);
}

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  enabled: process.env.NODE_ENV === "production",
  tracesSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  replaysSessionSampleRate: 0.05,
  integrations: [
    Sentry.replayIntegration({
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],
});

if (isPostHogConfigured()) {
  posthog.init(POSTHOG_TOKEN, {
    api_host: POSTHOG_HOST,
    defaults: "2026-01-30",
    capture_pageview: false,
    capture_pageleave: true,
    disable_session_recording:
      process.env.NEXT_PUBLIC_POSTHOG_SESSION_REPLAY !== "true",
    mask_all_text: true,
    mask_all_element_attributes: true,
    person_profiles: "identified_only",
    loaded: () => {
      window.setTimeout(() => {
        capturePostHogPageview();
        installPostHogRouteTracking();
      }, 0);
    },
  });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
