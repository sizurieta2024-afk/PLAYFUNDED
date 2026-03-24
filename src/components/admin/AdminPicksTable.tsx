"use client";

import { useState, useTransition } from "react";
import { adminSettlePick } from "@/app/actions/admin";

type PickStatus = "pending" | "won" | "lost" | "void" | "push";
type SettleStatus = "won" | "lost" | "void" | "push";

type Pick = {
  id: string;
  status: string;
  eventName: string | null;
  event: string;
  sport: string;
  league: string;
  marketType: string;
  selection: string;
  linePoint: number | null;
  odds: number;
  stake: number;
  actualPayout: number;
  placedAt: Date;
  user: { email: string; name: string | null };
  challenge: { tier: { name: string } } | null;
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-blue-500/15 text-blue-400",
  won: "bg-pf-brand/15 text-pf-brand",
  lost: "bg-red-500/15 text-red-400",
  void: "bg-muted text-muted-foreground",
  push: "bg-amber-500/15 text-amber-400",
};

function fmt(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

const SETTLE_STATUSES: SettleStatus[] = ["won", "lost", "void", "push"];

function PickRow({ pick }: { pick: Pick }) {
  const [overrideStatus, setOverrideStatus] = useState<SettleStatus>("won");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  const pnl =
    pick.status === "won"
      ? pick.actualPayout - pick.stake
      : pick.status === "lost"
        ? -pick.stake
        : 0;

  function handleOverride() {
    if (!note.trim()) {
      setError("Note is required");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await adminSettlePick(pick.id, overrideStatus, note);
      if (result.error) {
        setError(result.error);
      } else {
        setSuccess(true);
        setNote("");
      }
    });
  }

  return (
    <tr className="border-b border-border last:border-0">
      <td className="px-3 py-3">
        <p className="text-xs font-medium text-foreground truncate max-w-[110px]">
          {pick.user.name ?? pick.user.email.split("@")[0]}
        </p>
        <p className="text-[10px] text-muted-foreground truncate max-w-[110px]">
          {pick.user.email}
        </p>
      </td>
      <td className="px-3 py-3 text-xs text-muted-foreground">
        {pick.challenge?.tier.name ?? "—"}
      </td>
      <td className="px-3 py-3 text-xs text-foreground max-w-[140px]">
        <p className="truncate">{pick.eventName ?? pick.event}</p>
        <p className="text-[10px] text-muted-foreground capitalize">
          {pick.sport} · {pick.league}
        </p>
      </td>
      <td className="px-3 py-3 text-xs text-muted-foreground capitalize">
        {pick.marketType.replace(/_/g, " ")}
      </td>
      <td className="px-3 py-3 text-xs text-foreground max-w-[100px] truncate">
        {pick.selection}
        {pick.linePoint !== null && (
          <span className="text-muted-foreground ml-1">
            ({pick.linePoint > 0 ? "+" : ""}
            {pick.linePoint})
          </span>
        )}
      </td>
      <td className="px-3 py-3 tabular-nums text-xs text-foreground">
        {pick.odds.toFixed(2)}
      </td>
      <td className="px-3 py-3 tabular-nums text-xs text-foreground">
        {fmt(pick.stake)}
      </td>
      <td className="px-3 py-3">
        <span
          className={`inline-flex px-2 py-0.5 rounded-md text-xs font-semibold ${STATUS_COLORS[pick.status] ?? "bg-muted text-muted-foreground"}`}
        >
          {pick.status}
        </span>
      </td>
      <td
        className={`px-3 py-3 tabular-nums text-xs font-semibold ${pnl > 0 ? "text-pf-brand" : pnl < 0 ? "text-red-400" : "text-muted-foreground"}`}
      >
        {pick.status === "pending" ? "—" : `${pnl >= 0 ? "+" : ""}${fmt(pnl)}`}
      </td>
      <td className="px-3 py-3 text-xs text-muted-foreground whitespace-nowrap">
        {new Date(pick.placedAt).toLocaleDateString()}
      </td>
      <td className="px-3 py-3 min-w-[260px]">
        {pick.status === "pending" && !success ? (
          <div className="flex flex-col gap-1.5">
            <div className="flex gap-1.5">
              <select
                value={overrideStatus}
                onChange={(e) =>
                  setOverrideStatus(e.target.value as SettleStatus)
                }
                className="px-2 py-1 rounded-lg border border-border bg-card text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-pf-pink/40"
              >
                {SETTLE_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Admin note (required)"
                className="flex-1 px-2 py-1 rounded-lg border border-border bg-card text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-pf-pink/40"
              />
              <button
                onClick={handleOverride}
                disabled={isPending}
                className="px-2.5 py-1 rounded-lg bg-pf-pink hover:bg-pf-pink-dark text-white text-xs font-semibold transition-colors disabled:opacity-50 whitespace-nowrap"
              >
                {isPending ? "…" : "Override"}
              </button>
            </div>
            {error && <p className="text-[10px] text-red-400">{error}</p>}
          </div>
        ) : success ? (
          <span className="text-xs text-pf-brand font-semibold">Settled ✓</span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </td>
    </tr>
  );
}

export function AdminPicksTable({ picks }: { picks: Pick[] }) {
  if (picks.length === 0) {
    return (
      <tr>
        <td
          colSpan={11}
          className="px-4 py-8 text-sm text-muted-foreground text-center"
        >
          No picks found
        </td>
      </tr>
    );
  }

  return (
    <>
      {picks.map((p) => (
        <PickRow key={p.id} pick={p} />
      ))}
    </>
  );
}
