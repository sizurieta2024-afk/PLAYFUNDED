import {
  type AnalyticsEventName,
  type AnalyticsProperties,
  sanitizeAnalyticsProperties,
} from "./events";
import {
  isPostHogConfigured,
  POSTHOG_HOST,
  POSTHOG_TOKEN,
} from "@/lib/posthog";

const DEFAULT_CAPTURE_TIMEOUT_MS = 1_500;

function postHogCaptureEndpoint() {
  return `${POSTHOG_HOST.replace(/\/+$/, "")}/i/v0/e/`;
}

function commonServerProperties() {
  return {
    app: "playfunded",
    source_runtime: "server",
    environment: process.env.VERCEL_ENV || process.env.NODE_ENV || "unknown",
  };
}

export async function captureServerEvent(
  event: AnalyticsEventName,
  distinctId: string | null | undefined,
  properties: AnalyticsProperties = {},
  options: { timeoutMs?: number } = {},
) {
  if (!isPostHogConfigured() || !distinctId) return;

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? DEFAULT_CAPTURE_TIMEOUT_MS,
  );

  try {
    const response = await fetch(postHogCaptureEndpoint(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: POSTHOG_TOKEN,
        distinct_id: distinctId,
        event,
        properties: sanitizeAnalyticsProperties({
          ...commonServerProperties(),
          ...properties,
        }),
      }),
      signal: controller.signal,
      cache: "no-store",
    });

    if (!response.ok) {
      console.warn("[posthog] capture failed", {
        event,
        status: response.status,
      });
    }
  } catch (error) {
    const aborted =
      error instanceof Error &&
      (error.name === "AbortError" || error.message.includes("aborted"));
    console.warn("[posthog] capture skipped", {
      event,
      reason: aborted ? "timeout" : "request_failed",
    });
  } finally {
    clearTimeout(timeout);
  }
}
