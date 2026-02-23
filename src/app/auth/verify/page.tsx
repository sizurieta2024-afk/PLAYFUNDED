import Link from 'next/link'

export const metadata = {
  title: 'Verifica tu email | PlayFunded',
}

export default function VerifyPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-4">
      <div className="w-full max-w-sm text-center space-y-6">
        <div className="text-5xl">📧</div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-white">Revisa tu email</h1>
          <p className="text-gray-400 text-sm">
            Te enviamos un enlace de confirmación. Haz clic en él para activar
            tu cuenta y comenzar.
          </p>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-lg p-4 text-left space-y-2">
          <p className="text-gray-300 text-sm font-medium">¿No recibiste el email?</p>
          <ul className="text-gray-500 text-xs space-y-1 list-disc list-inside">
            <li>Revisa tu carpeta de spam o correo no deseado</li>
            <li>Verifica que el email sea correcto</li>
            <li>Espera unos minutos y vuelve a intentar</li>
          </ul>
        </div>

        <Link
          href="/auth/login"
          className="block text-sm text-[#2d6a4f] hover:text-[#3d8a6f] transition-colors"
        >
          ← Volver al inicio de sesión
        </Link>
      </div>
    </div>
  )
}
