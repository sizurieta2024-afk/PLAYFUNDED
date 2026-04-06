"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import * as Sentry from "@sentry/nextjs";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("dashboard");

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
          {t("errorTitle")}
        </h2>
        <p className="text-muted-foreground text-sm mb-6">{t("errorBody")}</p>
        <button
          onClick={reset}
          className="bg-pf-pink hover:bg-pf-pink-dark text-white text-sm font-medium px-6 py-2.5 rounded-lg transition-colors"
        >
          {t("errorRetry")}
        </button>
      </div>
    </div>
  );
}
