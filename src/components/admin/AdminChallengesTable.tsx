"use client";

import { useState, useTransition } from "react";
import { overrideChallenge, adjustChallengeBalance } from "@/app/actions/admin";

type ChallengeStatus = "active" | "funded" | "failed" | "passed";

interface ChallengeRow {
  id: string;
  status: string;
  phase: string;
  balance: number;
  startBalance: number;
  createdAt: string;
  user: { email: string; name: string | null };
  tier: { name: string };
}

const STATUS_OPTS: ChallengeStatus[] = ["active", "funded", "failed", "passed"];

function formatUSD(cents: number) {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function AdminChallengesTable({
  challenges,
}: {
  challenges: ChallengeRow[];
}) {
  const [overrides, setOverrides] = useState<
    Record<string, { status: ChallengeStatus; note: string }>
  >({});
  const [adjustments, setAdjustments] = useState<
    Record<string, { delta: string; note: string; msg: string | null }>
  >({});
  const [pending, startTransition] = useTransition();

  function handleOverride(id: string) {
    const o = overrides[id];
    if (!o?.note?.trim()) return;
    startTransition(async () => {
      await overrideChallenge(id, o.status, o.note);
    });
  }

  function handleAdjust(id: string) {
    const a = adjustments[id];
    if (!a?.note?.trim() || !a.delta) return;
    const delta = parseFloat(a.delta);
    if (isNaN(delta) || delta === 0) return;
    startTransition(async () => {
      const res = await adjustChallengeBalance(id, delta, a.note);
      setAdjustments((prev) => ({
        ...prev,
        [id]: { delta: "", note: "", msg: res.error ?? "Saved" },
      }));
    });
  }

  return (
    <div className="rounded-xl border border-border overflow-x-auto">
      <table className="w-full text-sm min-w-[900px]">
        <thead>
          <tr className="border-b border-border bg-muted/30">
            {[
              "User",
              "Tier",
              "Phase",
              "Status",
              "Balance",
              "P&L",
              "Started",
              "Override",
              "Adjust Balance",
            ].map((h) => (
              <th
                key={h}
                className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground whitespace-nowrap"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {challenges.map((c) => {
            const pnl = c.balance - c.startBalance;
            const o = overrides[c.id] ?? {
              status: c.status as ChallengeStatus,
              note: "",
            };
            return (
              <tr key={c.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3">
                  <p className="font-medium text-foreground text-xs truncate max-w-[120px]">
                    {c.user.name ?? "—"}
                  </p>
                  <p className="text-xs text-muted-foreground truncate max-w-[120px]">
                    {c.user.email}
                  </p>
                </td>
                <td className="px-4 py-3 text-muted-foreground text-xs">
                  {c.tier.name}
                </td>
                <td className="px-4 py-3 text-muted-foreground text-xs capitalize">
                  {c.phase}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={c.status} />
                </td>
                <td className="px-4 py-3 tabular-nums text-xs">
                  {formatUSD(c.balance)}
                </td>
                <td
                  className={`px-4 py-3 tabular-nums text-xs font-semibold ${pnl >= 0 ? "text-pf-brand" : "text-red-400"}`}
                >
                  {pnl >= 0 ? "+" : ""}
                  {formatUSD(pnl)}
                </td>
                <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">
                  {new Date(c.createdAt).toLocaleDateString()}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <select
                      value={o.status}
                      onChange={(e) =>
                        setOverrides((prev) => ({
                          ...prev,
                          [c.id]: {
                            ...o,
                            status: e.target.value as ChallengeStatus,
                          },
                        }))
                      }
                      className="text-xs px-2 py-1 rounded-lg border border-border bg-background text-foreground focus:outline-none"
                    >
                      {STATUS_OPTS.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      placeholder="Note (required)"
                      value={o.note}
                      onChange={(e) =>
                        setOverrides((prev) => ({
                          ...prev,
                          [c.id]: { ...o, note: e.target.value },
                        }))
                      }
                      className="text-xs px-2 py-1 rounded-lg border border-border bg-background text-foreground w-24 focus:outline-none"
                    />
                    <button
                      onClick={() => handleOverride(c.id)}
                      disabled={
                        pending || !o.note?.trim() || o.status === c.status
                      }
                      className="text-xs px-2 py-1 rounded-lg bg-pf-pink/10 text-pf-pink border border-pf-pink/30 hover:bg-pf-pink/20 transition-colors disabled:opacity-40"
                    >
                      Save
                    </button>
                  </div>
                </td>
                <td className="px-4 py-3">
                  {(() => {
                    const a = adjustments[c.id] ?? {
                      delta: "",
                      note: "",
                      msg: null,
                    };
                    return (
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1.5">
                          <div className="relative">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                              $
                            </span>
                            <input
                              type="number"
                              placeholder="±amount"
                              value={a.delta}
                              onChange={(e) =>
                                setAdjustments((prev) => ({
                                  ...prev,
                                  [c.id]: {
                                    ...a,
                                    delta: e.target.value,
                                    msg: null,
                                  },
                                }))
                              }
                              className="text-xs pl-5 pr-2 py-1 rounded-lg border border-border bg-background text-foreground w-20 focus:outline-none"
                            />
                          </div>
                          <input
                            type="text"
                            placeholder="Reason"
                            value={a.note}
                            onChange={(e) =>
                              setAdjustments((prev) => ({
                                ...prev,
                                [c.id]: {
                                  ...a,
                                  note: e.target.value,
                                  msg: null,
                                },
                              }))
                            }
                            className="text-xs px-2 py-1 rounded-lg border border-border bg-background text-foreground w-20 focus:outline-none"
                          />
                          <button
                            onClick={() => handleAdjust(c.id)}
                            disabled={
                              pending ||
                              !a.note?.trim() ||
                              !a.delta ||
                              parseFloat(a.delta) === 0
                            }
                            className="text-xs px-2 py-1 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/30 hover:bg-amber-500/20 transition-colors disabled:opacity-40"
                          >
                            Apply
                          </button>
                        </div>
                        {a.msg && (
                          <p
                            className={`text-xs ${a.msg === "Saved" ? "text-pf-brand" : "text-red-400"}`}
                          >
                            {a.msg}
                          </p>
                        )}
                      </div>
                    );
                  })()}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    active: "bg-blue-500/15 text-blue-400",
    funded: "bg-pf-brand/15 text-pf-brand",
    failed: "bg-red-500/15 text-red-400",
    passed: "bg-muted text-muted-foreground",
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold ${map[status] ?? "bg-muted text-muted-foreground"}`}
    >
      {status}
    </span>
  );
}
