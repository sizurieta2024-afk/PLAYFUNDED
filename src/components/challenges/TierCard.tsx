"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import {
  Check,
  Zap,
  Star,
  Crown,
  TrendingUp,
  CreditCard,
  X,
} from "lucide-react";
import type { Tier } from "@prisma/client";

interface TierTranslations {
  fundedBankroll: string;
  profitSplit: string;
  entryFee: string;
  minPicks: string;
  guideIncluded: string;
  buyButton: string;
  popular: string;
  phase1Target: string;
  phase2Target: string;
  dailyLoss: string;
  drawdown: string;
  loginRequired: string;
  redirecting: string;
  yes: string;
  no: string;
  // payment method
  selectPaymentMethod: string;
  card: string;
  crypto: string;
  cryptoSelectCurrency: string;
  usdt: string;
  usdc: string;
  btc: string;
  payWith: string;
}

interface TierCardProps {
  tier: Tier;
  isAuthenticated: boolean;
  locale: string;
  description: string;
  t: TierTranslations;
}

const TIER_CONFIG: Record<
  string,
  { icon: React.ReactNode; gradient: string; badge: string; isPopular: boolean }
> = {
  Starter: {
    icon: <TrendingUp className="w-5 h-5" />,
    gradient:
      "from-emerald-500/10 to-transparent border-emerald-500/20 hover:border-emerald-500/40",
    badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    isPopular: false,
  },
  Pro: {
    icon: <Zap className="w-5 h-5" />,
    gradient:
      "from-blue-500/10 to-transparent border-blue-500/20 hover:border-blue-500/40",
    badge: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    isPopular: false,
  },
  Elite: {
    icon: <Star className="w-5 h-5" />,
    gradient:
      "from-purple-500/10 to-transparent border-purple-500/30 hover:border-purple-500/50",
    badge: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    isPopular: true,
  },
  Master: {
    icon: <Crown className="w-5 h-5" />,
    gradient:
      "from-orange-500/10 to-transparent border-orange-500/20 hover:border-orange-500/40",
    badge: "bg-orange-500/10 text-orange-400 border-orange-500/20",
    isPopular: false,
  },
  Legend: {
    icon: <Crown className="w-5 h-5" />,
    gradient:
      "from-yellow-500/10 to-transparent border-yellow-500/20 hover:border-yellow-500/40",
    badge: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    isPopular: false,
  },
};

const DEFAULT_CONFIG = {
  icon: <TrendingUp className="w-5 h-5" />,
  gradient:
    "from-pf-brand/10 to-transparent border-pf-brand/20 hover:border-pf-brand/40",
  badge: "bg-pf-brand/10 text-pf-brand border-pf-brand/20",
  isPopular: false,
};

