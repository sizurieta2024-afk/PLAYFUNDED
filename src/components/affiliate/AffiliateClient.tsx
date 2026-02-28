"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { becomeAffiliate, requestAffiliatePayout } from "@/app/actions/affiliate";
import type { PayoutMethod } from "@prisma/client";

interface AffiliateData {
  id: string;
  code: string;
  commissionRate: "five" | "ten";
  totalClicks: number;
  totalConversions: number;
  totalEarned: number;
  pendingPayout: number;
  conversions: {
    id: string;
    conversionAmount: number | null;
    commissionEarned: number | null;
    createdAt: string;
  }[];
}

const PAYOUT_METHODS: { value: PayoutMethod; labelKey: string }[] = [
  { value: "bank_wire", labelKey: "bankWire" },
  { value: "usdt", labelKey: "usdt" },
  { value: "usdc", labelKey: "usdc" },
  { value: "btc", labelKey: "btc" },
  { value: "paypal", labelKey: "paypal" },
];

function formatUSD(cents: number) {
  return `$${(cents / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className="text-2xl font-bold tabular-nums text-foreground">{value}</p>
    </div>
  );
}

export function AffiliateClient({
  affiliate: initial,
  appUrl,
}: {
  affiliate: AffiliateData | null;
  appUrl: string;
}) {
  const t = useTranslations("affiliate");
  const [affiliate, setAffiliate] = useState(initial);
  const [method, setMethod] = useState<PayoutMethod>("usdt");
  const [copied, setCopied] = useState(false);
  const [payoutSubmitted, setPayoutSubmitted] = useState(false);
  const [payoutError, setPayoutError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const refLink = affiliate
    ? `${appUrl}/ref/${affiliate.code}`
    : "";

  function copyLink() {
    navigator.clipboard.writeText(refLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function handleBecomeAffiliate() {
    startTransition(async () => {
      const result = await becomeAffiliate();
      if (result.code) {
        // Refresh page to get full affiliate data
        window.location.reload();
      }
    });
  }

  function handleRequestPayout() {
    setPayoutError(null);
    startTransition(async () => {
      const result = await requestAffiliatePayout(method);
      if (result.error) {
        setPayoutError(result.error);
      } else {
        setPayoutSubmitted(true);
      }
    });
  }

  // Not yet an affiliate — show join CTA
  if (!affiliate) {
    return (
      <div className="space-y-8">
        {/* Hero join */}
        <div className="rounded-2xl border border-border bg-card p-8 text-center space-y-4">
          <div className="w-14 h-14 rounded-full bg-pf-brand/10 flex items-center justify-center mx-auto text-2xl">
            💰
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">
              {t("becomeAffiliate")}
            </h2>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
              {t("becomeAffiliateDesc")}
            </p>
          </div>
          <button
            onClick={handleBecomeAffiliate}
            disabled={pending}
            className="px-6 py-2.5 rounded-xl bg-pf-brand text-white font-semibold text-sm hover:bg-pf-brand/90 transition-colors disabled:opacity-50"
          >
            {pending ? t("submitting") : t("becomeAffiliate")}
          </button>
        </div>

        {/* How it works */}
        <HowItWorks />
      </div>
    );
  }

  const ratePct = affiliate.commissionRate === "ten" ? "10%" : "5%";

  return (
    <div className="space-y-8">
      {/* Referral link */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-foreground">{t("yourLink")}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t("yourCode")}:{" "}
              <span className="font-mono text-pf-brand">{affiliate.code}</span>{" "}
              · {ratePct} commission
            </p>
          </div>
          <button
            onClick={copyLink}
            className="px-4 py-2 rounded-lg border border-border text-xs font-medium hover:bg-secondary transition-colors"
          >
            {copied ? t("copied") : t("copyLink")}
          </button>
        </div>
        <div className="flex items-center gap-2 bg-muted rounded-lg px-3 py-2">
          <p className="text-xs font-mono text-muted-foreground truncate flex-1">
            {refLink}
          </p>
        </div>
      </div>

      {/* Stats */}
      <div>
        <h2 className="text-sm font-semibold text-foreground mb-3">{t("stats")}</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label={t("clicks")} value={affiliate.totalClicks.toString()} />
          <StatCard label={t("conversions")} value={affiliate.totalConversions.toString()} />
          <StatCard label={t("lifetimeEarned")} value={formatUSD(affiliate.totalEarned)} />
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
            <p className="text-xs text-amber-400 mb-1">{t("pendingPayout")}</p>
            <p className="text-2xl font-bold tabular-nums text-amber-400">
              {formatUSD(affiliate.pendingPayout)}
            </p>
          </div>
        </div>
      </div>

      {/* Payout request */}
      {affiliate.pendingPayout > 0 && !payoutSubmitted && (
        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <h2 className="text-sm font-semibold text-foreground">{t("requestPayout")}</h2>
          <div className="flex flex-wrap gap-2 items-center">
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value as PayoutMethod)}
              className="text-sm px-3 py-2 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-pf-brand/40"
            >
              {PAYOUT_METHODS.map((m) => (
                <option key={m.value} value={m.value}>
                  {t(m.labelKey as Parameters<typeof t>[0])}
                </option>
              ))}
            </select>
            <button
              onClick={handleRequestPayout}
              disabled={pending}
              className="px-5 py-2 rounded-xl bg-pf-brand text-white font-semibold text-sm hover:bg-pf-brand/90 transition-colors disabled:opacity-50"
            >
              {pending ? t("submitting") : `${t("requestPayout")} · ${formatUSD(affiliate.pendingPayout)}`}
            </button>
          </div>
          {payoutError && (
            <p className="text-xs text-red-400">
              {payoutError === "pending_exists" ? t("pendingExists") : payoutError}
            </p>
          )}
        </div>
      )}

      {payoutSubmitted && (
        <div className="rounded-xl border border-pf-brand/30 bg-pf-brand/5 px-5 py-4">
          <p className="text-sm font-medium text-pf-brand">{t("submitted")}</p>
        </div>
      )}

      {/* Conversion history */}
      <div>
        <h2 className="text-sm font-semibold text-foreground mb-3">{t("history")}</h2>
        {affiliate.conversions.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            {t("noHistory")}
          </p>
        ) : (
          <div className="rounded-xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  {[t("date"), t("conversionAmount"), t("commission")].map((h) => (
                    <th
                      key={h}
                      className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {affiliate.conversions.map((c) => (
                  <tr key={c.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(c.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-xs">
                      {c.conversionAmount ? formatUSD(c.conversionAmount) : "—"}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-xs font-semibold text-pf-brand">
                      {c.commissionEarned ? `+${formatUSD(c.commissionEarned)}` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <HowItWorks />
    </div>
  );
}

function HowItWorks() {
  const t = useTranslations("affiliate");
  const steps = [
    { n: "1", title: t("step1"), desc: t("step1Desc") },
    { n: "2", title: t("step2"), desc: t("step2Desc") },
    { n: "3", title: t("step3"), desc: t("step3Desc") },
  ];
  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <h2 className="text-sm font-semibold text-foreground">{t("howItWorks")}</h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {steps.map((s) => (
          <div key={s.n} className="space-y-1.5">
            <div className="w-7 h-7 rounded-full bg-pf-brand/15 text-pf-brand text-xs font-bold flex items-center justify-center">
              {s.n}
            </div>
            <p className="text-sm font-medium text-foreground">{s.title}</p>
            <p className="text-xs text-muted-foreground leading-relaxed">{s.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
