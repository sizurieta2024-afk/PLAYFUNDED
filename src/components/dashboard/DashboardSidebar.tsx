"use client";

import { usePathname } from "next/navigation";
import { useLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import {
  LayoutDashboard,
  Zap,
  BarChart2,
  Wallet,
  Users,
  Settings,
  ChevronRight,
  TrendingUp,
} from "lucide-react";

interface NavItem {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  exact?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Overview", exact: true },
  { href: "/dashboard/picks", icon: Zap, label: "Picks" },
  { href: "/dashboard/analytics", icon: BarChart2, label: "Analytics" },
  { href: "/dashboard/payouts", icon: Wallet, label: "Payouts" },
  { href: "/dashboard/affiliate", icon: Users, label: "Affiliate" },
  { href: "/dashboard/settings", icon: Settings, label: "Settings" },
];

export function DashboardSidebar() {
  const pathname = usePathname();
  const locale = useLocale();

  function isActive(href: string, exact = false) {
    const full = `/${locale}${href}`;
    return exact ? pathname === full : pathname.startsWith(full);
  }

  return (
    <>
      {/* ── Desktop sidebar ─────────────────────────────────────────── */}
      <aside className="hidden md:flex flex-col w-[220px] shrink-0 border-r border-white/[0.06] bg-pf-dark-surface min-h-[calc(100vh-64px)] sticky top-16 self-start">
        {/* Brand mark inside sidebar */}
        <div className="flex items-center gap-2 px-4 py-4 border-b border-white/[0.05]">
          <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-pf-brand/15">
            <TrendingUp
              className="w-3.5 h-3.5 text-pf-brand"
              strokeWidth={2.5}
            />
          </div>
          <span className="text-xs font-bold text-white/70 tracking-widest uppercase">
            PlayFunded
          </span>
        </div>

        {/* Navigation */}
        <nav className="flex flex-col gap-0.5 p-2.5 pt-3 flex-1">
          {NAV_ITEMS.map(({ href, icon: Icon, label, exact }) => {
            const active = isActive(href, exact);
            return (
              <Link
                key={href}
                href={href}
                className={`relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group cursor-pointer ${
                  active
                    ? "bg-pf-brand/10 text-pf-brand"
                    : "text-slate-400 hover:text-white hover:bg-white/[0.04]"
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
                      : "text-slate-500 group-hover:text-slate-300"
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
        <div className="p-2.5 border-t border-white/[0.05]">
          <div className="rounded-xl bg-pf-brand/5 border border-pf-brand/15 p-3">
            <div className="flex items-center gap-2 mb-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-pf-brand animate-pulse" />
              <p className="text-[10px] text-pf-brand font-semibold uppercase tracking-widest">
                Live
              </p>
            </div>
            <p className="text-[11px] text-slate-500 leading-tight">
              Trading session active
            </p>
          </div>
        </div>
      </aside>

      {/* ── Mobile bottom nav ───────────────────────────────────────── */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-white/[0.08] bg-[#020617]/95 backdrop-blur-md flex items-center justify-around px-2 pb-safe">
        {NAV_ITEMS.map(({ href, icon: Icon, label, exact }) => {
          const active = isActive(href, exact);
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center gap-0.5 py-2.5 px-3 rounded-lg transition-colors ${
                active ? "text-pf-brand" : "text-slate-500 hover:text-slate-300"
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[9px] font-semibold uppercase tracking-wide">
                {label.slice(0, 4)}
              </span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
