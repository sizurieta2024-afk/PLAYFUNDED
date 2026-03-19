"use client";

import { useState } from "react";
import { AlertCircle, CheckCircle, Clock, RotateCcw, Info } from "lucide-react";
import { requestPayout, rolloverProfits } from "@/app/actions/payouts";
import { KycForm } from "@/components/kyc/KycForm";
import type { PayoutMethod } from "@prisma/client";
import { Link } from "@/i18n/navigation";
import type { KycPayoutEligibilityCode } from "@/lib/kyc/eligibility";

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
  kycEligibilityCode: KycPayoutEligibilityCode;
  payoutCountry: string | null;
  availableMethods: PayoutMethod[];
  complianceNotice?: string | null;
  t: Record<string, string>;
  tKyc: Record<string, string>;
}

const FALLBACK_METHOD_LABELS: Record<PayoutMethod, string> = {
  bank_wire: "Bank transfer (dLocal)",
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
  kycEligibilityCode,
  payoutCountry,
  availableMethods,
  complianceNotice,
  t,
  tKyc,
}: PayoutsClientProps) {
  const [selectedChallenge, setSelectedChallenge] =
    useState<FundedChallenge | null>(fundedChallenges[0] ?? null);
  const [method, setMethod] = useState<PayoutMethod>(
    availableMethods[0] ?? "usdt",
  );
  const [loading, setLoading] = useState(false);
  const [rolloverLoading, setRolloverLoading] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const grossProfit = selectedChallenge
    ? Math.max(0, selectedChallenge.balance - selectedChallenge.startBalance)
    : 0;

  // requestedAmount state in cents, default to full gross profit
  const [requestedAmountInput, setRequestedAmountInput] = useState<string>(
    grossProfit > 0 ? (grossProfit / 100).toFixed(2) : "0.00",
  );

  const requestedAmountCents = Math.floor(
    parseFloat(requestedAmountInput || "0") * 100,
  );
  const isValidAmount =
    requestedAmountCents >= 1000 &&
    requestedAmountCents <= grossProfit;

  const payoutAmount =
    isValidAmount && selectedChallenge
      ? Math.floor(
          (requestedAmountCents * selectedChallenge.tier.profitSplitPct) / 100,
        )
      : 0;

  function getMethodLabel(m: PayoutMethod): string {
    if (m === "bank_wire") {
      if (payoutCountry === "BR") {
        return t.bankPixDlocal ?? "Pix / bank transfer (dLocal)";
      }
      return t.bankDlocal ?? "Bank transfer (dLocal)";
    }
    return t[m] ?? FALLBACK_METHOD_LABELS[m];
  }

  function getKycBlockedMessage(code: KycPayoutEligibilityCode): string {
    switch (code) {
      case "already_approved":
        return tKyc.alreadyApproved;
      case "pending_review":
        return tKyc.pendingReview;
      case "payouts_disabled_country":
        return tKyc.payoutsDisabledCountry;
      case "no_profit_available":
        return tKyc.noProfitAvailable;
      case "no_funded_challenge":
      default:
        return tKyc.noFundedChallenge;
    }
  }

  // Update requestedAmountInput when selected challenge changes
  function handleChallengeSelect(c: FundedChallenge) {
    setSelectedChallenge(c);
    const gp = Math.max(0, c.balance - c.startBalance);
    setRequestedAmountInput(gp > 0 ? (gp / 100).toFixed(2) : "0.00");
    setMessage(null);
  }

  async function handlePayout() {
    if (!selectedChallenge || !isValidAmount) return;
    if (!availableMethods.includes(method)) {
      setMessage({
        type: "error",
        text:
          t.methodUnavailable ??
          "This payout method is not available in your country right now.",
      });
      return;
    }
    setLoading(true);
    setMessage(null);
    const result = await requestPayout(
      selectedChallenge.id,
      method,
      requestedAmountCents,
    );
    setLoading(false);
    if (result.error) {
      const errMap: Record<string, string> = {
        kyc_required: t.kycRequired,
        profit_zero: t.profitZero,
        pending_exists: t.pendingExists,
        window_closed: t.windowClosed ?? "Payouts are only available on the 1st–3rd of each month.",
        below_minimum: t.belowMinimum ?? "Minimum payout is $10.",
        exceeds_profit: t.exceedsProfit ?? "Amount exceeds available profit.",
        method_unavailable:
          t.methodUnavailable ??
          "This payout method is not available in your country right now.",
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

  const canShowKycForm =
    kycEligibilityCode === "eligible" &&
    (kycStatus === null || kycStatus === "not_required" || kycStatus === "rejected");

  if (!canShowKycForm && (kycStatus === null || kycStatus === "not_required")) {
    return (
      <div className="space-y-6">
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-5">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-foreground">{t.kycRequired}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {getKycBlockedMessage(kycEligibilityCode)}
              </p>
            </div>
          </div>
        </div>
        {fundedChallenges.length === 0 && (
          <Link
            href="/challenges"
            className="inline-block px-6 py-2.5 rounded-lg bg-pf-brand text-white text-sm font-semibold hover:bg-pf-brand/90 transition-colors"
          >
            {t.buyChallenge}
          </Link>
        )}
      </div>
    );
  }

  // KYC gate
  if (kycStatus === null || kycStatus === "not_required") {
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
    if (!canShowKycForm) {
      return (
        <div className="space-y-6">
          <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-5">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-foreground">{t.kycRejected}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {getKycBlockedMessage(kycEligibilityCode)}
                </p>
              </div>
            </div>
          </div>
        </div>
      );
    }
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
        <Link
          href="/challenges"
          className="inline-block px-6 py-2.5 rounded-lg bg-pf-brand text-white text-sm font-semibold hover:bg-pf-brand/90 transition-colors"
        >
          {t.buyChallenge}
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {complianceNotice && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
          <p className="text-sm text-amber-500">{complianceNotice}</p>
        </div>
      )}

      {/* Payout window notice */}
      <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4 flex items-start gap-3">
        <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
        <p className="text-sm text-muted-foreground">
          {t.windowNotice ?? "Payouts are available on the 1st–3rd of each month."}
        </p>
      </div>

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
                onClick={() => handleChallengeSelect(c)}
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
          </div>

          {grossProfit > 0 ? (
            <>
              {/* Partial amount input */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  {t.requestAmountLabel ?? "Amount to request (USD)"}
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground text-sm">$</span>
                  <input
                    type="number"
                    min="10"
                    max={(grossProfit / 100).toFixed(2)}
                    step="0.01"
                    value={requestedAmountInput}
                    onChange={(e) => setRequestedAmountInput(e.target.value)}
                    className="flex-1 rounded-lg border border-border bg-card px-3 py-2 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-pf-brand/40"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setRequestedAmountInput((grossProfit / 100).toFixed(2))
                    }
                    className="text-xs text-pf-brand hover:underline whitespace-nowrap"
                  >
                    Max
                  </button>
                </div>
                {requestedAmountCents > 0 && requestedAmountCents < 1000 && (
                  <p className="text-xs text-red-400 mt-1">
                    {t.belowMinimum ?? "Minimum payout is $10."}
                  </p>
                )}
                {requestedAmountCents > grossProfit && (
                  <p className="text-xs text-red-400 mt-1">
                    {t.exceedsProfit ?? "Amount exceeds available profit."}
                  </p>
                )}
                {isValidAmount && (
                  <p className="text-xs text-muted-foreground mt-1">
                    You receive{" "}
                    <span className="text-pf-brand font-semibold">
                      {formatUSD(payoutAmount)}
                    </span>{" "}
                    ({selectedChallenge.tier.profitSplitPct}% of your requested amount)
                  </p>
                )}
              </div>

              {/* Payment method */}
              <div>
                <p className="text-sm font-medium text-foreground mb-3">
                  {t.payoutMethod}
                </p>
                {availableMethods.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {availableMethods.map((m) => (
                      <button
                        key={m}
                        onClick={() => setMethod(m)}
                        className={`p-3 rounded-xl border text-xs font-medium text-center transition-all ${
                          method === m
                            ? "border-pf-brand bg-pf-brand/10 text-pf-brand"
                            : "border-border text-muted-foreground hover:border-pf-brand/40"
                        }`}
                      >
                        {getMethodLabel(m)}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {t.methodUnavailable ??
                      "This payout method is not available in your country right now."}
                  </p>
                )}
                {availableMethods.includes("bank_wire") && (
                  <p className="text-xs text-muted-foreground mt-2">
                    {t.usdSettlementNote ??
                      "Local-currency delivery where supported. All payouts are settled in USD."}
                  </p>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-3 flex-wrap">
                <button
                  onClick={handlePayout}
                  disabled={loading || !isValidAmount || availableMethods.length === 0}
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
                        : getMethodLabel(
                            (p.method as PayoutMethod) ?? "bank_wire",
                          )}
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
