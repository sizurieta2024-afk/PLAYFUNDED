"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { adminReviewCodeChangeRequest } from "@/app/actions/admin";

interface CodeRequest {
  id: string;
  requestedCode: string;
  currentCode: string;
  affiliateEmail: string;
  createdAt: string;
}

export function AdminAffiliateCodeRequestsTable({
  requests,
}: {
  requests: CodeRequest[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handle(id: string, action: "approve" | "reject") {
    startTransition(async () => {
      await adminReviewCodeChangeRequest(id, action);
      router.refresh();
    });
  }

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/30">
            <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">
              Affiliate
            </th>
            <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">
              Current Code
            </th>
            <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">
              Requested Code
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
          {requests.map((req) => (
            <tr key={req.id} className="border-b border-border last:border-0">
              <td className="px-4 py-3 text-muted-foreground">
                {req.affiliateEmail}
              </td>
              <td className="px-4 py-3 font-mono text-muted-foreground">
                {req.currentCode}
              </td>
              <td className="px-4 py-3 font-mono font-semibold text-pf-brand">
                {req.requestedCode}
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                {new Date(req.createdAt).toLocaleDateString()}
              </td>
              <td className="px-4 py-3">
                <div className="flex gap-2">
                  <button
                    onClick={() => handle(req.id, "approve")}
                    disabled={pending}
                    className="px-3 py-1 rounded-lg bg-pf-brand/10 text-pf-brand text-xs font-medium hover:bg-pf-brand/20 transition-colors disabled:opacity-40"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => handle(req.id, "reject")}
                    disabled={pending}
                    className="px-3 py-1 rounded-lg bg-red-500/10 text-red-400 text-xs font-medium hover:bg-red-500/20 transition-colors disabled:opacity-40"
                  >
                    Reject
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
