"use client";

import { useState, useTransition } from "react";
import { adminUpdateKyc } from "@/app/actions/admin";
import { ExternalLink } from "lucide-react";

interface KycRow {
  id: string;
  status: string;
  fullName: string;
  dateOfBirth: string;
  country: string;
  idType: string;
  idFrontSignedUrl: string | null;
  idBackSignedUrl: string | null;
  createdAt: string;
  reviewNote: string | null;
  user: { email: string; name: string | null };
}

export function AdminKycQueue({ submissions }: { submissions: KycRow[] }) {
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  function handle(id: string, action: "approve" | "reject") {
    startTransition(async () => {
      await adminUpdateKyc(id, action, notes[id]);
    });
  }

  if (submissions.length === 0) {
    return <p className="text-sm text-muted-foreground py-8 text-center">No submissions in this status.</p>;
  }

  return (
    <div className="space-y-4">
      {submissions.map((s) => (
        <div key={s.id} className="rounded-xl border border-border bg-card p-5 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-semibold text-foreground">{s.fullName}</p>
              <p className="text-xs text-muted-foreground">{s.user.email}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {s.idType.replace("_", " ")} · {s.country} · DOB:{" "}
                {new Date(s.dateOfBirth).toLocaleDateString()} · Submitted:{" "}
                {new Date(s.createdAt).toLocaleDateString()}
              </p>
              {s.reviewNote && (
                <p className="text-xs text-amber-400 mt-1">Note: {s.reviewNote}</p>
              )}
            </div>
            <span className={`px-2 py-0.5 rounded-md text-xs font-semibold ${
              s.status === "approved" ? "bg-pf-brand/15 text-pf-brand" :
              s.status === "rejected" ? "bg-red-500/15 text-red-400" :
              "bg-amber-500/15 text-amber-400"
            }`}>{s.status}</span>
          </div>

          {/* Document links */}
          <div className="flex gap-3 flex-wrap">
            {s.idFrontSignedUrl && (
              <a
                href={s.idFrontSignedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              >
                <ExternalLink className="w-3 h-3" />
                Front document
              </a>
            )}
            {s.idBackSignedUrl && (
              <a
                href={s.idBackSignedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              >
                <ExternalLink className="w-3 h-3" />
                Back document
              </a>
            )}
          </div>

          {s.status === "pending" && (
            <div className="flex flex-wrap gap-2">
              <input
                type="text"
                placeholder="Review note (optional)"
                value={notes[s.id] ?? ""}
                onChange={(e) => setNotes((prev) => ({ ...prev, [s.id]: e.target.value }))}
                className="flex-1 min-w-48 text-xs px-3 py-2 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none"
              />
              <button
                onClick={() => handle(s.id, "approve")}
                disabled={pending}
                className="text-xs px-4 py-2 rounded-lg bg-pf-brand text-white font-semibold hover:bg-pf-brand/90 transition-colors disabled:opacity-50"
              >
                Approve
              </button>
              <button
                onClick={() => handle(s.id, "reject")}
                disabled={pending}
                className="text-xs px-4 py-2 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
              >
                Reject
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
