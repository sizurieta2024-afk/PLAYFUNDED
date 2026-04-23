"use client";

import { useTranslations } from "next-intl";
import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { LanguageToggle } from "./LanguageToggle";
import { getDiscordInviteUrl } from "@/lib/public-links";

export function Footer() {
  const t = useTranslations("footer");
  const tn = useTranslations("nav");
  const year = new Date().getFullYear();
  const discordInviteUrl = getDiscordInviteUrl();

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
        ...(discordInviteUrl
          ? [
              {
                label: t("discord"),
                href: discordInviteUrl,
                external: true,
              },
            ]
          : []),
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
            <Link href="/" className="group flex w-fit items-center gap-2.5">
              <Image
                src="/logo.png"
                alt=""
                width={40}
                height={40}
                className="h-9 w-9 object-contain"
              />
              <span className="font-display font-bold text-base tracking-[0.15em] uppercase text-pf-brand transition-colors duration-200 group-hover:text-pf-gold-light">
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
                    {"external" in link && link.external ? (
                      <a
                        href={link.href}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {link.label}
                      </a>
                    ) : (
                      <Link
                        href={link.href}
                        className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {link.label}
                      </Link>
                    )}
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
