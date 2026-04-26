import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import createIntlMiddleware from "next-intl/middleware";
import { lookupCountryByIp } from "@/lib/geo";
import { getCountryPolicy, resolveCountry } from "@/lib/country-policy";
import { routing } from "@/i18n/routing";
import {
  buildDashboardPath,
  buildLoginPath,
  inferLocaleFromPath,
} from "@/i18n/navigation";

const intlMiddleware = createIntlMiddleware(routing);

const PROTECTED_PREFIXES = ["/dashboard", "/admin"];
const WEBHOOK_PREFIX = "/api/webhooks";
const API_PREFIX = "/api";

// Paths that skip geo-block
const GEO_EXEMPT_PREFIXES = [
  "/auth/geo-blocked",
  "/api/webhooks",
  "/api/auth",
  "/_next",
  "/dashboard",
  "/admin",
];

// Search engine and AI crawler user agents — bypass geo-block so content is indexable
const CRAWLER_UA_PATTERNS = [
  "googlebot",
  "google-inspectiontool",
  "bingbot",
  "slurp", // Yahoo
  "duckduckbot",
  "baiduspider",
  "yandexbot",
  "applebot",
  "gptbot", // OpenAI
  "chatgpt-user",
  "anthropic-ai",
  "claudebot",
  "perplexitybot",
  "cohere-ai",
];

function isCrawler(ua: string | null): boolean {
  if (!ua) return false;
  const lower = ua.toLowerCase();
  return CRAWLER_UA_PATTERNS.some((p) => lower.includes(p));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const requestLocale = inferLocaleFromPath(pathname);

  // ── 1. Webhooks bypass everything ────────────────────────────────────
  if (pathname.startsWith(WEBHOOK_PREFIX)) {
    return NextResponse.next();
  }

  // ── 2. API routes + auth callbacks: skip intl, just pass through ─────
  if (pathname.startsWith(API_PREFIX)) {
    return NextResponse.next();
  }

  // Auth callback is a route handler — not a locale-aware page.
  // Without this bypass, intl middleware redirects it to /en/auth/callback
  // (based on Accept-Language header), which has no handler → 404.
  if (pathname === "/auth/callback" || pathname === "/indexnow.txt") {
    return NextResponse.next();
  }

  // ── 3. Geo-block: only check public-facing pages ─────────────────────
  // Strip locale prefix for exempt check (e.g. /en/auth/geo-blocked → /auth/geo-blocked)
  const pathnameWithoutLocale =
    pathname.replace(/^\/(es-419|pt-BR|en)/, "") || "/";
  const isGeoExempt = GEO_EXEMPT_PREFIXES.some(
    (p) => pathnameWithoutLocale.startsWith(p) || pathname.startsWith(p),
  );

  const ua = request.headers.get("user-agent");
  if (!isGeoExempt && !isCrawler(ua)) {
    const ip =
      request.headers.get("x-real-ip") ??
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      "127.0.0.1";
    const headerCountry = resolveCountry(
      request.headers.get("x-vercel-ip-country"),
      request.headers.get("cf-ipcountry"),
    );
    const derivedCountry = headerCountry ?? (await lookupCountryByIp(ip));
    const policy = getCountryPolicy(derivedCountry);

    if (!policy.publicAccess) {
      return NextResponse.redirect(new URL("/auth/geo-blocked", request.url));
    }
  }

  // ── 4. Geo-based locale default: Brazil → pt-BR ──────────────────────
  // If the user has no explicit locale cookie and is from Brazil, set
  // NEXT_LOCALE=pt-BR in the response. next-intl reads this cookie on the
  // next request, automatically serving Brazilian Portuguese.
  // Uses Vercel's x-vercel-ip-country header — zero latency, no API call.
  const hasLocaleCookie = !!request.cookies.get("NEXT_LOCALE");
  const geoCountry = resolveCountry(
    request.headers.get("x-vercel-ip-country"),
    request.headers.get("cf-ipcountry"),
  );

  // ── 5. Run next-intl middleware (locale detection + routing) ──────────
  const intlResponse = intlMiddleware(request);

  if (!hasLocaleCookie && geoCountry === "BR") {
    intlResponse.cookies.set("NEXT_LOCALE", "pt-BR", {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
    });
  }

  // If intl wants to redirect (e.g. normalise locale prefix), honour it
  if (
    intlResponse.status === 307 ||
    intlResponse.status === 302 ||
    intlResponse.status === 308
  ) {
    return intlResponse;
  }

  // ── 6. Supabase session refresh ───────────────────────────────────────
  let response = intlResponse;

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({ name, value, ...options });
          response = NextResponse.next({
            request: { headers: request.headers },
          });
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: "", ...options });
          response = NextResponse.next({
            request: { headers: request.headers },
          });
          response.cookies.set({ name, value: "", ...options });
        },
      },
    },
  );

  const {
    data: { user: authUser },
    error: authError,
  } = await supabase.auth.getUser();
  const isAuthenticated = !authError && !!authUser;

  // Normalise path (strip locale prefix) for protected-route checks
  const cleanPath = pathnameWithoutLocale || pathname;
  const isProtected = PROTECTED_PREFIXES.some((prefix) =>
    cleanPath.startsWith(prefix),
  );

  // ── 7. Unauthenticated → protected route ─────────────────────────────
  if (isProtected && !isAuthenticated) {
    const loginUrl = new URL(buildLoginPath(requestLocale), request.url);
    loginUrl.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // ── 8. Admin route — server-side role check ───────────────────────────
  if (cleanPath.startsWith("/admin") && isAuthenticated && authUser) {
    const { data: user } = await supabase
      .from("User")
      .select("role")
      .eq("supabaseId", authUser.id)
      .single();

    if (!user || user.role !== "admin") {
      return NextResponse.redirect(
        new URL(buildDashboardPath(requestLocale), request.url),
      );
    }
  }

  // ── 9. Authenticated user hitting auth pages → redirect to dashboard ──
  if (
    isAuthenticated &&
    (cleanPath.startsWith("/auth/login") ||
      cleanPath.startsWith("/auth/signup"))
  ) {
    return NextResponse.redirect(
      new URL(buildDashboardPath(requestLocale), request.url),
    );
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|indexnow.txt|site.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|webmanifest)$).*)",
  ],
};
