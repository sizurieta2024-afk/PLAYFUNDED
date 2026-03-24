"use client";

import { useState, useTransition } from "react";
import { Copy, Check, AlertCircle, Clock } from "lucide-react";
import { requestAffiliateCodeChange } from "@/app/actions/affiliate";

interface Conversion {
  id: string;
  paidAmount: number;
  commissionEarned: number;
  createdAt: Date | string;
}

interface CodeRequest {
  id: string;
  requestedCode: string;
  createdAt: Date | string;
}

interface AffiliateData {
  id: string;
  code: string;
  discountPct: number;
  commissionRate: string;
  isActive: boolean;
  totalClicks: number;
  totalConversions: number;
  totalEarned: number;
  pendingPayout: number;
  createdAt: Date | string;
  conversions: Conversion[];
  codeRequests: CodeRequest[];
}

function formatUSD(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

function commissionLabel(rate: string) {
  if (rate === "ten") return "10%";
  return "5%";
}

export function AffiliateClient({
  affiliate,
  appUrl,
  t,
}: {
  affiliate: AffiliateData;
  appUrl: string;
  t: Record<string, string>;
}) {
  const referralUrl = `${appUrl}?ref=${affiliate.code}`;
  const [copied, setCopied] = useState(false);
  const [newCode, setNewCode] = useState("");
  const [codeMsg, setCodeMsg] = useState<{ ok: boolean; text: string } | null>(
    null,
  );
  const [pending, startTransition] = useTransition();

  const hasPendingRequest = affiliate.codeRequests.length > 0;

  function handleCopy() {
    navigator.clipboard.writeText(referralUrl).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleCodeRequest() {
    if (!newCode.trim()) return;
    startTransition(async () => {
      const res = await requestAffiliateCodeChange(newCode);
      if (res.error) {
        const errMap: Record<string, string> = {
          code_taken: t.codeTaken,
          same_code: t.sameCode,
          invalid_code: t.invalidCode,
          request_pending: t.codeChangePending,
        };
        setCodeMsg({ ok: false, text: errMap[res.error] ?? res.error });
      } else {
        setCodeMsg({ ok: true, text: t.codeChangeSuccess });
        setNewCode("");
      }
    });
  }

  return (
    <div className="space-y-6">
      {!affiliate.isActive && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 flex items-start gap-3">
          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-400">{t.inactiveNotice}</p>
        </div>
      )}

      {/* Referral link */}
      <div className="rounded-xl border border-border bg-card p-6 space-y-4">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-mono mb-1">
            {t.yourCode}
          </p>
          <p className="font-mono text-2xl font-bold text-pf-brand">
            {affiliate.code}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-2">{t.referralLink}</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs bg-secondary px-3 py-2 rounded-lg border border-border text-muted-foreground truncate font-mono">
              {referralUrl}
            </code>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border hover:border-pf-brand/40 text-muted-foreground hover:text-foreground text-xs font-medium transition-all"
            >
              {copied ? (
                <Check className="w-3.5 h-3.5 text-pf-brand" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
              {copied ? t.copied : t.copyLink}
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {
            label: t.totalClicks,
            value: affiliate.totalClicks.toLocaleString(),
          },
          {
            label: t.totalConversions,
            value: affiliate.totalConversions.toLocaleString(),
          },
          { label: t.totalEarned, value: formatUSD(affiliate.totalEarned) },
          { label: t.pendingPayout, value: formatUSD(affiliate.pendingPayout) },
        ].map(({ label, value }) => (
          <div
            key={label}
            className="rounded-xl border border-border bg-card p-4"
          >
            <p className="text-xs text-muted-foreground mb-1">{label}</p>
            <p className="font-semibold tabular-nums text-foreground">
              {value}
            </p>
          </div>
        ))}
      </div>

      {/* Terms */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground mb-1">
            {t.discountOffered}
          </p>
          <p className="font-semibold text-pf-brand">
            {affiliate.discountPct}% off
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground mb-1">
            {t.commissionRate}
          </p>
          <p className="font-semibold text-pf-brand">
            {commissionLabel(affiliate.commissionRate)}
          </p>
        </div>
      </div>

      {/* Code change request */}
      <div className="rounded-xl border border-border bg-card p-6 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground">
            {t.changeCode}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t.changeCodeDesc}
          </p>
        </div>

        {hasPendingRequest ? (
          <div className="flex items-center gap-2 text-sm text-amber-400">
            <Clock className="w-4 h-4 shrink-0" />
            <span>
              {t.pendingCodeRequest}:{" "}
              <strong className="font-mono">
                {affiliate.codeRequests[0].requestedCode}
              </strong>
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newCode}
              onChange={(e) => {
                setNewCode(
                  e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ""),
                );
                setCodeMsg(null);
              }}
              placeholder={t.changeCodePlaceholder}
              maxLength={20}
              className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono uppercase focus:outline-none focus:ring-1 focus:ring-pf-pink/40"
            />
            <button
              onClick={handleCodeRequest}
              disabled={pending || !newCode.trim()}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-pf-pink text-white hover:bg-pf-pink-dark transition-colors disabled:opacity-40"
            >
              {t.requestChange}
            </button>
          </div>
        )}

        {codeMsg && (
          <p
            className={`text-xs ${codeMsg.ok ? "text-pf-brand" : "text-red-400"}`}
          >
            {codeMsg.text}
          </p>
        )}
      </div>

      {/* Conversion history */}
      <div>
        <h2 className="text-base font-display font-bold text-foreground mb-4">
          {t.conversionsHistory}
        </h2>
        {affiliate.conversions.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t.noConversions}</p>
        ) : (
          <div className="rounded-xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">
                    Date
                  </th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">
                    Sale
                  </th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">
                    Your cut
                  </th>
                </tr>
              </thead>
              <tbody>
                {affiliate.conversions.map((c) => (
                  <tr
                    key={c.id}
                    className="border-b border-border last:border-0"
                  >
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(c.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 tabular-nums">
                      {formatUSD(c.paidAmount)}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-pf-brand font-semibold">
                      {formatUSD(c.commissionEarned)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
