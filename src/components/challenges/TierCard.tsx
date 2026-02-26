"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { Check, Zap, Star, Crown, TrendingUp } from "lucide-react";
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
}

interface TierCardProps {
  tier: Tier;
  isAuthenticated: boolean;
  locale: string;
  description: string;
  t: TierTranslations;
}

// Visual config per tier name
const TIER_CONFIG: Record<
  string,
  {
    icon: React.ReactNode;
    gradient: string;
    badge: string;
    isPopular: boolean;
  }
> = {
  "Starter $1K": {
    icon: <TrendingUp className="w-5 h-5" />,
    gradient:
      "from-emerald-500/10 to-transparent border-emerald-500/20 hover:border-emerald-500/40",
    badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    isPopular: false,
  },
  "Pro $5K": {
    icon: <Zap className="w-5 h-5" />,
    gradient:
      "from-blue-500/10 to-transparent border-blue-500/20 hover:border-blue-500/40",
    badge: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    isPopular: false,
  },
  "Elite $10K": {
    icon: <Star className="w-5 h-5" />,
    gradient:
      "from-purple-500/10 to-transparent border-purple-500/30 hover:border-purple-500/50",
    badge: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    isPopular: true,
  },
  "Champion $25K": {
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

export function TierCard({
  tier,
  isAuthenticated,
  locale,
  description,
  t,
}: TierCardProps) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const config = TIER_CONFIG[tier.name] ?? DEFAULT_CONFIG;

  async function handleBuy() {
    if (!isAuthenticated) {
      router.push("/auth/login");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/checkout/stripe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tierId: tier.id, locale }),
      });

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        console.error("Checkout error:", data.error);
        setLoading(false);
        return;
      }

      const data = (await res.json()) as { url?: string };
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      console.error("Checkout error:", err);
      setLoading(false);
    }
  }

  return (
    <div
      className={`relative flex flex-col rounded-2xl border bg-gradient-to-b p-6 transition-all duration-200 ${config.gradient}`}
    >
      {/* Popular badge */}
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

      {/* Icon + name */}
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
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        </div>
      </div>

      {/* Price */}
      <div className="mb-6">
        <span className="text-4xl font-extrabold text-foreground tracking-tight">
          {formatUSD(tier.fee)}
        </span>
        <span className="text-sm text-muted-foreground ml-1">USD</span>
      </div>

      {/* Key stats */}
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
          <dd className="font-semibold text-foreground">
            {tier.minPicks} {t.minPicks}
          </dd>
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

      {/* Rules bullets */}
      <ul className="space-y-1.5 mb-6 text-xs text-muted-foreground">
        <li className="flex items-center gap-1.5">
          <Check className="w-3.5 h-3.5 text-pf-brand shrink-0" />
          {t.phase1Target}
        </li>
        <li className="flex items-center gap-1.5">
          <Check className="w-3.5 h-3.5 text-pf-brand shrink-0" />
          {t.phase2Target}
        </li>
        <li className="flex items-center gap-1.5">
          <Check className="w-3.5 h-3.5 text-pf-brand shrink-0" />
          {t.dailyLoss}
        </li>
        <li className="flex items-center gap-1.5">
          <Check className="w-3.5 h-3.5 text-pf-brand shrink-0" />
          {t.drawdown}
        </li>
      </ul>

      {/* CTA button */}
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
  );
}
