import { useTranslations } from 'next-intl'

export default function HomePage() {
  const t = useTranslations('nav')

  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4">
      <div className="text-center space-y-4 max-w-md">
        <h1 className="text-4xl font-bold text-foreground tracking-tight">
          {t('brand')}
        </h1>
        <p className="text-lg text-pf-brand font-semibold">{t('slogan')}</p>
        <p className="text-muted-foreground text-sm">
          Landing page — Session 17
        </p>
      </div>
    </div>
  )
}
