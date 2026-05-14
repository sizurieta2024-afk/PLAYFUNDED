"use client";

import posthog from "posthog-js";
import {
  type AnalyticsEventName,
  type AnalyticsProperties,
  sanitizeAnalyticsProperties,
} from "./events";
import { isPostHogConfigured } from "@/lib/posthog";

function commonClientProperties() {
  if (typeof window === "undefined") {
    return { source_runtime: "client" };
  }

  return {
    source_runtime: "client",
    path: window.location.pathname,
  };
}

export function trackClientEvent(
  event: AnalyticsEventName,
  properties: AnalyticsProperties = {},
) {
  if (!isPostHogConfigured() || typeof window === "undefined") return;

  posthog.capture(
    event,
    sanitizeAnalyticsProperties({
      ...commonClientProperties(),
      ...properties,
    }),
  );
}
