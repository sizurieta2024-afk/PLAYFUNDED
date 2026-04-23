"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { buildLoginPath, inferLocaleFromPath } from "@/i18n/navigation";
import {
  LayoutDashboard,
  Users,
  Trophy,
  DollarSign,
  ShieldCheck,
  UsersRound,
  ListTodo,
  Radio,
  TrendingUp,
  Crosshair,
  CreditCard,
  ShieldAlert,
  ClipboardCheck,
  LogOut,
  Mail,
} from "lucide-react";
import { createBrowserClient } from "@supabase/ssr";

const NAV = [
  { label: "Overview", href: "/admin", icon: LayoutDashboard, exact: true },
  { label: "Revenue", href: "/admin/revenue", icon: TrendingUp },
  { label: "Risk", href: "/admin/risk", icon: ShieldAlert },
  { label: "Launch", href: "/admin/launch", icon: ClipboardCheck },
  { label: "Users", href: "/admin/users", icon: Users },
  { label: "Challenges", href: "/admin/challenges", icon: Trophy },
  { label: "Picks", href: "/admin/picks", icon: Crosshair },
  { label: "Payments", href: "/admin/payments", icon: CreditCard },
  { label: "Payouts", href: "/admin/payouts", icon: DollarSign },
  { label: "KYC", href: "/admin/kyc", icon: ShieldCheck },
  { label: "Affiliates", href: "/admin/affiliates", icon: UsersRound },
  { label: "Markets", href: "/admin/markets", icon: ListTodo },
  { label: "Odds Feed", href: "/admin/odds", icon: Radio },
  { label: "Email Blast", href: "/admin/blast", icon: Mail },
];

export function AdminSidebar() {
  const pathname = usePathname();

  function isActive(href: string, exact = false) {
    const normalized = pathname.replace(/^\/(en|es-419|pt-BR)/, "");
    return exact ? normalized === href : normalized.startsWith(href);
  }

  async function handleSignOut() {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
    await supabase.auth.signOut();
    window.location.href = buildLoginPath(inferLocaleFromPath(pathname));
  }

  return (
    <aside className="w-56 shrink-0 border-r border-border bg-card min-h-screen sticky top-0 flex flex-col">
      <div className="flex items-center gap-2.5 px-4 py-5 border-b border-border">
        <Image
          src="/logo.png"
          alt=""
          width={40}
          height={40}
          className="h-9 w-9 object-contain"
          priority
        />
        <div>
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
            Admin Panel
          </p>
          <p className="text-sm font-bold text-foreground mt-0.5">
            PlayFunded
          </p>
        </div>
      </div>

      <nav className="p-3 space-y-0.5 flex-1 overflow-y-auto">
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

      <div className="px-3 py-3 border-t border-border">
        <button
          onClick={handleSignOut}
          className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-red-400 hover:bg-secondary transition-colors"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
