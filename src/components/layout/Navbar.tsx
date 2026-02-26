"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { ThemeToggle } from "./ThemeToggle";
import { LanguageToggle } from "./LanguageToggle";
import { Menu, X, TrendingUp } from "lucide-react";
import { useState } from "react";

interface NavbarProps {
  isAuthenticated?: boolean;
}

export function Navbar({ isAuthenticated = false }: NavbarProps) {
  const t = useTranslations("nav");
  const [mobileOpen, setMobileOpen] = useState(false);

  const navLinks = [
    { key: "challenges", href: "/challenges" as const },
    { key: "howItWorks", href: "/how-it-works" as const },
    { key: "leaderboard", href: "/leaderboard" as const },
    { key: "faq", href: "/faq" as const },
  ] as const;

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-20 items-center justify-between gap-4">
          {/* ── Brand ─────────────────────────────────────────────── */}
          <Link href="/" className="flex items-center gap-2 shrink-0 group">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-pf-brand/10 group-hover:bg-pf-brand/20 transition-colors">
              <TrendingUp className="w-4 h-4 text-pf-brand" strokeWidth={2.5} />
            </div>
            <span className="text-lg font-bold tracking-tight text-foreground">
              {t("brand")}
            </span>
          </Link>

          {/* ── Desktop nav links ──────────────────────────────────── */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map(({ key, href }) => (
              <Link
                key={key}
                href={href}
                className="px-3 py-2 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              >
                {t(key)}
              </Link>
            ))}
          </nav>

          {/* ── Desktop right actions ──────────────────────────────── */}
          <div className="hidden md:flex items-center gap-2">
            <LanguageToggle />
            <ThemeToggle />

            {isAuthenticated ? (
              <Link
                href="/dashboard"
                className="ml-1 flex items-center gap-2 px-4 h-9 rounded-md bg-pf-brand hover:bg-pf-brand-dark text-white text-sm font-semibold transition-colors"
              >
                {t("dashboard")}
              </Link>
            ) : (
              <Link
                href="/auth/login"
                className="ml-1 px-5 h-9 flex items-center rounded-md bg-pf-brand hover:bg-pf-brand-dark text-white text-sm font-semibold transition-colors"
              >
                {t("login")}
              </Link>
            )}
          </div>

          {/* ── Mobile: toggles + hamburger ───────────────────────── */}
          <div className="flex md:hidden items-center gap-2">
            <LanguageToggle />
            <ThemeToggle />
            <button
              onClick={() => setMobileOpen((v) => !v)}
              className="flex items-center justify-center w-9 h-9 rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              aria-label="Toggle menu"
            >
              {mobileOpen ? (
                <X className="w-4 h-4" />
              ) : (
                <Menu className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ── Mobile menu ─────────────────────────────────────────────── */}
      {mobileOpen && (
        <div className="md:hidden border-t border-border bg-background">
          <div className="mx-auto max-w-7xl px-4 py-3 space-y-1">
            {navLinks.map(({ key, href }) => (
              <Link
                key={key}
                href={href}
                onClick={() => setMobileOpen(false)}
                className="flex px-3 py-2.5 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              >
                {t(key)}
              </Link>
            ))}
            <div className="pt-2 pb-1 border-t border-border space-y-1">
              {isAuthenticated ? (
                <Link
                  href="/dashboard"
                  onClick={() => setMobileOpen(false)}
                  className="flex px-3 py-2.5 rounded-md text-sm font-semibold text-pf-brand hover:bg-secondary transition-colors"
                >
                  {t("dashboard")}
                </Link>
              ) : (
                <Link
                  href="/auth/login"
                  onClick={() => setMobileOpen(false)}
                  className="flex px-3 py-2.5 rounded-md text-sm font-semibold text-pf-brand hover:bg-secondary transition-colors"
                >
                  {t("login")}
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
