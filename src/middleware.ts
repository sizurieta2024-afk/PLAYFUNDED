import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import createIntlMiddleware from "next-intl/middleware";
import { isGeoBlocked } from "@/lib/geo";
import { routing } from "@/i18n/routing";

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

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

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
  if (pathname === "/auth/callback") {
    return NextResponse.next();
  }

  // ── 3. Geo-block: only check public-facing pages ─────────────────────
  // Strip locale prefix for exempt check (e.g. /en/auth/geo-blocked → /auth/geo-blocked)
  const pathnameWithoutLocale = pathname.replace(/^\/(es-419|en)/, "") || "/";
  const isGeoExempt = GEO_EXEMPT_PREFIXES.some(
    (p) => pathnameWithoutLocale.startsWith(p) || pathname.startsWith(p),
  );

  if (!isGeoExempt) {
    const ip =
      request.headers.get("x-real-ip") ??
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      "127.0.0.1";

    const blocked = await isGeoBlocked(ip);
    if (blocked) {
      return NextResponse.redirect(new URL("/auth/geo-blocked", request.url));
    }
  }

  // ── 4. Run next-intl middleware (locale detection + routing) ──────────
  const intlResponse = intlMiddleware(request);

  // If intl wants to redirect (e.g. normalise locale prefix), honour it
  if (
    intlResponse.status === 307 ||
    intlResponse.status === 302 ||
    intlResponse.status === 308
  ) {
    return intlResponse;
  }

  // ── 5. Supabase session refresh ───────────────────────────────────────
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
    data: { session },
  } = await supabase.auth.getSession();

  // Normalise path (strip locale prefix) for protected-route checks
  const cleanPath = pathnameWithoutLocale || pathname;
  const isProtected = PROTECTED_PREFIXES.some((prefix) =>
    cleanPath.startsWith(prefix),
  );

  // ── 6. Unauthenticated → protected route ─────────────────────────────
  if (isProtected && !session) {
    const loginUrl = new URL("/auth/login", request.url);
    loginUrl.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // ── 7. Admin route — server-side role check ───────────────────────────
  if (cleanPath.startsWith("/admin") && session) {
    const { data: user } = await supabase
      .from("User")
      .select("role")
      .eq("supabaseId", session.user.id)
      .single();

    if (!user || user.role !== "admin") {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }

  // ── 8. Authenticated user hitting auth pages → redirect to dashboard ──
  if (
    session &&
    (cleanPath.startsWith("/auth/login") ||
      cleanPath.startsWith("/auth/signup"))
  ) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
