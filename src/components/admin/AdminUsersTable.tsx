"use client";

import { useState, useTransition } from "react";
import { banUser, unbanUser } from "@/app/actions/admin";

interface UserRow {
  id: string;
  email: string;
  name: string | null;
  role: string;
  isBanned: boolean;
  banReason: string | null;
  country: string | null;
  createdAt: string;
  _count: { challenges: number; payouts: number };
}

export function AdminUsersTable({ users }: { users: UserRow[] }) {
  const [banReason, setBanReason] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  function handleBan(userId: string) {
    const reason = banReason[userId]?.trim();
    if (!reason) return;
    startTransition(async () => {
      await banUser(userId, reason);
    });
  }

  function handleUnban(userId: string) {
    startTransition(async () => {
      await unbanUser(userId);
    });
  }

  return (
    <div className="rounded-xl border border-border overflow-x-auto">
      <table className="w-full text-sm min-w-[800px]">
        <thead>
          <tr className="border-b border-border bg-muted/30">
            {["User", "Country", "Role", "Challenges", "Payouts", "Joined", "Actions"].map(
              (h) => (
                <th
                  key={h}
                  className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground whitespace-nowrap"
                >
                  {h}
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} className="border-b border-border last:border-0">
              <td className="px-4 py-3">
                <p className="font-medium text-foreground">
                  {u.name ?? "—"}
                </p>
                <p className="text-xs text-muted-foreground">{u.email}</p>
                {u.isBanned && (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-red-500/15 text-red-400 mt-1">
                    BANNED: {u.banReason}
                  </span>
                )}
              </td>
              <td className="px-4 py-3 text-muted-foreground">{u.country ?? "—"}</td>
              <td className="px-4 py-3">
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold ${
                    u.role === "admin"
                      ? "bg-pf-brand/15 text-pf-brand"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {u.role}
                </span>
              </td>
              <td className="px-4 py-3 tabular-nums text-muted-foreground">
                {u._count.challenges}
              </td>
              <td className="px-4 py-3 tabular-nums text-muted-foreground">
                {u._count.payouts}
              </td>
              <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                {new Date(u.createdAt).toLocaleDateString()}
              </td>
              <td className="px-4 py-3">
                {u.role !== "admin" && (
                  <>
                    {u.isBanned ? (
                      <button
                        onClick={() => handleUnban(u.id)}
                        disabled={pending}
                        className="text-xs px-3 py-1.5 rounded-lg border border-pf-brand/30 text-pf-brand hover:bg-pf-brand/10 transition-colors disabled:opacity-50"
                      >
                        Unban
                      </button>
                    ) : (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          placeholder="Ban reason"
                          value={banReason[u.id] ?? ""}
                          onChange={(e) =>
                            setBanReason((prev) => ({
                              ...prev,
                              [u.id]: e.target.value,
                            }))
                          }
                          className="text-xs px-2 py-1.5 rounded-lg border border-border bg-background text-foreground w-32 focus:outline-none focus:ring-1 focus:ring-pf-brand/40"
                        />
                        <button
                          onClick={() => handleBan(u.id)}
                          disabled={pending || !banReason[u.id]?.trim()}
                          className="text-xs px-3 py-1.5 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-40"
                        >
                          Ban
                        </button>
                      </div>
                    )}
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
