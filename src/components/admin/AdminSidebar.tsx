"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Trophy,
  DollarSign,
  ShieldCheck,
  UsersRound,
  ListTodo,
  Radio,
} from "lucide-react";

const NAV = [
  { label: "Dashboard", href: "/admin", icon: LayoutDashboard, exact: true },
  { label: "Users", href: "/admin/users", icon: Users },
  { label: "Challenges", href: "/admin/challenges", icon: Trophy },
  { label: "Payouts", href: "/admin/payouts", icon: DollarSign },
  { label: "KYC", href: "/admin/kyc", icon: ShieldCheck },
  { label: "Affiliates", href: "/admin/affiliates", icon: UsersRound },
  { label: "Markets", href: "/admin/markets", icon: ListTodo },
  { label: "Odds Feed", href: "/admin/odds", icon: Radio },
];

export function AdminSidebar() {
  const pathname = usePathname();

  function isActive(href: string, exact = false) {
    // Strip locale prefix for comparison
    const normalized = pathname.replace(/^\/(en|es-419)/, "");
    return exact ? normalized === href : normalized.startsWith(href);
  }

  return (
    <aside className="w-52 shrink-0 border-r border-border bg-card min-h-screen sticky top-0">
      <div className="px-4 py-5 border-b border-border">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Admin
        </p>
        <p className="text-sm font-bold text-foreground mt-0.5">PlayFunded</p>
      </div>
      <nav className="p-3 space-y-0.5">
        {NAV.map(({ label, href, icon: Icon, exact }) => {
          const active = isActive(href, exact);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? "bg-pf-brand/10 text-pf-brand"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="px-4 py-3 border-t border-border mt-4">
        <Link
          href="/dashboard"
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Back to dashboard
        </Link>
      </div>
    </aside>
  );
}
