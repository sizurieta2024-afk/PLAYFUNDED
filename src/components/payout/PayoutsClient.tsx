"use client";

import { useState } from "react";
import { AlertCircle, CheckCircle, Clock, RotateCcw } from "lucide-react";
import { requestPayout, rolloverProfits } from "@/app/actions/payouts";
import { KycForm } from "@/components/kyc/KycForm";
import type { PayoutMethod } from "@prisma/client";

type KycStatus = "not_required" | "pending" | "approved" | "rejected" | null;

interface FundedChallenge {
  id: string;
  balance: number;
  startBalance: number;
  tier: { profitSplitPct: number; name: string };
}

interface PayoutRecord {
  id: string;
  amount: number;
  splitPct: number;
  method: string;
  status: string;
  isRollover: boolean;
  requestedAt: string;
  txRef: string | null;
  adminNote: string | null;
}

interface PayoutsClientProps {
  fundedChallenges: FundedChallenge[];
  pastPayouts: PayoutRecord[];
  kycStatus: KycStatus;
  t: Record<string, string>;
  tKyc: Record<string, string>;
}

const METHOD_LABELS: Record<PayoutMethod, string> = {
  bank_wire: "Bank wire",
  usdt: "USDT (TRC-20)",
  usdc: "USDC (ERC-20)",
  btc: "Bitcoin",
  paypal: "PayPal",
};

