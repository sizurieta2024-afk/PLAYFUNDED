"use client";

import { useState } from "react";

export interface PickRow {
  id: string;
  eventName: string | null;
  league: string;
  sport: string;
  marketType: string;
  selection: string;
  odds: number;
  stake: number; // cents
  potentialPayout: number; // cents
  actualPayout: number; // cents
  status: string;
  placedAt: string; // ISO
  settledAt: string | null; // ISO
}

interface PicksTableProps {
  picks: PickRow[];
  t: Record<string, string>;
}

type StatusFilter = "all" | "won" | "lost" | "pending" | "void" | "push";

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-yellow-500/15 text-yellow-500",
  won: "bg-pf-brand/15 text-pf-brand",
  lost: "bg-red-500/15 text-red-400",
  void: "bg-muted text-muted-foreground",
  push: "bg-muted text-muted-foreground",
};

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const FILTER_KEYS: StatusFilter[] = ["all", "won", "lost", "pending", "void", "push"];

export function PicksTable({ picks, t }: PicksTableProps) {
  const [filter, setFilter] = useState<StatusFilter>("all");

  const filtered =
    filter === "all" ? picks : picks.filter((p) => p.status === filter);

  return (
    <div className="space-y-3">
      {/* Status filter tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {FILTER_KEYS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
              filter === f
                ? "bg-pf-brand text-white"
                : "bg-card border border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {t[f] ?? f}
            {f !== "all" && (
              <span className="ml-1 opacity-70">
                ({picks.filter((p) => p.status === f).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground px-1">{t.noPicks}</p>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          {/* Mobile: stacked cards */}
          <div className="divide-y divide-border md:hidden">
            {filtered.map((pick) => (
              <div key={pick.id} className="p-4 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium truncate flex-1">
                    {pick.selection}
                  </p>
                  <span
                    className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-medium ${
                      STATUS_STYLES[pick.status] ??
                      "bg-muted text-muted-foreground"
                    }`}
                  >
                    {t[pick.status] ?? pick.status}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  {pick.eventName ?? pick.league} ·{" "}
                  {t["market_" + pick.marketType] ?? pick.marketType}
                </p>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground tabular-nums">
                    {pick.odds.toFixed(2)} odds · {formatCents(pick.stake)} stake
                  </span>
                  <span className="text-muted-foreground tabular-nums">
                    {formatDate(pick.placedAt)}
                  </span>
                </div>
                {pick.status === "won" && (
                  <p className="text-xs text-pf-brand font-medium tabular-nums">
                    +{formatCents(pick.actualPayout - pick.stake)} profit
                  </p>
                )}
              </div>
            ))}
          </div>

          {/* Desktop: table */}
          <table className="hidden md:table w-full text-xs">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-4 py-2.5 text-muted-foreground font-medium">
                  {t.event ?? "Event"}
                </th>
                <th className="text-left px-4 py-2.5 text-muted-foreground font-medium">
                  {t.selection ?? "Selection"}
                </th>
                <th className="text-right px-4 py-2.5 text-muted-foreground font-medium">
                  {t.odds ?? "Odds"}
                </th>
                <th className="text-right px-4 py-2.5 text-muted-foreground font-medium">
                  {t.stake ?? "Stake"}
                </th>
                <th className="text-right px-4 py-2.5 text-muted-foreground font-medium">
                  {t.payout ?? "Payout"}
                </th>
                <th className="text-center px-4 py-2.5 text-muted-foreground font-medium">
                  {t.status ?? "Status"}
                </th>
                <th className="text-right px-4 py-2.5 text-muted-foreground font-medium">
                  {t.date ?? "Date"}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((pick) => (
                <tr key={pick.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 max-w-[160px]">
                    <p className="truncate font-medium">
                      {pick.eventName ?? pick.league}
                    </p>
                    <p className="text-muted-foreground text-[10px] mt-0.5">
                      {t["market_" + pick.marketType] ?? pick.marketType}
                    </p>
                  </td>
                  <td className="px-4 py-3 max-w-[120px]">
                    <span className="truncate block">{pick.selection}</span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {pick.odds.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {formatCents(pick.stake)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {pick.status === "won" ? (
                      <span className="text-pf-brand font-semibold">
                        +{formatCents(pick.actualPayout - pick.stake)}
                      </span>
                    ) : pick.status === "lost" ? (
                      <span className="text-red-400 font-semibold">
                        -{formatCents(pick.stake)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`px-2 py-0.5 rounded-full font-medium ${
                        STATUS_STYLES[pick.status] ??
                        "bg-muted text-muted-foreground"
                      }`}
                    >
                      {t[pick.status] ?? pick.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-muted-foreground tabular-nums">
                    {formatDate(pick.placedAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
