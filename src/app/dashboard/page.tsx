import { createServerClient } from '@/lib/supabase'
import { redirect } from 'next/navigation'
import { signOut } from '@/app/actions/auth'

export default async function DashboardPage() {
  const supabase = await createServerClient()
  const {
    data: { user: authUser },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !authUser) {
    redirect('/auth/login')
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-4">
      <div className="text-center space-y-6 max-w-sm">
        <h1 className="text-3xl font-bold text-white">PlayFunded</h1>
        <p className="text-[#2d6a4f] font-medium">
          ✅ Sesión iniciada correctamente
        </p>
        <p className="text-gray-400 text-sm">
          Bienvenido,{' '}
          <span className="text-white">
            {authUser.user_metadata?.full_name ??
              authUser.user_metadata?.name ??
              authUser.email}
          </span>
        </p>
        <p className="text-gray-600 text-xs">
          Dashboard completo en construcción (Session 10)
        </p>
        <form action={signOut}>
          <button
            type="submit"
            className="text-sm text-gray-500 hover:text-gray-300 underline transition-colors"
          >
            Cerrar sesión
          </button>
        </form>
      </div>
    </div>
  )
}
