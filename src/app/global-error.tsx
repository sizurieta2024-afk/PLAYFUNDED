"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

export default function GlobalError({
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
    <html>
      <body className="bg-background text-foreground">
        <div className="flex min-h-screen items-center justify-center p-6">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
              <span className="text-xl font-bold text-destructive">!</span>
            </div>
            <h1 className="mb-2 text-xl font-semibold">
              Algo salio mal / Something went wrong
            </h1>
            <p className="mb-1 text-sm text-muted-foreground">
              Ocurrio un error inesperado. Se ha reportado automaticamente.
            </p>
            <p className="mb-6 text-xs text-muted-foreground">
              An unexpected error occurred. It has been reported automatically.
            </p>
            <button
              onClick={reset}
              className="rounded-lg bg-pf-pink px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-pf-pink-dark"
            >
              Intentar de nuevo / Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
