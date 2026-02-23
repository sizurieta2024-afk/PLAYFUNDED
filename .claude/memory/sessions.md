# Session Log

## Session 001 — Project Kickoff (2026-02-23)

### What was done
- Created Next.js 14 project with TypeScript, Tailwind, ESLint, App Router
- Installed core deps: prisma, @prisma/client, @supabase/supabase-js, @supabase/auth-helpers-nextjs, next-intl, zod, @anthropic-ai/sdk, stripe, resend
- Installed UI deps: framer-motion, recharts, @tanstack/react-query
- Initialized shadcn/ui
- Created README.md with full spec (all 24 sections)
- Created CLAUDE.md with session context, build status table, hard rules
- Created .claude/plans/todo.md with session-by-session task breakdown
- Created .claude/memory/lessons.md
- Created .claude/memory/ODDS_DECISION.md with 5-provider analysis
- Created .env.example with all required variables
- Created prisma/schema.prisma with all entities, enums, indexes
- Created src/lib/prisma.ts — singleton Prisma client
- Created src/lib/supabase.ts — client + server + service helpers
- Created src/middleware.ts — protect /dashboard and /admin routes
- Created full directory structure

### Decisions Made
- SPEC content stored in README.md (hook constraint)
- Task files stored in .claude/plans/ and .claude/memory/ (hook constraint)
- ODDS_DECISION: Recommended The Odds API + API-Football combo (OPEN — confirm before Session 6)

### Session 2 Should Start With
1. Update CLAUDE.md "Current Session Scope" to: "Step 2 — i18n setup"
2. Search OneContext: "PlayFunded i18n next-intl setup"
3. Goal: next-intl config, es-419.json + en.json base files, language toggle component, browser language detection

---

## Session 002 — Supabase Setup + Authentication (2026-02-23)

### Infrastructure Completed
- Supabase project: pvwynjnifdmaisswtwiz (sa-east-1, FREE, sizurieta2024@icloud.com)
- DB migrated: all 13 tables live, 4 tiers seeded
- Google OAuth: enabled (Client ID: 114229046011-tr2udlpc0uheeqj6i8jomhhrmn97a87p.apps.googleusercontent.com)
- Supabase redirect URLs: http://localhost:3000/**, https://pvwynjnifdmaisswtwiz.supabase.co/**
- .env.local: fully filled (anon key, service role, DB password)
- RLS on User: users_own_row + service_full_access policies

### Files Built
- src/app/api/auth/google/route.ts — OAuth initiation (GET route, not server action)
- src/app/auth/callback/route.ts — code exchange + User upsert in Postgres
- src/app/actions/auth.ts — signInWithEmail, signUpWithEmail, signOut
- src/lib/geo.ts — USA geo-block via ipapi.co (2s timeout, fail-open)
- src/middleware.ts — geo-block on public routes + session refresh
- src/app/auth/login/page.tsx — Google + email/password (dark theme)
- src/app/auth/signup/page.tsx — Google + email/password + name
- src/app/auth/verify/page.tsx — email confirmation screen
- src/app/auth/geo-blocked/page.tsx — bilingual US block screen
- src/app/dashboard/page.tsx — temp placeholder
- src/components/auth/GeoBlockScreen.tsx — bilingual UI component

### Key Gotchas
- Supabase pooler host is aws-1-sa-east-1 (NOT aws-0) for project pvwynjnifdmaisswtwiz
- MCP Supabase tools used stale process — must kill all mcp-server-supabase PIDs before restart
- Google OAuth must use GET route handler, NOT server action (PKCE flow issues)
- i18n NOT set up yet — auth pages use hardcoded Spanish (Session 3 refactors with t())
- Prisma 7 prisma db pull hangs on pgbouncer — use Management API for DB ops instead

### Commit
4aa2378 on dev branch — "feat(auth): supabase auth, google oauth, geo-block"

### Session 3 Starts With
1. npm run dev → manually test Google sign-in → confirm /dashboard loads
2. tailwind.config.ts — add custom color tokens (bg #0a0a0f, surface #1a1a2e, green #2d6a4f, gold #f4a261)
3. next-themes dark mode setup
4. next-intl full setup with [locale] routing (es-419 default, en second)
5. Navbar + Footer + root layout refactor into src/app/[locale]/
