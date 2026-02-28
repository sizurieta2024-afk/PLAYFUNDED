"use client";

import { useState, useTransition } from "react";
import { adminUpdatePayout } from "@/app/actions/admin";

interface PayoutRow {
  id: string;
  amount: number;
  splitPct: number;
  method: string;
  status: string;
  isAffiliate: boolean;
  requestedAt: string;
  user: { email: string; name: string | null };
  challenge: { tier: { name: string } } | null;
}

function formatUSD(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

export function AdminPayoutsQueue({ payouts }: { payouts: PayoutRow[] }) {
  const [txRefs, setTxRefs] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  function handle(id: string, action: "approve" | "reject") {
    startTransition(async () => {
      await adminUpdatePayout(id, action, txRefs[id], notes[id]);
    });
  }

  if (payouts.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        No pending payouts.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {payouts.map((p) => (
        <div key={p.id} className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <p className="font-semibold text-foreground">
                {p.user.name ?? p.user.email}
              </p>
              <p className="text-xs text-muted-foreground">{p.user.email}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {p.isAffiliate
                  ? "Affiliate commission"
                  : (p.challenge?.tier.name ?? "—")}{" "}
                · via {p.method} ·{" "}
                {new Date(p.requestedAt).toLocaleDateString()}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xl font-bold tabular-nums text-pf-brand">
                {formatUSD(p.amount)}
              </p>
              <p className="text-xs text-muted-foreground">
                {p.splitPct}% split
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              type="text"
              placeholder="TX Reference (for approval)"
              value={txRefs[p.id] ?? ""}
              onChange={(e) =>
                setTxRefs((prev) => ({ ...prev, [p.id]: e.target.value }))
              }
              className="flex-1 min-w-40 text-xs px-3 py-2 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-pf-brand/40"
            />
            <input
              type="text"
              placeholder="Admin note (optional)"
              value={notes[p.id] ?? ""}
              onChange={(e) =>
                setNotes((prev) => ({ ...prev, [p.id]: e.target.value }))
              }
              className="flex-1 min-w-40 text-xs px-3 py-2 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
            <button
              onClick={() => handle(p.id, "approve")}
              disabled={pending}
              className="text-xs px-4 py-2 rounded-lg bg-pf-brand text-white font-semibold hover:bg-pf-brand/90 transition-colors disabled:opacity-50"
            >
              Approve & Pay
            </button>
            <button
              onClick={() => handle(p.id, "reject")}
              disabled={pending}
              className="text-xs px-4 py-2 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
            >
              Reject
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
