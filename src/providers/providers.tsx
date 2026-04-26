"use client";

import { Suspense } from "react";
import { ThemeProvider } from "next-themes";
import { NextIntlClientProvider, type AbstractIntlMessages } from "next-intl";
import { PostHogAnalytics } from "@/components/analytics/PostHogAnalytics";

interface ProvidersProps {
  children: React.ReactNode;
  locale: string;
  messages: AbstractIntlMessages;
}

export function Providers({ children, locale, messages }: ProvidersProps) {
  return (
    <NextIntlClientProvider locale={locale} messages={messages} timeZone="UTC">
      <ThemeProvider
        attribute="class"
        defaultTheme="dark"
        disableTransitionOnChange
      >
        <Suspense fallback={null}>
          <PostHogAnalytics />
        </Suspense>
        {children}
      </ThemeProvider>
    </NextIntlClientProvider>
  );
}
