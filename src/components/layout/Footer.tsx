"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { LanguageToggle } from "./LanguageToggle";
import { TrendingUp } from "lucide-react";

export function Footer() {
  const t = useTranslations("footer");
  const tn = useTranslations("nav");
  const year = new Date().getFullYear();

  const columns = [
    {
      heading: t("product"),
      links: [
        { label: t("challenges"), href: "/challenges" as const },
        { label: t("howItWorks"), href: "/how-it-works" as const },
        { label: t("leaderboard"), href: "/leaderboard" as const },
        { label: t("faq"), href: "/faq" as const },
      ],
    },
    {
      heading: t("legal"),
      links: [
        { label: t("terms"), href: "/legal" as const },
        { label: t("privacy"), href: "/legal" as const },
        { label: t("responsibleGambling"), href: "/legal" as const },
      ],
    },
    {
      heading: t("support"),
      links: [
        { label: t("contact"), href: "/contact" as const },
        { label: t("affiliate"), href: "/affiliate" as const },
      ],
    },
  ] as const;

  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* ── Main footer content ───────────────────────────────── */}
        <div className="py-12 grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {/* Brand column */}
          <div className="space-y-4">
            <Link href="/" className="flex items-center gap-2 group w-fit">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-pf-brand/10 group-hover:bg-pf-brand/20 transition-colors">
                <TrendingUp
                  className="w-4 h-4 text-pf-brand"
                  strokeWidth={2.5}
                />
              </div>
              <span className="text-base font-bold tracking-tight text-foreground">
                {tn("brand")}
              </span>
            </Link>
            <p className="text-sm font-medium text-pf-brand leading-snug">
              {t("slogan")}
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {t("tagline")}
            </p>
            <div className="pt-1">
              <LanguageToggle />
            </div>
          </div>

          {/* Link columns */}
          {columns.map((col) => (
            <div key={col.heading} className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground tracking-wide uppercase">
                {col.heading}
              </h3>
              <ul className="space-y-2.5">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* ── Disclaimer + copyright ────────────────────────────── */}
        <div className="border-t border-border py-6 space-y-3">
          <p className="text-xs text-muted-foreground leading-relaxed max-w-3xl">
            {t("disclaimer")}
          </p>
          <p className="text-xs text-muted-foreground/60">
            © {year} PlayFunded. {t("rights")}.
          </p>
        </div>
      </div>
    </footer>
  );
}
