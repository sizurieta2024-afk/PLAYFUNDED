"use client";

import { usePathname } from "next/navigation";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import {
  LayoutDashboard,
  Zap,
  BarChart2,
  Wallet,
  Settings,
  ChevronRight,
  Users,
} from "lucide-react";

interface NavItem {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  mobileLabel?: string;
  exact?: boolean;
}

export function DashboardSidebar() {
  const pathname = usePathname();
  const locale = useLocale();
  const t = useTranslations("dashboard");

  const navItems: NavItem[] = [
    {
      href: "/dashboard",
      icon: LayoutDashboard,
      label: t("navOverview"),
      mobileLabel: t("navOverviewShort"),
      exact: true,
    },
    {
      href: "/dashboard/picks",
      icon: Zap,
      label: t("navPicks"),
      mobileLabel: t("navPicksShort"),
    },
    {
      href: "/dashboard/analytics",
      icon: BarChart2,
      label: t("navAnalytics"),
      mobileLabel: t("navAnalyticsShort"),
    },
    {
      href: "/dashboard/groups",
      icon: Users,
      label: t("navGroups"),
      mobileLabel: t("navGroupsShort"),
    },
    {
      href: "/dashboard/payouts",
      icon: Wallet,
      label: t("navPayouts"),
      mobileLabel: t("navPayoutsShort"),
    },
    {
      href: "/dashboard/settings",
      icon: Settings,
      label: t("navSettings"),
      mobileLabel: t("navSettingsShort"),
    },
  ];

  function isActive(href: string, exact = false) {
    const full = `/${locale}${href}`;
    return exact ? pathname === full : pathname.startsWith(full);
  }

  return (
    <>
      {/* ── Desktop sidebar ─────────────────────────────────────────── */}
      <aside className="hidden md:flex flex-col w-[220px] shrink-0 border-r border-border bg-card min-h-[calc(100vh-64px)] sticky top-16 self-start">
        {/* Brand mark inside sidebar */}
        <div className="flex items-center gap-2 px-4 py-4 border-b border-border">
          <Image
            src="/logo.png"
            alt=""
            width={36}
            height={36}
            className="h-8 w-8 object-contain"
          />
          <span className="text-xs font-bold text-muted-foreground tracking-widest uppercase">
            PlayFunded
          </span>
        </div>

        {/* Navigation */}
        <nav className="flex flex-col gap-0.5 p-2.5 pt-3 flex-1">
          {navItems.map(({ href, icon: Icon, label, exact }) => {
            const active = isActive(href, exact);
            return (
              <Link
                key={href}
                href={href}
                className={`relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group cursor-pointer ${
                  active
                    ? "bg-pf-brand/10 text-pf-brand"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                }`}
              >
                {/* Active left accent bar */}
                {active && (
                  <div className="absolute left-0 top-1 bottom-1 w-0.5 rounded-full bg-pf-brand" />
                )}
                <Icon
                  className={`w-4 h-4 shrink-0 transition-colors ${
                    active
                      ? "text-pf-brand"
                      : "text-muted-foreground group-hover:text-foreground"
                  }`}
                />
                <span>{label}</span>
                {active && (
                  <ChevronRight className="ml-auto w-3 h-3 text-pf-brand/60" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Bottom status badge */}
        <div className="p-2.5 border-t border-border">
          <div className="rounded-xl bg-pf-brand/5 border border-pf-brand/15 p-3">
            <div className="flex items-center gap-2 mb-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-pf-brand animate-pulse" />
              <p className="text-[10px] text-pf-brand font-semibold uppercase tracking-widest">
                {t("liveStatus")}
              </p>
            </div>
            <p className="text-[11px] text-muted-foreground leading-tight">
              {t("tradingSessionActive")}
            </p>
          </div>
        </div>
      </aside>

      {/* ── Mobile bottom nav ───────────────────────────────────────── */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-border bg-background/95 backdrop-blur-md flex items-center justify-around px-2 pb-safe">
        {navItems.map(({ href, icon: Icon, label, mobileLabel, exact }) => {
          const active = isActive(href, exact);
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center gap-0.5 py-2.5 px-3 rounded-lg transition-colors ${
                active
                  ? "text-pf-brand"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[9px] font-semibold uppercase tracking-wide">
                {mobileLabel ?? label}
              </span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
