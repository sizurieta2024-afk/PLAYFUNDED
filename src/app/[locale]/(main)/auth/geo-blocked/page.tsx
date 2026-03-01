import { useTranslations } from 'next-intl'

export default function GeoBlockedPage() {
  const t = useTranslations('auth.geoBlocked')

  return (
    <div className="flex min-h-[80vh] items-center justify-center p-4">
      <div className="text-center space-y-6 max-w-md">
        <div className="text-5xl">🚫</div>

        {/* Spanish */}
        <div className="space-y-2">
          <h1 className="text-xl font-bold text-foreground">{t('title')}</h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            {t('description')}
          </p>
        </div>

        {/* Divider */}
        <div className="border-t border-border" />

        {/* English */}
        <div className="space-y-2">
          <h2 className="text-lg font-semibold text-foreground">{t('titleEn')}</h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            {t('descriptionEn')}
          </p>
        </div>

        <p className="text-xs text-muted-foreground/60 font-mono">{t('errorCode')}</p>
      </div>
    </div>
  )
}