function formatUSD(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

export function PayoutsClient({
  fundedChallenges,
  pastPayouts,
  kycStatus,
  t,
  tKyc,
}: PayoutsClientProps) {
  const [selectedChallenge, setSelectedChallenge] =
    useState<FundedChallenge | null>(fundedChallenges[0] ?? null);
  const [method, setMethod] = useState<PayoutMethod>("usdt");
  const [loading, setLoading] = useState(false);
  const [rolloverLoading, setRolloverLoading] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const grossProfit = selectedChallenge
    ? Math.max(0, selectedChallenge.balance - selectedChallenge.startBalance)
    : 0;
  const payoutAmount = selectedChallenge
    ? Math.floor((grossProfit * selectedChallenge.tier.profitSplitPct) / 100)
    : 0;

  async function handlePayout() {
    if (!selectedChallenge) return;
    setLoading(true);
    setMessage(null);
    const result = await requestPayout(selectedChallenge.id, method);
    setLoading(false);
    if (result.error) {
      const errMap: Record<string, string> = {
        kyc_required: t.kycRequired,
        profit_zero: t.profitZero,
        pending_exists: t.pendingExists,
      };
      setMessage({
        type: "error",
        text: errMap[result.error] ?? result.error,
      });
    } else {
      setMessage({ type: "success", text: t.submitted });
    }
  }

  async function handleRollover() {
    if (!selectedChallenge) return;
    setRolloverLoading(true);
    setMessage(null);
    const result = await rolloverProfits(selectedChallenge.id);
    setRolloverLoading(false);
    if (result.error) {
      setMessage({ type: "error", text: result.error });
    } else {
      setMessage({ type: "success", text: t.submitted });
    }
  }

  // KYC gate
  if (kycStatus === null || kycStatus === "not_required") {
    // no submission yet — show form
    return (
      <div className="space-y-6">
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-5">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-foreground">
                {t.kycRequired}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {t.kycRequiredDesc}
              </p>
            </div>
          </div>
        </div>
        <KycForm t={tKyc} />
      </div>
    );
  }

  if (kycStatus === "pending") {
    return (
      <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-6 flex items-start gap-3">
        <Clock className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold text-foreground">{t.kycPending}</p>
          <p className="text-sm text-muted-foreground mt-1">
            {t.kycPendingDesc}
          </p>
        </div>
      </div>
    );
  }

  if (kycStatus === "rejected") {
    return (
      <div className="space-y-6">
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-5">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-foreground">{t.kycRejected}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {t.kycRejectedDesc}
              </p>
            </div>
          </div>
        </div>
        <KycForm t={tKyc} />
      </div>
    );
  }

  // KYC approved — show payout UI
  if (fundedChallenges.length === 0) {
    return (
      <div className="text-center py-12 space-y-4">
        <p className="text-muted-foreground">{t.noPayout}</p>
        <a
          href="/challenges"
          className="inline-block px-6 py-2.5 rounded-lg bg-pf-brand text-white text-sm font-semibold hover:bg-pf-brand/90 transition-colors"
        >
          {t.buyChallenge}
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Challenge selector */}
      {fundedChallenges.length > 1 && (
        <div>
          <p className="text-sm font-medium text-foreground mb-2">
            Select challenge
          </p>
          <div className="flex gap-2 flex-wrap">
            {fundedChallenges.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedChallenge(c)}
                className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                  selectedChallenge?.id === c.id
                    ? "border-pf-brand bg-pf-brand/10 text-pf-brand"
                    : "border-border text-muted-foreground hover:border-pf-brand/40"
                }`}
              >
                {c.tier.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {selectedChallenge && (
        <>
          {/* Profit summary */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground mb-1">
                {t.availableProfit}
              </p>
              <p className="text-xl font-bold tabular-nums">
                {formatUSD(grossProfit)}
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground mb-1">
                {t.yourSplit.replace(
                  "{pct}",
                  String(selectedChallenge.tier.profitSplitPct),
                )}
              </p>
              <p className="text-xl font-bold tabular-nums text-pf-brand">
                {formatUSD(payoutAmount)}
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground mb-1">
                {t.payoutAmount}
              </p>
              <p className="text-xl font-bold tabular-nums">
                {formatUSD(payoutAmount)}
              </p>
            </div>
          </div>

          {payoutAmount > 0 ? (
            <>
              {/* Payment method */}
              <div>
                <p className="text-sm font-medium text-foreground mb-3">
                  {t.payoutMethod}
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {(Object.keys(METHOD_LABELS) as PayoutMethod[]).map((m) => (
                    <button
                      key={m}
                      onClick={() => setMethod(m)}
                      className={`p-3 rounded-xl border text-xs font-medium text-center transition-all ${
                        method === m
                          ? "border-pf-brand bg-pf-brand/10 text-pf-brand"
                          : "border-border text-muted-foreground hover:border-pf-brand/40"
                      }`}
                    >
                      {METHOD_LABELS[m]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 flex-wrap">
                <button
                  onClick={handlePayout}
                  disabled={loading}
                  className="flex-1 rounded-xl bg-pf-brand hover:bg-pf-brand/90 disabled:opacity-60 text-white font-semibold py-3 text-sm transition-colors"
                >
                  {loading ? t.submitting : t.requestPayout}
                </button>
                <button
                  onClick={handleRollover}
                  disabled={rolloverLoading}
                  className="flex items-center gap-2 px-5 py-3 rounded-xl border border-border hover:border-pf-brand/40 text-muted-foreground hover:text-foreground text-sm font-medium transition-all disabled:opacity-60"
                >
                  <RotateCcw className="w-4 h-4" />
                  {rolloverLoading ? t.submitting : t.rollover}
                </button>
              </div>

              {/* Rollover description */}
              <p className="text-xs text-muted-foreground">{t.rolloverDesc}</p>
            </>
          ) : (
            <div className="rounded-xl border border-border bg-card p-5 text-center">
              <p className="text-sm text-muted-foreground">{t.profitZero}</p>
            </div>
          )}
        </>
      )}

      {/* Message feedback */}
      {message && (
        <div
          className={`flex items-center gap-2 text-sm rounded-xl p-4 border ${
            message.type === "success"
              ? "border-pf-brand/30 bg-pf-brand/10 text-pf-brand"
              : "border-red-500/30 bg-red-500/10 text-red-400"
          }`}
        >
          {message.type === "success" ? (
            <CheckCircle className="w-4 h-4 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0" />
          )}
          {message.text}
        </div>
      )}

      {/* Payout history */}
      <div>
        <h2 className="text-base font-semibold mb-4">{t.history}</h2>
        {pastPayouts.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t.noPastPayouts}</p>
        ) : (
          <div className="rounded-xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">
                    {t.date}
                  </th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">
                    {t.amount}
                  </th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">
                    {t.method}
                  </th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {pastPayouts.map((p) => (
                  <tr key={p.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(p.requestedAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 font-semibold tabular-nums">
                      {formatUSD(p.amount)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {p.isRollover
                        ? t.isRollover
                        : (METHOD_LABELS[p.method as PayoutMethod] ?? p.method)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={p.status} t={t} />
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

function StatusBadge({
  status,
  t,
}: {
  status: string;
  t: Record<string, string>;
}) {
  const map: Record<string, string> = {
    pending: "bg-amber-500/15 text-amber-400",
    processing: "bg-blue-500/15 text-blue-400",
    paid: "bg-pf-brand/15 text-pf-brand",
    failed: "bg-red-500/15 text-red-400",
  };
  const label = t[`status_${status}`] ?? status;
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold ${map[status] ?? "bg-muted text-muted-foreground"}`}
    >
      {label}
    </span>
  );
}
