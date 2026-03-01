import { notFound } from "next/navigation";
import { getMessages } from "next-intl/server";
import { hasLocale } from "next-intl";
import { routing } from "@/i18n/routing";
import { Providers } from "@/providers/providers";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    template: "%s | PlayFunded",
    default: "PlayFunded — Nuestro riesgo, tus ganancias",
  },
  description:
    "La plataforma de trading deportivo para América Latina. Demuestra tu talento y obtén una cuenta financiada.",
};

interface LocaleLayoutProps {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}

export default async function LocaleLayout({
  children,
  params,
}: LocaleLayoutProps) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  const messages = await getMessages();

  return (
    <Providers locale={locale} messages={messages}>
      {children}
    </Providers>
  );
}
