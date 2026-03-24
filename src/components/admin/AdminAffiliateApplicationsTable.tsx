"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { adminReviewAffiliateApplication } from "@/app/actions/admin";
import type { AffiliateCommissionRate } from "@prisma/client";

interface Application {
  id: string;
  fullName: string;
  country: string;
  reason: string;
  socialHandles: Record<string, string | null> | null;
  audienceSize: string | null;
  website: string | null;
  createdAt: string;
  user: { email: string; name: string | null };
}

export function AdminAffiliateApplicationsTable({
  applications,
}: {
  applications: Application[];
}) {
  const router = useRouter();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [messages, setMessages] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  function handle(id: string, action: "approve" | "reject", note?: string) {
    startTransition(async () => {
      const result = await adminReviewAffiliateApplication(id, action, {
        rate: "five" as AffiliateCommissionRate,
        discountPct: 10,
        reviewNote: note,
      });
      if (result.error) {
        setMessages((prev) => ({ ...prev, [id]: result.error! }));
      } else {
        router.refresh();
      }
    });
  }

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/30">
            <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">
              Applicant
            </th>
            <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">
              Country
            </th>
            <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">
              Audience
            </th>
            <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">
              Date
            </th>
            <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {applications.map((app) => (
            <>
              <tr
                key={app.id}
                className="border-b border-border last:border-0 cursor-pointer hover:bg-muted/10"
                onClick={() =>
                  setExpanded((v) => (v === app.id ? null : app.id))
                }
              >
                <td className="px-4 py-3">
                  <p className="font-medium text-foreground">{app.fullName}</p>
                  <p className="text-xs text-muted-foreground">
                    {app.user.email}
                  </p>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {app.country}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {app.audienceSize?.replace(/_/g, " ") ?? "—"}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {new Date(app.createdAt).toLocaleDateString()}
                </td>
                <td className="px-4 py-3">
                  <div
                    className="flex gap-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => handle(app.id, "approve")}
                      disabled={pending}
                      className="px-3 py-1 rounded-lg bg-pf-brand/10 text-pf-brand text-xs font-medium hover:bg-pf-brand/20 transition-colors disabled:opacity-40"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => {
                        const note = prompt("Rejection reason (optional):");
                        handle(app.id, "reject", note ?? undefined);
                      }}
                      disabled={pending}
                      className="px-3 py-1 rounded-lg bg-red-500/10 text-red-400 text-xs font-medium hover:bg-red-500/20 transition-colors disabled:opacity-40"
                    >
                      Reject
                    </button>
                  </div>
                  {messages[app.id] && (
                    <p className="text-xs text-red-400 mt-1">
                      {messages[app.id]}
                    </p>
                  )}
                </td>
              </tr>
              {expanded === app.id && (
                <tr
                  key={`${app.id}-detail`}
                  className="border-b border-border bg-muted/5"
                >
                  <td colSpan={5} className="px-4 py-4 space-y-3">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                        Why they want to be an affiliate
                      </p>
                      <p className="text-sm text-foreground whitespace-pre-wrap">
                        {app.reason}
                      </p>
                    </div>
                    {app.socialHandles && (
                      <div className="flex flex-wrap gap-3">
                        {Object.entries(app.socialHandles).map(
                          ([platform, handle]) =>
                            handle ? (
                              <span
                                key={platform}
                                className="text-xs bg-secondary px-2 py-1 rounded-md text-muted-foreground"
                              >
                                {platform}: {handle}
                              </span>
                            ) : null,
                        )}
                      </div>
                    )}
                    {app.website && (
                      <p className="text-xs text-muted-foreground">
                        Website: {app.website}
                      </p>
                    )}
                  </td>
                </tr>
              )}
            </>
          ))}
        </tbody>
      </table>
    </div>
  );
}
