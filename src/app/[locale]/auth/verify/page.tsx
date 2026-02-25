import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'

export default function VerifyPage() {
  const t = useTranslations('auth.verify')

  return (
    <div className="flex min-h-[80vh] items-center justify-center p-4">
      <div className="text-center space-y-6 max-w-sm">
        <div className="text-5xl">📧</div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-foreground">{t('title')}</h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            {t('description')}
          </p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4 text-left space-y-2">
          <p className="text-sm font-medium text-foreground">{t('noEmail')}</p>
          <ul className="space-y-1">
            {[t('checkSpam'), t('checkEmail'), t('waitRetry')].map((item) => (
              <li key={item} className="text-sm text-muted-foreground flex items-start gap-2">
                <span className="text-pf-brand mt-0.5">•</span>
                {item}
              </li>
            ))}
          </ul>
        </div>
        <Link
          href="/auth/login"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          {t('backToLogin')}
        </Link>
      </div>
    </div>
  )
}
