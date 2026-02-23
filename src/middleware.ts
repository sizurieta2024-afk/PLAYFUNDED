import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { isGeoBlocked } from '@/lib/geo'

const PROTECTED_PREFIXES = ['/dashboard', '/admin']
const WEBHOOK_PREFIX = '/api/webhooks'

// These paths are never geo-checked (avoid redirect loops and block auth)
const GEO_EXEMPT_PREFIXES = [
  '/auth/geo-blocked',
  '/api/webhooks',
  '/api/auth',
  '/_next',
]

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Webhooks bypass everything
  if (pathname.startsWith(WEBHOOK_PREFIX)) {
    return NextResponse.next()
  }

  let response = NextResponse.next({
    request: { headers: request.headers },
  })

  // ── Geo-block: only check public-facing pages ──────────────────────────
  const isGeoExempt =
    GEO_EXEMPT_PREFIXES.some((p) => pathname.startsWith(p)) ||
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/admin')

  if (!isGeoExempt) {
    const ip =
      request.headers.get('x-real-ip') ??
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      '127.0.0.1'

    const blocked = await isGeoBlocked(ip)
    if (blocked) {
      return NextResponse.redirect(new URL('/auth/geo-blocked', request.url))
    }
  }

  // ── Supabase session refresh ────────────────────────────────────────────
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({ name, value, ...options })
          response = NextResponse.next({
            request: { headers: request.headers },
          })
          response.cookies.set({ name, value, ...options })
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: '', ...options })
          response = NextResponse.next({
            request: { headers: request.headers },
          })
          response.cookies.set({ name, value: '', ...options })
        },
      },
    }
  )

  const {
    data: { session },
  } = await supabase.auth.getSession()

  const isProtected = PROTECTED_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix)
  )

  // Unauthenticated → protected route
  if (isProtected && !session) {
    const loginUrl = new URL('/auth/login', request.url)
    loginUrl.searchParams.set('redirectTo', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Admin route — server-side role check (never trust client)
  if (pathname.startsWith('/admin') && session) {
    const { data: user } = await supabase
      .from('User')
      .select('role')
      .eq('supabaseId', session.user.id)
      .single()

    if (!user || user.role !== 'admin') {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  // Authenticated user hitting auth pages → send to dashboard
  if (
    session &&
    (pathname.startsWith('/auth/login') || pathname.startsWith('/auth/signup'))
  ) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
