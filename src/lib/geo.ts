import { isGeoBlockedCountry, normalizeCountry } from "@/lib/country-policy";

/**
 * Geo lookups fail open. The actual country blocking rules live in
 * `country-policy` so public access, checkout, and payouts use one source
 * of truth.
 */

interface IpapiResponse {
  country_code?: string;
  error?: boolean;
  reason?: string;
}

export function isLocalIp(ip: string): boolean {
  if (
    !ip ||
    ip === "127.0.0.1" ||
    ip === "::1" ||
    ip === "::ffff:127.0.0.1" ||
    ip.startsWith("192.168.") ||
    ip.startsWith("10.") ||
    ip.startsWith("172.16.") ||
    ip.startsWith("172.17.") ||
    ip.startsWith("172.18.") ||
    ip.startsWith("172.19.") ||
    ip.startsWith("172.2") ||
    ip.startsWith("172.30.") ||
    ip.startsWith("172.31.")
  ) {
    return true;
  }
  return false;
}

export async function lookupCountryByIp(ip: string): Promise<string | null> {
  if (isLocalIp(ip)) {
    return null;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);

    const res = await fetch(`https://ipapi.co/${ip}/json/`, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) return null;

    const data = (await res.json()) as IpapiResponse;

    if (data.error) return null;

    return normalizeCountry(data.country_code ?? null);
  } catch {
    return null;
  }
}

export async function isGeoBlocked(ip: string): Promise<boolean> {
  const country = await lookupCountryByIp(ip);
  return isGeoBlockedCountry(country);
}
