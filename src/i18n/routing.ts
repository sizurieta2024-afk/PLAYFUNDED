import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["es-419", "pt-BR", "en"],
  defaultLocale: "es-419",
  localePrefix: "as-needed", // default locale ("/") has no prefix; others are "/pt-BR/...", "/en/..."
});
