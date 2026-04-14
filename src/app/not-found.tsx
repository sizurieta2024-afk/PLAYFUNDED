import Link from "next/link";

export default function NotFound() {
  return (
    <html className="dark">
      <body className="bg-[#0a0a0a] text-white">
        <div className="flex min-h-screen items-center justify-center p-6">
          <div className="w-full max-w-md text-center">
            <p className="mb-2 text-6xl font-bold text-[#c9a84c]">404</p>
            <h1 className="mb-2 text-xl font-semibold">Pagina no encontrada</h1>
            <p className="mb-1 text-sm text-neutral-400">
              La pagina que buscas no existe o fue movida.
            </p>
            <p className="mb-8 text-sm text-neutral-500">
              The page you are looking for does not exist or has been moved.
            </p>
            <Link
              href="/"
              className="inline-block rounded-lg bg-[#c9a84c] px-6 py-2.5 text-sm font-medium text-black transition-colors hover:bg-[#f0dfa6]"
            >
              Volver al inicio / Go home
            </Link>
          </div>
        </div>
      </body>
    </html>
  );
}
