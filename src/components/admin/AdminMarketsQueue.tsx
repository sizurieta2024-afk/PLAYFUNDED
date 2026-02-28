"use client";

import { useState, useTransition } from "react";
import { adminUpdateMarketRequest } from "@/app/actions/admin";
import type { MarketRequestStatus } from "@prisma/client";

interface MarketRow {
  id: string;
  sport: string;
  league: string;
  description: string;
  status: string;
  adminNote: string | null;
  createdAt: string;
  user: { email: string; name: string | null };
}

export function AdminMarketsQueue({ requests }: { requests: MarketRow[] }) {
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  function handle(id: string, status: MarketRequestStatus) {
    startTransition(async () => {
      await adminUpdateMarketRequest(id, status, notes[id]);
    });
  }

  if (requests.length === 0) {
    return <p className="text-sm text-muted-foreground py-8 text-center">No market requests in this status.</p>;
  }

  return (
    <div className="space-y-3">
      {requests.map((r) => (
        <div key={r.id} className="rounded-xl border border-border bg-card p-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-medium text-foreground text-sm">
                {r.sport} · {r.league}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">{r.description}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {r.user.name ?? r.user.email} · {new Date(r.createdAt).toLocaleDateString()}
              </p>
              {r.adminNote && <p className="text-xs text-amber-400 mt-1">Note: {r.adminNote}</p>}
            </div>
            <span className={`px-2 py-0.5 rounded-md text-xs font-semibold whitespace-nowrap ${
              r.status === "approved" ? "bg-pf-brand/15 text-pf-brand" :
              r.status === "rejected" ? "bg-red-500/15 text-red-400" :
              r.status === "reviewed" ? "bg-blue-500/15 text-blue-400" :
              "bg-amber-500/15 text-amber-400"
            }`}>{r.status}</span>
          </div>

          {r.status === "pending" && (
            <div className="flex flex-wrap gap-2">
              <input
                type="text"
                placeholder="Admin note (optional)"
                value={notes[r.id] ?? ""}
                onChange={(e) => setNotes((prev) => ({ ...prev, [r.id]: e.target.value }))}
                className="flex-1 min-w-40 text-xs px-3 py-2 rounded-lg border border-border bg-background text-foreground focus:outline-none"
              />
              <button onClick={() => handle(r.id, "reviewed")} disabled={pending} className="text-xs px-3 py-2 rounded-lg border border-blue-500/30 text-blue-400 hover:bg-blue-500/10 transition-colors disabled:opacity-50">Mark Reviewed</button>
              <button onClick={() => handle(r.id, "approved")} disabled={pending} className="text-xs px-3 py-2 rounded-lg bg-pf-brand text-white font-semibold hover:bg-pf-brand/90 transition-colors disabled:opacity-50">Approve</button>
              <button onClick={() => handle(r.id, "rejected")} disabled={pending} className="text-xs px-3 py-2 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50">Reject</button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
