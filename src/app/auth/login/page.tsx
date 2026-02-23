'use client'

import { useFormState, useFormStatus } from 'react-dom'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { signInWithEmail } from '@/app/actions/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Suspense } from 'react'

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button
      type="submit"
      disabled={pending}
      className="w-full bg-[#2d6a4f] hover:bg-[#1e4d38] text-white font-medium"
    >
      {pending ? 'Iniciando sesión...' : 'Iniciar sesión'}
    </Button>
  )
}

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

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="bg-red-500/10 border border-red-500/20 rounded-md px-3 py-2">
      <p className="text-red-400 text-sm">{message}</p>
    </div>
  )
}

function LoginForm() {
  const [state, action] = useFormState(signInWithEmail, null)
  const searchParams = useSearchParams()
  const oauthError = searchParams.get('error')

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        {/* Logo */}
        <div className="text-center space-y-1">
          <h1 className="text-3xl font-bold text-white tracking-tight">
            PlayFunded
          </h1>
          <p className="text-gray-500 text-sm">La plataforma de trading deportivo</p>
        </div>

        {/* OAuth error */}
        {oauthError && (
          <ErrorBanner message="Error al iniciar sesión con Google. Inténtalo de nuevo." />
        )}

        {/* Google sign-in */}
        <a
          href="/api/auth/google"
          className="flex items-center justify-center gap-3 w-full px-4 py-2.5 rounded-md border border-white/10 bg-white/5 text-white text-sm font-medium hover:bg-white/10 transition-colors"
        >
          <GoogleIcon />
          Continuar con Google
        </a>

        {/* Divider */}
        <div className="relative flex items-center gap-3">
          <div className="flex-1 border-t border-white/10" />
          <span className="text-gray-600 text-xs">o con email</span>
          <div className="flex-1 border-t border-white/10" />
        </div>

        {/* Email/password form */}
        <form action={action} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-gray-300 text-sm">
              Email
            </Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="tu@email.com"
              className="bg-white/5 border-white/10 text-white placeholder:text-gray-600 focus-visible:ring-[#2d6a4f]"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-gray-300 text-sm">
              Contraseña
            </Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              placeholder="••••••••"
              className="bg-white/5 border-white/10 text-white placeholder:text-gray-600 focus-visible:ring-[#2d6a4f]"
            />
          </div>

          {state?.error && <ErrorBanner message={state.error} />}

          <SubmitButton />
        </form>

        {/* Sign up link */}
        <p className="text-center text-sm text-gray-500">
          ¿No tienes cuenta?{' '}
          <Link
            href="/auth/signup"
            className="text-[#2d6a4f] hover:text-[#3d8a6f] font-medium transition-colors"
          >
            Regístrate gratis
          </Link>
        </p>
      </div>
    </div>
  )
}

// Wrap in Suspense because useSearchParams requires it
export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0a0a0f]" />}>
      <LoginForm />
    </Suspense>
  )
}
