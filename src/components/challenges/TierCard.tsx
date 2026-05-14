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
import { AnalyticsEvents } from "@/lib/analytics/events";
import { trackClientEvent } from "@/lib/analytics/posthog-client";

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
  // pix
  pix?: string;
  pixDesc?: string;
  // gift
  sendAsGift: string;
  giftRecipientEmailPlaceholder: string;
  giftStripeOnly: string;
  paymentMethodUnavailable?: string;
  discountCodeLabel?: string;
  discountCodePlaceholder?: string;
  applyDiscount?: string;
  discountApplied?: string;
  invalidDiscountCode?: string;
  discountSummary?: string;
  finalPriceLabel?: string;
}

interface TierCardProps {
  tier: Tier;
  isAuthenticated: boolean;
  locale: string;
  description: string;
  t: TierTranslations;
  country?: string;
  localFeeLabel?: string;
  availablePaymentMethods: PaymentMethod[];
  giftsEnabled: boolean;
  reviewNotice?: string | null;
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
      "from-pf-pink/10 to-transparent border-pf-pink/30 hover:border-pf-pink/50",
    badge: "bg-pf-pink/10 text-pf-pink border-pf-pink/20",
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

function getNumberLocale(locale: string): string {
  return locale === "en" ? "en-US" : locale;
}

function formatUSD(cents: number, locale: string, fractionDigits = 0): string {
  const amount = cents / 100;
  let formatted = new Intl.NumberFormat(getNumberLocale(locale), {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(amount);

  // User-facing requirement: use comma decimals outside English locales.
  if (fractionDigits > 0 && locale !== "en") {
    formatted = formatted.replace(/\.(\d+)$/, ",$1");
  }

  return `$${formatted}`;
}

type PaymentMethod = "stripe" | "crypto" | "pix";
type CryptoCurrency = "usdttrc20" | "usdcerc20" | "btc";

export function TierCard({
  tier,
  isAuthenticated,
  locale,
  description,
  t,
  country,
  localFeeLabel,
  availablePaymentMethods,
  giftsEnabled,
  reviewNotice,
}: TierCardProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showMethodSelector, setShowMethodSelector] = useState(false);
  const [selectedCrypto, setSelectedCrypto] =
    useState<CryptoCurrency>("usdttrc20");
  const [isGift, setIsGift] = useState(false);
  const [giftEmail, setGiftEmail] = useState("");
  const [discountCode, setDiscountCode] = useState("");
  const [discountState, setDiscountState] = useState<{
    code: string;
    discountPct: number;
    discountAmount: number;
    discountedAmount: number;
  } | null>(null);
  const [discountLoading, setDiscountLoading] = useState(false);
  const router = useRouter();
  const config = TIER_CONFIG[tier.name] ?? DEFAULT_CONFIG;

  async function handleBuy() {
    trackClientEvent(AnalyticsEvents.CHALLENGE_TIER_CTA_CLICKED, {
      tier_id: tier.id,
      tier_name: tier.name,
      tier_fee_cents: tier.fee,
      funded_bankroll_cents: tier.fundedBankroll,
      locale,
      country: country ?? null,
      is_authenticated: isAuthenticated,
      available_payment_methods: availablePaymentMethods,
    });

    if (!isAuthenticated) {
      router.push("/auth/login");
      return;
    }
    if (availablePaymentMethods.length === 0) {
      setError(
        t.paymentMethodUnavailable ??
          "Payment methods are not available in your country right now.",
      );
      return;
    }
    setError(null);
    setShowMethodSelector(true);
  }

  async function handleApplyDiscount() {
    const normalized = discountCode.trim().toUpperCase();
    if (!normalized) {
      setDiscountState(null);
      return;
    }
    setDiscountLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/checkout/discounts/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tierId: tier.id, code: normalized }),
      });
      const data = (await response.json()) as {
        code?: string;
        discountPct?: number;
        discountAmount?: number;
        discountedAmount?: number;
      };
      if (!response.ok || !data.code) {
        setDiscountState(null);
        setError(
          t.invalidDiscountCode ?? "Discount code is invalid or inactive.",
        );
        return;
      }
      setDiscountCode(data.code);
      setDiscountState({
        code: data.code,
        discountPct: data.discountPct ?? 0,
        discountAmount: data.discountAmount ?? 0,
        discountedAmount: data.discountedAmount ?? tier.fee,
      });
    } catch {
      setDiscountState(null);
      setError("Unable to validate discount code right now.");
    } finally {
      setDiscountLoading(false);
    }
  }

  async function handlePayment(method: PaymentMethod) {
    if (!availablePaymentMethods.includes(method)) {
      setError(
        t.paymentMethodUnavailable ??
          "Payment methods are not available in your country right now.",
      );
      return;
    }
    if (isGift && !giftEmail.trim()) {
      setError("Please enter the recipient's email address.");
      return;
    }
    setShowMethodSelector(false);
    setLoading(true);
    setError(null);

    try {
      trackClientEvent(AnalyticsEvents.CHECKOUT_STARTED, {
        tier_id: tier.id,
        tier_name: tier.name,
        tier_fee_cents: tier.fee,
        amount_cents: discountState?.discountedAmount ?? tier.fee,
        discount_code_present: Boolean(discountState?.code),
        payment_method: method === "crypto" ? selectedCrypto : method,
        provider: method === "crypto" ? "nowpayments" : "stripe",
        locale,
        country: country ?? null,
        is_gift: isGift,
      });

      const endpoint =
        method === "crypto"
          ? "/api/checkout/nowpayments"
          : "/api/checkout/stripe";

      const body: {
        tierId: string;
        locale: string;
        currency?: string;
        country?: string;
        isGift?: boolean;
        giftRecipientEmail?: string;
        paymentMethod?: "card" | "pix";
        discountCode?: string;
      } = { tierId: tier.id, locale };
      if (method === "crypto") body.currency = selectedCrypto;
      if (method === "pix" && country) body.country = country;
      if (method === "stripe") body.paymentMethod = "card";
      if (method === "pix") body.paymentMethod = "pix";
      if (isGift) {
        body.isGift = true;
        body.giftRecipientEmail = giftEmail.trim();
      }
      if (discountState?.code) {
        body.discountCode = discountState.code;
      }

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
        trackClientEvent(AnalyticsEvents.CHECKOUT_FAILED_CLIENT, {
          tier_id: tier.id,
          tier_name: tier.name,
          status: res.status,
          error_code: data.code ?? "unknown",
          payment_method: method === "crypto" ? selectedCrypto : method,
          provider: method === "crypto" ? "nowpayments" : "stripe",
          locale,
          country: country ?? null,
        });
        setLoading(false);
        setError(data.error ?? "Payment failed. Please try again.");
        return;
      }

      if (data.url) {
        trackClientEvent(AnalyticsEvents.CHECKOUT_CREATED_CLIENT, {
          tier_id: tier.id,
          tier_name: tier.name,
          amount_cents: discountState?.discountedAmount ?? tier.fee,
          discount_code_present: Boolean(discountState?.code),
          payment_method: method === "pix" ? "pix" : "card",
          provider: "stripe",
          locale,
          country: country ?? null,
          is_gift: isGift,
        });
        window.location.href = data.url;
      } else if (data.address) {
        trackClientEvent(AnalyticsEvents.CHECKOUT_CREATED_CLIENT, {
          tier_id: tier.id,
          tier_name: tier.name,
          amount_cents: discountState?.discountedAmount ?? tier.fee,
          discount_code_present: Boolean(discountState?.code),
          payment_method: selectedCrypto,
          provider: "nowpayments",
          locale,
          country: country ?? null,
        });
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
      trackClientEvent(AnalyticsEvents.CHECKOUT_FAILED_CLIENT, {
        tier_id: tier.id,
        tier_name: tier.name,
        error_code: "NETWORK_ERROR",
        payment_method: method === "crypto" ? selectedCrypto : method,
        provider: method === "crypto" ? "nowpayments" : "stripe",
        locale,
        country: country ?? null,
      });
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
            {formatUSD(tier.fee, locale, 2)}
          </span>
          <span className="text-sm text-muted-foreground ml-1">USD</span>
          {localFeeLabel && (
            <p className="text-xs text-muted-foreground mt-1">
              (~{localFeeLabel})
            </p>
          )}
        </div>

        <dl className="space-y-3 text-sm mb-6 flex-1">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">{t.fundedBankroll}</dt>
            <dd className="font-semibold text-foreground">
              {formatUSD(tier.fundedBankroll, locale)}
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

        {reviewNotice && (
          <p className="mb-4 text-xs text-amber-500">{reviewNotice}</p>
        )}

        {error && (
          <p className="text-xs text-red-400 text-center mb-2">{error}</p>
        )}
        <button
          onClick={handleBuy}
          disabled={loading}
          className="w-full rounded-xl bg-pf-pink hover:bg-pf-pink-dark disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-3 text-sm transition-colors"
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
              {tier.name} —{" "}
              {formatUSD(
                discountState?.discountedAmount ?? tier.fee,
                locale,
                2,
              )}{" "}
              USD
            </p>

            <div className="mb-4 rounded-xl border border-border p-4 space-y-3">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  {t.discountCodeLabel ?? "Discount code"}
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={discountCode}
                    onChange={(e) =>
                      setDiscountCode(e.target.value.toUpperCase())
                    }
                    placeholder={t.discountCodePlaceholder ?? "Enter your code"}
                    className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-pf-brand"
                  />
                  <button
                    onClick={handleApplyDiscount}
                    disabled={discountLoading}
                    className="rounded-lg border border-border px-3 py-2 text-xs font-semibold text-foreground hover:bg-secondary transition-colors disabled:opacity-50"
                  >
                    {discountLoading
                      ? t.redirecting
                      : (t.applyDiscount ?? "Apply")}
                  </button>
                </div>
              </div>
              {discountState ? (
                <div className="rounded-lg bg-pf-brand/10 border border-pf-brand/20 px-3 py-2 text-xs text-pf-brand space-y-1">
                  <p>
                    {t.discountApplied ?? "Discount applied"}:{" "}
                    <span className="font-semibold">
                      {discountState.code} · {discountState.discountPct}% off
                    </span>
                  </p>
                  <p>
                    {(t.discountSummary ?? "You save {amount}.").replace(
                      "{amount}",
                      formatUSD(discountState.discountAmount, locale, 2),
                    )}
                  </p>
                  <p>
                    {t.finalPriceLabel ?? "Final price"}:{" "}
                    <span className="font-semibold">
                      {formatUSD(discountState.discountedAmount, locale, 2)}
                    </span>
                  </p>
                </div>
              ) : null}
            </div>

            {giftsEnabled && (
              <div className="mb-4">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={isGift}
                    onChange={(e) => {
                      setIsGift(e.target.checked);
                      if (!e.target.checked) setGiftEmail("");
                    }}
                    className="w-4 h-4 rounded accent-pf-brand"
                  />
                  <span className="text-sm font-medium text-foreground">
                    {t.sendAsGift} 🎁
                  </span>
                </label>
                {isGift && (
                  <div className="mt-3 space-y-2">
                    <input
                      type="email"
                      value={giftEmail}
                      onChange={(e) => setGiftEmail(e.target.value)}
                      placeholder={t.giftRecipientEmailPlaceholder}
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-pf-brand"
                    />
                    <p className="text-xs text-muted-foreground">
                      {t.giftStripeOnly}
                    </p>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-3">
              {/* Card / Stripe */}
              {availablePaymentMethods.includes("stripe") && (
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
              )}

              {/* Pix — Brazil only, hidden when gift mode is on */}
              {availablePaymentMethods.includes("pix") &&
                country === "BR" &&
                !isGift && (
                  <button
                    onClick={() => handlePayment("pix")}
                    className="w-full flex items-center gap-3 p-4 rounded-xl border border-border hover:border-pf-brand/40 hover:bg-pf-brand/5 transition-all text-left"
                  >
                    <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-pf-brand/10 text-pf-brand border border-pf-brand/20 shrink-0 text-xs font-bold">
                      PIX
                    </div>
                    <div>
                      <p className="font-semibold text-foreground text-sm">
                        {t.pix ?? "Pix"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t.pixDesc ?? "Pagamento instantâneo via Pix (BRL)"}
                      </p>
                    </div>
                  </button>
                )}

              {/* Crypto — hidden when gift mode is on */}
              {availablePaymentMethods.includes("crypto") && !isGift && (
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
              )}

              {availablePaymentMethods.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  {t.paymentMethodUnavailable ??
                    "Payment methods are not available in your country right now."}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
