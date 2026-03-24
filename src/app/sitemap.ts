import type { MetadataRoute } from "next";

const BASE_URL = "https://playfunded.lat";

type ChangeFrequency =
  | "always"
  | "hourly"
  | "daily"
  | "weekly"
  | "monthly"
  | "yearly"
  | "never";

const PUBLIC_ROUTES: {
  path: string;
  priority: number;
  changeFrequency: ChangeFrequency;
}[] = [
  { path: "", priority: 1.0, changeFrequency: "weekly" },
  { path: "/challenges", priority: 0.9, changeFrequency: "weekly" },
  { path: "/how-it-works", priority: 0.8, changeFrequency: "monthly" },
  { path: "/faq", priority: 0.8, changeFrequency: "monthly" },
  { path: "/leaderboard", priority: 0.6, changeFrequency: "daily" },
  { path: "/contact", priority: 0.5, changeFrequency: "monthly" },
  { path: "/affiliate", priority: 0.6, changeFrequency: "monthly" },
  { path: "/legal", priority: 0.3, changeFrequency: "yearly" },
];

const LOCALE_PREFIXES: Record<string, string> = {
  "es-419": "",
  "pt-BR": "/pt-BR",
  en: "/en",
};

export default function sitemap(): MetadataRoute.Sitemap {
  const entries: MetadataRoute.Sitemap = [];

  for (const route of PUBLIC_ROUTES) {
    for (const [locale, prefix] of Object.entries(LOCALE_PREFIXES)) {
      entries.push({
        url: `${BASE_URL}${prefix}${route.path}`,
        lastModified: new Date(),
        changeFrequency: route.changeFrequency,
        priority: route.priority * (locale === "es-419" ? 1 : 0.9),
        alternates: {
          languages: {
            es: `${BASE_URL}${route.path}`,
            "pt-BR": `${BASE_URL}/pt-BR${route.path}`,
            en: `${BASE_URL}/en${route.path}`,
            "x-default": `${BASE_URL}${route.path}`,
          },
        },
      });
    }
  }

  return entries;
}
