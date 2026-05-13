import type { Metadata } from "next";

export const BASE_URL = "https://playfunded.lat";

const LOCALE_PREFIX: Record<string, string> = {
  "es-419": "",
  "pt-BR": "/pt-BR",
  en: "/en",
};

const DEFAULT_SOCIAL_IMAGE = {
  url: `${BASE_URL}/opengraph-image`,
  width: 1200,
  height: 630,
  alt: "PlayFunded",
};

export function getLocalizedUrl(locale: string, path = "/"): string {
  const prefix = LOCALE_PREFIX[locale] ?? "";
  const normalizedPath = path === "/" ? "" : path.startsWith("/") ? path : `/${path}`;
  return `${BASE_URL}${prefix}${normalizedPath}`;
}

export function getLocalizedAlternates(path = "/") {
  const normalizedPath = path === "/" ? "" : path.startsWith("/") ? path : `/${path}`;
  return {
    es: `${BASE_URL}${normalizedPath}`,
    "pt-BR": `${BASE_URL}/pt-BR${normalizedPath}`,
    en: `${BASE_URL}/en${normalizedPath}`,
    "x-default": `${BASE_URL}${normalizedPath}`,
  };
}

function stripBrandSuffix(value: string): string {
  return value.replace(/\s+\|\s+PlayFunded$/, "");
}

function normalizeTitle(title: Metadata["title"]): Metadata["title"] {
  return typeof title === "string" ? stripBrandSuffix(title) : title;
}

interface BrandMetadataOptions {
  locale?: string;
  path?: string;
}

export function withBrandMetadata(
  metadata: Metadata,
  options: BrandMetadataOptions = {},
): Metadata {
  const openGraph = metadata.openGraph as Record<string, unknown> | undefined;
  const twitter = metadata.twitter as Record<string, unknown> | undefined;
  const canonicalUrl =
    options.locale && options.path
      ? getLocalizedUrl(options.locale, options.path)
      : undefined;
  const alternates =
    options.path && canonicalUrl
      ? {
          ...metadata.alternates,
          canonical: canonicalUrl,
          languages: getLocalizedAlternates(options.path),
        }
      : metadata.alternates;

  return {
    ...metadata,
    title: normalizeTitle(metadata.title),
    alternates,
    openGraph: {
      ...openGraph,
      title:
        typeof openGraph?.title === "string"
          ? stripBrandSuffix(openGraph.title)
          : openGraph?.title,
      url: canonicalUrl ?? openGraph?.url,
      images: openGraph?.images ?? [DEFAULT_SOCIAL_IMAGE],
    } as Metadata["openGraph"],
    twitter: {
      card: "summary_large_image",
      ...twitter,
      title:
        typeof twitter?.title === "string"
          ? stripBrandSuffix(twitter.title)
          : twitter?.title,
      images: twitter?.images ?? [`${BASE_URL}/opengraph-image`],
    } as Metadata["twitter"],
  };
}
