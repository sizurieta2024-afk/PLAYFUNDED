"use client";

import { useState, useTransition } from "react";
import { banUser, unbanUser } from "@/app/actions/admin";

interface Props {
  userId: string;
  isBanned: boolean;
  banReason: string | null;
  role: string;
}

export function AdminUserActions({ userId, isBanned, role }: Props) {
  const [pending, startTransition] = useTransition();
  const [reason, setReason] = useState("");
  const [showBanForm, setShowBanForm] = useState(false);

  function handleBan() {
    if (!reason.trim()) return;
    startTransition(async () => {
      await banUser(userId, reason.trim());
      window.location.reload();
    });
  }

  function handleUnban() {
    startTransition(async () => {
      await unbanUser(userId);
      window.location.reload();
    });
  }

  if (role === "admin") return null;

  return (
    <div className="flex items-center gap-2 shrink-0">
      {isBanned ? (
        <button
          onClick={handleUnban}
          disabled={pending}
          className="px-4 py-2 text-sm font-medium rounded-lg border border-pf-brand/30 text-pf-brand hover:bg-pf-brand/10 transition-colors disabled:opacity-40"
        >
          Unban user
        </button>
      ) : (
        <>
          {showBanForm ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Ban reason (required)"
                className="text-sm px-3 py-2 rounded-lg border border-border bg-background text-foreground w-48 focus:outline-none focus:ring-1 focus:ring-red-500/40"
              />
              <button
                onClick={handleBan}
                disabled={pending || !reason.trim()}
                className="px-4 py-2 text-sm font-medium rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-40"
              >
                Confirm ban
              </button>
              <button
                onClick={() => setShowBanForm(false)}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowBanForm(true)}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-border text-muted-foreground hover:border-red-500/30 hover:text-red-400 transition-colors"
            >
              Ban user
            </button>
          )}
        </>
      )}
    </div>
  );
}
