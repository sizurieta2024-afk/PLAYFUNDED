'use client'

import { useFormState, useFormStatus } from 'react-dom'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { useRouter } from '@/i18n/navigation'
import { useEffect } from 'react'
import { signUpWithEmail } from '@/app/actions/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 0 0 2.38-5.88c0-.57-.05-.66-.15-1.18z" />
      <path fill="#34A853" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2a4.8 4.8 0 0 1-7.18-2.54H1.83v2.07A8 8 0 0 0 8.98 17z" />
      <path fill="#FBBC05" d="M4.5 10.52a4.8 4.8 0 0 1 0-3.04V5.41H1.83a8 8 0 0 0 0 7.18l2.67-2.07z" />
      <path fill="#EA4335" d="M8.98 4.18c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 0 0 1.83 5.4L4.5 7.49a4.77 4.77 0 0 1 4.48-3.3z" />
    </svg>
  )
}

function SubmitButton() {
  const { pending } = useFormStatus()
  const t = useTranslations('auth.signup')
  return (
    <Button
      type="submit"
      disabled={pending}
      className="w-full bg-pf-brand hover:bg-pf-brand-dark text-white font-semibold"
    >
      {pending ? t('submitLoading') : t('submitButton')}
    </Button>
  )
}

export default function SignupPage() {
  const t = useTranslations('auth.signup')
  const [state, action] = useFormState(signUpWithEmail, null)
  const router = useRouter()

  useEffect(() => {
    if (state?.success) {
      router.push('/auth/verify')
    }
  }, [state, router])

  return (
    <div className="flex min-h-[80vh] items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">

        {/* Logo */}
        <div className="text-center space-y-1">
          <h1 className="text-3xl font-bold text-foreground tracking-tight">
            {t('title')}
          </h1>
          <p className="text-muted-foreground text-sm">{t('subtitle')}</p>
        </div>

        {/* Google sign-up */}
        <a
          href="/api/auth/google"
          className="flex items-center justify-center gap-3 w-full px-4 py-2.5 rounded-md border border-border bg-secondary text-foreground text-sm font-medium hover:bg-secondary/80 transition-colors"
        >
          <GoogleIcon />
          {t('googleButton')}
        </a>

        {/* Divider */}
        <div className="relative flex items-center gap-3">
          <div className="flex-1 border-t border-border" />
          <span className="text-muted-foreground text-xs">{t('orEmail')}</span>
          <div className="flex-1 border-t border-border" />
        </div>

        {/* Form */}
        <form action={action} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name" className="text-foreground text-sm">
              {t('nameLabel')}{' '}
              <span className="text-muted-foreground">{t('nameOptional')}</span>
            </Label>
            <Input
              id="name"
              name="name"
              type="text"
              autoComplete="name"
              placeholder={t('namePlaceholder')}
              className="focus-visible:ring-pf-brand"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-foreground text-sm">
              {t('emailLabel')}
            </Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder={t('emailPlaceholder')}
              className="focus-visible:ring-pf-brand"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-foreground text-sm">
              {t('passwordLabel')}
            </Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              placeholder={t('passwordPlaceholder')}
              className="focus-visible:ring-pf-brand"
            />
          </div>

          {state?.error && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
              <p className="text-destructive text-sm">{state.error}</p>
            </div>
          )}

          <SubmitButton />

          <p className="text-center text-xs text-muted-foreground">
            {t('terms')}{' '}
            <Link href="/legal" className="text-muted-foreground hover:text-foreground underline">
              {t('termsLink')}
            </Link>
          </p>
        </form>

        {/* Sign in link */}
        <p className="text-center text-sm text-muted-foreground">
          {t('haveAccount')}{' '}
          <Link
            href="/auth/login"
            className="text-pf-brand hover:text-pf-brand-dark font-medium transition-colors"
          >
            {t('loginLink')}
          </Link>
        </p>
      </div>
    </div>
  )
}
