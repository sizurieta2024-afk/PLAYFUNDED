'use client'

import { useLocale } from 'next-intl'
import { useRouter, usePathname } from '@/i18n/navigation'
import { Globe } from 'lucide-react'

export function LanguageToggle() {
  const locale = useLocale()
  const router = useRouter()
  const pathname = usePathname()

  const toggle = () => {
    const next = locale === 'es-419' ? 'en' : 'es-419'
    router.replace(pathname, { locale: next })
  }

  return (
    <button
      onClick={toggle}
      className="flex items-center gap-1.5 px-2.5 h-9 rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-secondary text-xs font-medium transition-colors"
      aria-label="Switch language"
    >
      <Globe className="w-3.5 h-3.5" />
      <span>{locale === 'es-419' ? 'ES' : 'EN'}</span>
    </button>
  )
}