function formatUSD(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

type PaymentMethod = "stripe" | "crypto";
type CryptoCurrency = "usdttrc20" | "usdcerc20" | "btc";

export function TierCard({
  tier,
  isAuthenticated,
  locale,
  description,
  t,
}: TierCardProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showMethodSelector, setShowMethodSelector] = useState(false);
  const [selectedCrypto, setSelectedCrypto] =
    useState<CryptoCurrency>("usdttrc20");
  const router = useRouter();
  const config = TIER_CONFIG[tier.name] ?? DEFAULT_CONFIG;

  async function handleBuy() {
    if (!isAuthenticated) {
      router.push("/auth/login");
      return;
    }
    setError(null);
    setShowMethodSelector(true);
  }

  async function handlePayment(method: PaymentMethod) {
    setShowMethodSelector(false);
    setLoading(true);
    setError(null);

    try {
      const endpoint =
        method === "stripe"
          ? "/api/checkout/stripe"
          : "/api/checkout/nowpayments";

      const body: Record<string, string> = { tierId: tier.id, locale };
      if (method === "crypto") body.currency = selectedCrypto;

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = (await res.json()) as {
        url?: string;
        address?: string;
        error?: string;
        code?: string;
      };

      if (!res.ok) {
        setLoading(false);
        setError(data.error ?? "Payment failed. Please try again.");
        return;
      }

      if (data.url) {
        window.location.href = data.url;
      } else if (data.address) {
        const params = new URLSearchParams(
          Object.entries(data as Record<string, string>).filter(
            ([, v]) => v != null,
          ),
        );
        router.push(`/checkout/crypto?${params.toString()}`);
      } else {
        setLoading(false);
        setError("Unexpected response. Please try again.");
      }
    } catch {
      setLoading(false);
      setError("Network error. Please check your connection.");
    }
  }

  return (
    <>
      <div
        className={`relative flex flex-col h-full rounded-2xl border bg-gradient-to-b p-6 transition-all duration-200 ${config.gradient}`}
      >
        {config.isPopular && (
          <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-3 py-0.5 text-xs font-semibold ${config.badge}`}
            >
              <Star className="w-3 h-3 fill-current" />
              {t.popular}
            </span>
          </div>
        )}

        <div className="flex items-center gap-3 mb-4">
          <div
            className={`flex items-center justify-center w-10 h-10 rounded-xl border ${config.badge}`}
          >
            {config.icon}
          </div>
          <div>
            <h2 className="font-bold text-foreground leading-tight">
              {tier.name}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {description}
            </p>
          </div>
        </div>

        <div className="mb-6">
          <span className="text-4xl font-extrabold text-foreground tracking-tight">
            {formatUSD(tier.fee)}
          </span>
          <span className="text-sm text-muted-foreground ml-1">USD</span>
        </div>

        <dl className="space-y-3 text-sm mb-6 flex-1">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">{t.fundedBankroll}</dt>
            <dd className="font-semibold text-foreground">
              {formatUSD(tier.fundedBankroll)}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">{t.profitSplit}</dt>
            <dd className="font-semibold text-foreground">
              {tier.profitSplitPct}%
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">{t.minPicks}</dt>
            <dd className="font-semibold text-foreground">{tier.minPicks}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">{t.guideIncluded}</dt>
            <dd className="font-semibold text-foreground">
              {tier.guideIncluded ? (
                <span className="flex items-center gap-1 text-pf-brand">
                  <Check className="w-3.5 h-3.5" />
                  {t.yes}
                </span>
              ) : (
                <span className="text-muted-foreground">{t.no}</span>
              )}
            </dd>
          </div>
        </dl>

        <ul className="space-y-1.5 mb-6 text-xs text-muted-foreground">
          {[t.phase1Target, t.phase2Target, t.dailyLoss, t.drawdown].map(
            (rule) => (
              <li key={rule} className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-pf-brand shrink-0" />
                {rule}
              </li>
            ),
          )}
        </ul>

        {error && (
          <p className="text-xs text-red-400 text-center mb-2">{error}</p>
        )}
        <button
          onClick={handleBuy}
          disabled={loading}
          className="w-full rounded-xl bg-pf-brand hover:bg-pf-brand-dark disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-3 text-sm transition-colors"
        >
          {loading
            ? t.redirecting
            : isAuthenticated
              ? t.buyButton
              : t.loginRequired}
        </button>
      </div>

      {/* Payment method selector modal */}
      {showMethodSelector && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="relative w-full max-w-sm rounded-2xl border border-border bg-background p-6 shadow-2xl">
            <button
              onClick={() => setShowMethodSelector(false)}
              className="absolute right-4 top-4 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="font-bold text-foreground text-lg mb-1">
              {t.selectPaymentMethod}
            </h3>
            <p className="text-sm text-muted-foreground mb-5">
              {tier.name} — {formatUSD(tier.fee)} USD
            </p>

            <div className="space-y-3">
              {/* Card / Stripe */}
              <button
                onClick={() => handlePayment("stripe")}
                className="w-full flex items-center gap-3 p-4 rounded-xl border border-border hover:border-pf-brand/40 hover:bg-pf-brand/5 transition-all text-left"
              >
                <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20 shrink-0">
                  <CreditCard className="w-4 h-4" />
                </div>
                <div>
                  <p className="font-semibold text-foreground text-sm">
                    {t.card}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Visa, Mastercard, Amex · Apple Pay · Google Pay
                  </p>
                </div>
              </button>

              {/* Crypto */}
              <div className="rounded-xl border border-border p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-orange-500/10 text-orange-400 border border-orange-500/20 shrink-0 text-xs font-bold">
                    ₿
                  </div>
                  <p className="font-semibold text-foreground text-sm">
                    {t.crypto}
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      { id: "usdttrc20", label: "USDT", sub: "TRC-20" },
                      { id: "usdcerc20", label: "USDC", sub: "ERC-20" },
                      { id: "btc", label: "BTC", sub: "Bitcoin" },
                    ] as const
                  ).map(({ id, label, sub }) => (
                    <button
                      key={id}
                      onClick={() => setSelectedCrypto(id)}
                      className={`p-2 rounded-lg border text-center transition-all ${
                        selectedCrypto === id
                          ? "border-pf-brand bg-pf-brand/10 text-pf-brand"
                          : "border-border text-muted-foreground hover:border-pf-brand/40"
                      }`}
                    >
                      <p className="text-xs font-bold">{label}</p>
                      <p className="text-[10px]">{sub}</p>
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => handlePayment("crypto")}
                  className="w-full rounded-lg bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 border border-orange-500/20 font-semibold py-2 text-sm transition-colors"
                >
                  {t.payWith}{" "}
                  {selectedCrypto === "btc"
                    ? "BTC"
                    : selectedCrypto.startsWith("usdt")
                      ? "USDT"
                      : "USDC"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
