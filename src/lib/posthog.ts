export const POSTHOG_TOKEN =
  process.env.NEXT_PUBLIC_POSTHOG_TOKEN ||
  process.env.NEXT_PUBLIC_POSTHOG_KEY ||
  "";

export const POSTHOG_HOST =
  process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://eu.i.posthog.com";

export function isPostHogConfigured() {
  return POSTHOG_TOKEN.length > 0;
}
