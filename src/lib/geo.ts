/**
 * Geo-blocking: blocks users from the United States.
 * Uses ipapi.co free tier (no key required, 1000 req/day).
 * Fails open — if the API is unreachable, the user is NOT blocked.
 */

const BLOCKED_COUNTRIES = new Set(['US'])

interface IpapiResponse {
  country_code?: string
  error?: boolean
  reason?: string
}

export async function isGeoBlocked(ip: string): Promise<boolean> {
  // Never block private/loopback IPs (local dev)
  if (
    !ip ||
    ip === '127.0.0.1' ||
    ip === '::1' ||
    ip === '::ffff:127.0.0.1' ||
    ip.startsWith('192.168.') ||
    ip.startsWith('10.') ||
    ip.startsWith('172.16.') ||
    ip.startsWith('172.17.') ||
    ip.startsWith('172.18.') ||
    ip.startsWith('172.19.') ||
    ip.startsWith('172.2') ||
    ip.startsWith('172.30.') ||
    ip.startsWith('172.31.')
  ) {
    return false
  }

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 2000) // 2s timeout

    const res = await fetch(`https://ipapi.co/${ip}/json/`, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    })

    clearTimeout(timeout)

    if (!res.ok) return false

    const data = (await res.json()) as IpapiResponse

    if (data.error) return false

    return BLOCKED_COUNTRIES.has(data.country_code ?? '')
  } catch {
    // Fail open — never block on API failure
    return false
  }
}
