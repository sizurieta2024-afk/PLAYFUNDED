"use client";

import { useTransition } from "react";
import { setAffiliateRate } from "@/app/actions/admin";

interface AffiliateRow {
  id: string;
  code: string;
  commissionRate: "five" | "ten";
  totalClicks: number;
  totalConversions: number;
  totalEarned: number;
  pendingPayout: number;
  user: { email: string; name: string | null };
}

function formatUSD(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

export function AdminAffiliatesTable({ affiliates }: { affiliates: AffiliateRow[] }) {
  const [pending, startTransition] = useTransition();

  function toggleRate(id: string, current: "five" | "ten") {
    const next: "five" | "ten" = current === "five" ? "ten" : "five";
    startTransition(async () => {
      await setAffiliateRate(id, next);
    });
  }

  if (affiliates.length === 0) {
    return <p className="text-sm text-muted-foreground py-8 text-center">No affiliates yet.</p>;
  }

  return (
    <div className="rounded-xl border border-border overflow-x-auto">
      <table className="w-full text-sm min-w-[700px]">
        <thead>
          <tr className="border-b border-border bg-muted/30">
            {["Affiliate", "Code", "Rate", "Clicks", "Conversions", "Earned", "Pending", "Toggle Rate"].map((h) => (
              <th key={h} className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {affiliates.map((a) => (
            <tr key={a.id} className="border-b border-border last:border-0">
              <td className="px-4 py-3">
                <p className="font-medium text-foreground text-xs">{a.user.name ?? "—"}</p>
                <p className="text-xs text-muted-foreground">{a.user.email}</p>
              </td>
              <td className="px-4 py-3 font-mono text-xs text-pf-brand">{a.code}</td>
              <td className="px-4 py-3">
                <span className={`inline-flex px-2 py-0.5 rounded-md text-xs font-bold ${
                  a.commissionRate === "ten" ? "bg-pf-brand/15 text-pf-brand" : "bg-muted text-muted-foreground"
                }`}>
                  {a.commissionRate === "ten" ? "10%" : "5%"}
                </span>
              </td>
              <td className="px-4 py-3 tabular-nums text-muted-foreground">{a.totalClicks}</td>
              <td className="px-4 py-3 tabular-nums text-muted-foreground">{a.totalConversions}</td>
              <td className="px-4 py-3 tabular-nums text-xs">{formatUSD(a.totalEarned)}</td>
              <td className="px-4 py-3 tabular-nums text-xs text-amber-400">{formatUSD(a.pendingPayout)}</td>
              <td className="px-4 py-3">
                <button
                  onClick={() => toggleRate(a.id, a.commissionRate)}
                  disabled={pending}
                  className="text-xs px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors disabled:opacity-50"
                >
                  → {a.commissionRate === "five" ? "10%" : "5%"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
