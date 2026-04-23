import { createNavigation } from 'next-intl/navigation'
import { routing } from './routing'

export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing)

export const DEFAULT_LOCALE = routing.defaultLocale

export function normalizeLocale(value?: string | null): string {
  return value && routing.locales.includes(value as (typeof routing.locales)[number])
    ? value
    : DEFAULT_LOCALE
}

export function inferLocaleFromPath(pathname: string): string {
  const match = pathname.match(/^\/(es-419|pt-BR|en)(?=\/|$)/)
  return normalizeLocale(match?.[1])
}

export function stripLocalePrefix(pathname: string): string {
  const stripped = pathname.replace(/^\/(es-419|pt-BR|en)(?=\/|$)/, '')
  return stripped || '/'
}

export function buildLocalePath(locale: string, pathname: string): string {
  const normalizedLocale = normalizeLocale(locale)
  const normalizedPath = pathname.startsWith('/') ? pathname : `/${pathname}`

  if (normalizedPath === '/') {
    return normalizedLocale === DEFAULT_LOCALE ? '/' : `/${normalizedLocale}`
  }

  return normalizedLocale === DEFAULT_LOCALE
    ? normalizedPath
    : `/${normalizedLocale}${normalizedPath}`
}

export function buildDashboardPath(locale: string): string {
  return buildLocalePath(locale, '/dashboard')
}

export function buildAuthPath(locale: string, pathname: string): string {
  return buildLocalePath(locale, pathname)
}

export function buildLoginPath(locale: string): string {
  return buildAuthPath(locale, '/auth/login')
}
