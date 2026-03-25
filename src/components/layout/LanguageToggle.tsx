'use client'

import { useState, useRef, useEffect } from 'react'
import { useLocale } from 'next-intl'
import { Globe, ChevronDown } from 'lucide-react'

const LOCALES = [
  { code: 'es-419', label: 'ES', name: 'Español' },
  { code: 'pt-BR', label: 'PT', name: 'Português' },
  { code: 'en', label: 'EN', name: 'English' },
] as const

export function LanguageToggle() {
  const locale = useLocale()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const current = LOCALES.find((l) => l.code === locale) ?? LOCALES[0]

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function stripLocalePrefix(pathname: string) {
    const stripped = pathname.replace(/^\/(es-419|pt-BR|en)(?=\/|$)/, '')
    return stripped || '/'
  }

  function buildLocalizedPath(pathname: string, code: string) {
    const pathWithoutLocale = stripLocalePrefix(pathname)
    const prefix = code === 'es-419' ? '' : `/${code}`
    if (pathWithoutLocale === '/') {
      return prefix || '/'
    }
    return `${prefix}${pathWithoutLocale}`
  }

  function select(code: string) {
    setOpen(false)
    if (typeof window === 'undefined') return

    const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`
    const nextPath = buildLocalizedPath(window.location.pathname, code)
    const nextUrl = `${nextPath}${window.location.search}${window.location.hash}`

    document.cookie = `NEXT_LOCALE=${encodeURIComponent(code)}; path=/; max-age=31536000; samesite=lax`

    if (nextUrl !== currentUrl) {
      window.location.assign(nextUrl)
      return
    }

    window.location.reload()
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 px-2.5 h-9 rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-secondary text-xs font-medium transition-colors"
        aria-label="Switch language"
      >
        <Globe className="w-3.5 h-3.5" />
        <span>{current.label}</span>
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 min-w-[120px] rounded-md border border-border bg-popover shadow-md z-50 overflow-hidden">
          {LOCALES.map((l) => (
            <button
              key={l.code}
              onClick={() => select(l.code)}
              className={`flex items-center gap-2 w-full px-3 py-2 text-xs transition-colors text-left ${
                l.code === locale
                  ? 'bg-pf-brand/10 text-pf-brand font-semibold'
                  : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
              }`}
            >
              <span className="font-bold w-5">{l.label}</span>
              <span>{l.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
