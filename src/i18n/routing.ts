import { defineRouting } from 'next-intl/routing'

export const routing = defineRouting({
  locales: ['es-419', 'en'],
  defaultLocale: 'es-419',
  localePrefix: 'as-needed', // default locale ("/") has no prefix; English is "/en/..."
})
