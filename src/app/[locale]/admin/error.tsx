"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center">
        <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
          <span className="text-destructive text-xl font-bold">!</span>
        </div>
        <h2 className="text-xl font-semibold text-foreground mb-2">
          Error en el panel de admin
        </h2>
        <p className="text-muted-foreground text-sm mb-6">
          Ocurrio un error inesperado. Se ha reportado automaticamente.
        </p>
        <button
          onClick={reset}
          className="bg-pf-pink hover:bg-pf-pink-dark text-white text-sm font-medium px-6 py-2.5 rounded-lg transition-colors"
        >
          Intentar de nuevo
        </button>
      </div>
    </div>
  );
}
