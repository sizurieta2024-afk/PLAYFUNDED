import { NextRequest } from "next/server";
import { ALLOWED_FORWARDED_HOSTS } from "@/lib/allowed-hosts";

function firstHeaderValue(value: string | null): string | null {
  if (!value) return null;
  const first = value.split(",")[0]?.trim();
  return first || null;
}

function isLocalHost(host: string): boolean {
  return (
    /^localhost(?::\d+)?$/i.test(host) ||
    /^127\.0\.0\.1(?::\d+)?$/i.test(host)
  );
}

function normalizeBaseUrl(value?: string | null): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return trimmed.replace(/\/$/, "");
}

export function getCanonicalAppUrl(): string {
  const canonical =
    normalizeBaseUrl(process.env.APP_CANONICAL_URL) ??
    normalizeBaseUrl(process.env.NEXT_PUBLIC_APP_URL) ??
    "https://playfunded.lat";
  return canonical;
}

export function resolvePublicOrigin(request: NextRequest): string {
  const requestUrl = new URL(request.url);
  const forwardedHost = firstHeaderValue(request.headers.get("x-forwarded-host"));
  const forwardedProto =
    firstHeaderValue(request.headers.get("x-forwarded-proto")) ??
    requestUrl.protocol.replace(":", "");

  if (forwardedHost && ALLOWED_FORWARDED_HOSTS.includes(forwardedHost)) {
    return `${forwardedProto}://${forwardedHost}`;
  }

  const host = firstHeaderValue(request.headers.get("host"));
  if (host) {
    if (ALLOWED_FORWARDED_HOSTS.includes(host)) {
      return `${requestUrl.protocol}//${host}`;
    }
    if (process.env.NODE_ENV !== "production" && isLocalHost(host)) {
      return `${requestUrl.protocol}//${host}`;
    }
  }

  return getCanonicalAppUrl();
}
