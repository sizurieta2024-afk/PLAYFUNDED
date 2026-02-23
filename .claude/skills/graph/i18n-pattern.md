---
title: i18n Pattern
description: next-intl setup, es-419 as default language, locale routing, and the rule that no string is ever hardcoded.
related: [auth-geo, known-gotchas]
---

# i18n Pattern

PlayFunded is es-419 first. Every string visible to a user comes from `messages/es-419.json` or `messages/en.json` via `next-intl`. Zero exceptions. A hardcoded string in a component is a bug.

## Locale Routing
Using Next.js App Router with `src/app/[locale]/` structure. Supported locales: `['es-419', 'en']`. Default: `es-419`.

`src/i18n.ts` exports the next-intl config. `src/navigation.ts` wraps Next.js navigation hooks with locale awareness (`useRouter`, `usePathname`, `Link`, `redirect`).

The middleware has two jobs simultaneously: (1) Supabase session refresh and (2) next-intl locale detection and redirect. They must both run in the same middleware — do not split them.

## Translation File Convention
Keys are namespaced by domain:
```json
{
  "nav": { "challenges": "Desafíos", "leaderboard": "Tabla de líderes" },
  "auth": { "login": "Iniciar sesión", "signup": "Registrarse" },
  "challenge": { "phase1": "Fase 1", "profitTarget": "+20% objetivo" },
  "errors": { "stakeCap": "Apuesta excede el límite del 5%" }
}
```
Same key structure in both files. If a key exists in `es-419.json` it must exist in `en.json`.

## Language Toggle
`LanguageToggle` component calls `router.replace(pathname, { locale: newLocale })`. User preference is saved to `User.language` immediately so it persists across sessions — not just stored in a cookie.

## Date and Number Formatting
Use next-intl `useFormatter()` — never `toLocaleDateString()` directly.
- es-419: DD/MM/YYYY, period as thousands separator, comma as decimal (1.000,50)
- en: MM/DD/YYYY, comma as thousands separator, period as decimal (1,000.50)

## Key Details
- Email templates are also bilingual — detect `User.language` before sending via Resend
- Chatbot responses must be in the user's current language — pass it as context to [[provider-interfaces]] chatbot implementation
- Error messages (`{ error: string, code: string }`) — `code` is always English (for logging), `error` is i18n key resolved on client

## Gotchas
- `next-intl@4.x` targets Next.js 15. On Next.js 14, pin to `next-intl@3.x` if you see incompatibilities.
- Never use `useTranslations()` in a Server Component that also does data fetching — it adds unnecessary complexity. Use `getTranslations()` async version in Server Components.
