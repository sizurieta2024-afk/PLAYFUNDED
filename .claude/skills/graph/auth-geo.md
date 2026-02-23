---
title: Authentication & Geo-Block
description: Supabase Auth setup, Google OAuth, and the USA geo-block that must run on every non-authenticated page load.
related: [database-schema, security-model, known-gotchas]
---

# Authentication & Geo-Block

Authentication is handled by Supabase Auth (JWT sessions). The app supports three providers: Google OAuth (primary), Apple Sign-In (required for iOS), and email+password (fallback with verification).

## Supabase Auth Link
`User.supabaseId` is a nullable unique field in [[database-schema]] that links to Supabase's `auth.users.id`. On first login, a server action creates the Prisma `User` record and sets `supabaseId`. Subsequent logins look up the existing user by `supabaseId`.

Language detection on first login: read `navigator.language` → if it starts with `es` → set `User.language = es`, else `en`. Store immediately so the app renders in the right language from the first authenticated page.

## Middleware Flow
`src/middleware.ts` runs on every request. Order matters:
1. Webhook paths (`/api/webhooks/**`) — pass through immediately, no auth check
2. Refresh Supabase session via `createServerClient` from `@supabase/ssr` — this updates cookies
3. If protected route (`/dashboard`, `/admin`) and no session → redirect to `/auth/login?redirectTo=...`
4. If `/admin` and session exists → server-side role check via Supabase query
5. If auth page (`/auth/login`, `/auth/signup`) and session exists → redirect to `/dashboard`

## USA Geo-Block
On signup AND on every non-authenticated page load, check IP country via `ipapi.co/json`. If `country_code = "US"` → show full-page block component (bilingual). Never block users who are already logged in.

- Cache the geo result in the session for 1 hour to avoid hammering the API
- `src/lib/geo.ts` handles the fetch and caching
- The block is a full-page React component, not a middleware redirect — it renders on the client after the geo check resolves

## Key Details
- After login, country is captured from ipapi.co and stored in `User.country` (ISO 3166-1 alpha-2)
- Language auto-detection on first visit (no account): browser language → es-419 if Spanish, else en
- Self-excluded users: `User.selfExcludedUntil` is checked in middleware — redirect to exclusion page

## Gotchas
- ipapi.co free tier allows ~1,000 requests/day. At scale, upgrade to paid or switch provider
- The geo-block does NOT apply to existing logged-in US users — only signup and non-auth page loads
- Apple Sign-In requires an Apple Developer account ($99/year) and specific callback URL configuration
