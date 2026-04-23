import { notFound } from "next/navigation";
import { getMessages, getTranslations } from "next-intl/server";
import { hasLocale } from "next-intl";
import { routing } from "@/i18n/routing";
import { Providers } from "@/providers/providers";
import type { Metadata } from "next";
import { organizationSchema } from "@/lib/schema";

const BASE_URL = "https://playfunded.lat";
const GOOGLE_SITE_VERIFICATION = process.env.GOOGLE_SITE_VERIFICATION;
const BING_SITE_VERIFICATION = process.env.BING_SITE_VERIFICATION;

const LOCALE_PREFIX: Record<string, string> = {
  "es-419": "",
  "pt-BR": "/pt-BR",
  en: "/en",
};

const LOCALE_OG: Record<string, string> = {
  "es-419": "es_LA",
  "pt-BR": "pt_BR",
  en: "en_US",
};

interface LocaleLayoutProps {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "home" });
  const prefix = LOCALE_PREFIX[locale] ?? "";

  return {
    metadataBase: new URL(BASE_URL),
    title: {
      template: "%s | PlayFunded",
      default: t("meta_title"),
    },
    description: t("meta_description"),
    keywords: [
      "prop trading deportivo",
      "cuenta financiada deportes",
      "challenge trading latam",
      "funded trader latinoamerica",
      "prop firm deportes",
      "trading deportivo mexico",
      "trading deportivo brasil",
      "sports prop trading",
      "funded account sports",
      "PlayFunded",
    ],
    alternates: {
      canonical: `${BASE_URL}${prefix}`,
      languages: {
        es: `${BASE_URL}`,
        "pt-BR": `${BASE_URL}/pt-BR`,
        en: `${BASE_URL}/en`,
        "x-default": `${BASE_URL}`,
      },
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-snippet": -1,
        "max-image-preview": "large",
        "max-video-preview": -1,
      },
    },
    openGraph: {
      siteName: "PlayFunded",
      type: "website",
      locale: LOCALE_OG[locale] ?? "es_LA",
      images: [
        {
          url: "/opengraph-image",
          width: 1200,
          height: 630,
          alt: "PlayFunded",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      site: "@playfunded",
      images: ["/opengraph-image"],
    },
    icons: {
      icon: [
        { url: "/favicon.ico" },
        { url: "/favicon.png", type: "image/png" },
      ],
      apple: [{ url: "/apple-touch-icon.png" }],
    },
    verification: {
      ...(GOOGLE_SITE_VERIFICATION ? { google: GOOGLE_SITE_VERIFICATION } : {}),
      ...(BING_SITE_VERIFICATION
        ? {
            other: {
              "msvalidate.01": BING_SITE_VERIFICATION,
            },
          }
        : {}),
    },
  };
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
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(organizationSchema()),
        }}
      />
      <Providers locale={locale} messages={messages}>
        {children}
      </Providers>
    </>
  );
}
