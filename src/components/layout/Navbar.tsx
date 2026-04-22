"use client";

import { useTranslations, useLocale } from "next-intl";
import { Link, buildLoginPath } from "@/i18n/navigation";
import { ThemeToggle } from "./ThemeToggle";
import { LanguageToggle } from "./LanguageToggle";
import { Menu, X, LogOut } from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { createBrowserClient } from "@supabase/ssr";

interface NavbarProps {
  isAuthenticated?: boolean;
}

export function Navbar({ isAuthenticated = false }: NavbarProps) {
  const t = useTranslations("nav");
  const locale = useLocale();
  const [mobileOpen, setMobileOpen] = useState(false);

  async function handleSignOut() {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
    await supabase.auth.signOut();
    window.location.href = buildLoginPath(locale);
  }

  const navLinks = [
    { key: "howItWorks", href: "/how-it-works" as const },
    { key: "challenges", href: "/challenges" as const },
    { key: "faq", href: "/faq" as const },
  ] as const;

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/92 backdrop-blur-xl">
      <div className="mx-auto max-w-[1200px] px-6 lg:px-16">
        <div className="flex h-14 items-center justify-between gap-4">
          {/* ── Brand ─────────────────────────────────────────────── */}
          <Link href="/" className="shrink-0 flex items-center gap-2">
            <Image
              src="/brand/logo-mark.svg"
              alt="PlayFunded"
              width={28}
              height={28}
              className="w-7 h-7"
              priority
            />
            <span className="font-display font-bold text-sm tracking-[0.15em] uppercase text-pf-brand hover:text-pf-gold-light transition-colors duration-200">
              {t("brand")}
            </span>
          </Link>

          {/* ── Desktop nav links ──────────────────────────────────── */}
          <nav className="hidden md:flex items-center gap-9">
            {navLinks.map(({ key, href }) => (
              <Link
                key={key}
                href={href}
                className="text-[13px] text-muted-foreground hover:text-foreground transition-colors duration-200"
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
              <>
                <Link
                  href="/dashboard"
                  className="px-4 py-2 rounded text-[13px] font-medium text-muted-foreground border border-border hover:border-pf-brand/30 hover:text-foreground transition-all duration-200"
                >
                  {t("dashboard")}
                </Link>
                <Link
                  href="/challenges"
                  className="press px-5 py-2 rounded bg-pf-pink hover:bg-pf-pink-dark text-white text-[13px] font-semibold transition-colors duration-200"
                >
                  {t("buyChallengeNav") ?? "Buy a Challenge"}
                </Link>
                <button
                  onClick={handleSignOut}
                  className="flex items-center justify-center w-8 h-8 rounded border border-border text-muted-foreground hover:text-red-400 hover:border-red-500/50 transition-colors"
                  aria-label={t("signout")}
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/auth/login"
                  className="px-4 py-2 rounded text-[13px] font-medium text-muted-foreground border border-border hover:border-pf-brand/30 hover:text-foreground transition-all duration-200"
                >
                  {t("login")}
                </Link>
                <Link
                  href="/challenges"
                  className="press px-5 py-2 rounded bg-pf-pink hover:bg-pf-pink-dark text-white text-[13px] font-semibold transition-colors duration-200"
                >
                  {t("challenges")}
                </Link>
              </>
            )}
          </div>

          {/* ── Mobile: toggles + hamburger ───────────────────────── */}
          <div className="flex md:hidden items-center gap-2">
            <LanguageToggle />
            <ThemeToggle />
            <button
              onClick={() => setMobileOpen((v) => !v)}
              className="flex items-center justify-center w-8 h-8 rounded border border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              aria-label="Toggle menu"
            >
              <AnimatePresence mode="wait" initial={false}>
                {mobileOpen ? (
                  <motion.span
                    key="close"
                    initial={{ rotate: -90, opacity: 0 }}
                    animate={{ rotate: 0, opacity: 1 }}
                    exit={{ rotate: 90, opacity: 0 }}
                    transition={{ duration: 0.15 }}
                  >
                    <X className="w-4 h-4" />
                  </motion.span>
                ) : (
                  <motion.span
                    key="open"
                    initial={{ rotate: 90, opacity: 0 }}
                    animate={{ rotate: 0, opacity: 1 }}
                    exit={{ rotate: -90, opacity: 0 }}
                    transition={{ duration: 0.15 }}
                  >
                    <Menu className="w-4 h-4" />
                  </motion.span>
                )}
              </AnimatePresence>
            </button>
          </div>
        </div>
      </div>

      {/* ── Mobile menu ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="md:hidden overflow-hidden border-t border-border bg-background"
          >
            <div className="mx-auto max-w-[1200px] px-6 py-3 space-y-1">
              {navLinks.map(({ key, href }, i) => (
                <motion.div
                  key={key}
                  initial={{ x: -16, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: i * 0.05, duration: 0.2 }}
                >
                  <Link
                    href={href}
                    onClick={() => setMobileOpen(false)}
                    className="flex px-3 py-2.5 rounded text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                  >
                    {t(key)}
                  </Link>
                </motion.div>
              ))}
              <motion.div
                initial={{ x: -16, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: navLinks.length * 0.05, duration: 0.2 }}
                className="pt-2 pb-1 border-t border-border flex flex-col gap-2"
              >
                {isAuthenticated ? (
                  <>
                    <Link
                      href="/dashboard"
                      onClick={() => setMobileOpen(false)}
                      className="flex px-3 py-2.5 rounded text-sm font-semibold text-pf-brand hover:bg-secondary transition-colors"
                    >
                      {t("dashboard")}
                    </Link>
                    <button
                      onClick={() => {
                        setMobileOpen(false);
                        handleSignOut();
                      }}
                      className="flex items-center gap-2 px-3 py-2.5 rounded text-sm font-medium text-muted-foreground hover:text-red-400 hover:bg-secondary transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      {t("signout")}
                    </button>
                  </>
                ) : (
                  <Link
                    href="/auth/login"
                    onClick={() => setMobileOpen(false)}
                    className="flex px-3 py-2.5 rounded text-sm font-semibold text-pf-brand hover:bg-secondary transition-colors"
                  >
                    {t("login")}
                  </Link>
                )}
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
