import { createServerClient } from '@/lib/supabase'
import { redirect } from 'next/navigation'
import { signOut } from '@/app/actions/auth'

export default async function DashboardPage() {
  const supabase = createServerClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    redirect('/auth/login')
  }

  return (
    <div className="flex min-h-[80vh] items-center justify-center p-4">
      <div className="text-center space-y-6 max-w-sm">
        <h1 className="text-3xl font-bold text-foreground">PlayFunded</h1>
        <p className="text-pf-brand font-medium">✅ Sesión iniciada correctamente</p>
        <p className="text-muted-foreground text-sm">
          Bienvenido,{' '}
          <span className="text-foreground font-medium">
            {session.user.user_metadata?.full_name ??
              session.user.user_metadata?.name ??
              session.user.email}
          </span>
        </p>
        <p className="text-muted-foreground/60 text-xs">
          Dashboard completo en construcción (Session 10)
        </p>
        <form action={signOut}>
          <button
            type="submit"
            className="text-sm text-muted-foreground hover:text-foreground underline transition-colors"
          >
            Cerrar sesión
          </button>
        </form>
      </div>
    </div>
  )
}
