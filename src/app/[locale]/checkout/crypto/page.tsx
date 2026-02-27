"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { QRCodeSVG } from "qrcode.react";
import { Copy, Check, Clock, Loader2 } from "lucide-react";
import { Link } from "@/i18n/navigation";

function useCountdown(expiresAt: string | null) {
  const [secondsLeft, setSecondsLeft] = useState<number>(0);

  useEffect(() => {
    if (!expiresAt) return;
    const target = new Date(expiresAt).getTime();

    function tick() {
      const diff = Math.max(0, Math.floor((target - Date.now()) / 1000));
      setSecondsLeft(diff);
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  return {
    secondsLeft,
    display: `${minutes}:${seconds.toString().padStart(2, "0")}`,
  };
}

export default function CryptoCheckoutPage() {
  const t = useTranslations("checkout");
  const params = useSearchParams();
  const [copied, setCopied] = useState(false);

  const address = params.get("address") ?? "";
  const amount = params.get("amount") ?? "";
  const currency = params.get("currency") ?? "";
  const network = params.get("network") ?? "";
  const expiresAt = params.get("expiresAt");

  const { secondsLeft, display: countdownDisplay } = useCountdown(expiresAt);
  const expired = secondsLeft === 0 && !!expiresAt;

  function currencyLabel(c: string) {
    if (c === "usdttrc20") return t("usdt");
    if (c === "usdcerc20") return t("usdc");
    return t("btc");
  }

  async function copyAddress() {
    if (!address) return;
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (!address) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-muted-foreground">Invalid payment link.</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold text-foreground">
            {currencyLabel(currency)}
          </h1>
          <p className="text-muted-foreground text-sm">{t("cryptoScanQr")}</p>
        </div>

        {/* QR Code */}
        <div className="flex justify-center">
          <div className="rounded-2xl border border-border bg-white p-4">
            <QRCodeSVG value={address} size={180} />
          </div>
        </div>

        {/* Amount */}
        <div className="rounded-xl border border-border bg-muted/40 p-4 space-y-3 text-sm">
          <div className="flex items-center gap-2 bg-background rounded-lg border border-border px-3 py-2">
            <span className="flex-1 font-mono text-xs text-foreground break-all">
              {address}
            </span>
            <button
              onClick={copyAddress}
              className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
            >
              {copied ? (
                <Check className="w-4 h-4 text-pf-brand" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </button>
          </div>
          {copied && (
            <p className="text-xs text-pf-brand text-center">
              {t("cryptoCopied")}
            </p>
          )}

          <div className="flex justify-between">
            <span className="text-muted-foreground">{t("cryptoAddress")}</span>
            <span className="font-semibold text-foreground">
              {amount}{" "}
              {currency === "btc"
                ? "BTC"
                : currency.startsWith("usdt")
                  ? "USDT"
                  : "USDC"}
            </span>
          </div>

          <div className="flex justify-between">
            <span className="text-muted-foreground">{t("cryptoNetwork")}</span>
            <span className="font-semibold text-foreground uppercase">
              {network}
            </span>
          </div>

          {expiresAt && (
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">
                {t("cryptoExpires")}
              </span>
              <span
                className={`font-semibold font-mono ${
                  expired
                    ? "text-destructive"
                    : secondsLeft < 300
                      ? "text-yellow-500"
                      : "text-foreground"
                }`}
              >
                <Clock className="w-3.5 h-3.5 inline mr-1" />
                {expired ? "Expired" : countdownDisplay}
              </span>
            </div>
          )}
        </div>

        {/* Copy button */}
        <button
          onClick={copyAddress}
          disabled={expired}
          className="w-full flex items-center justify-center gap-2 rounded-xl border border-border hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed py-3 text-sm font-semibold text-foreground transition-colors"
        >
          {copied ? (
            <Check className="w-4 h-4 text-pf-brand" />
          ) : (
            <Copy className="w-4 h-4" />
          )}
          {copied ? t("cryptoCopied") : t("cryptoCopy")}
        </button>

        {/* Waiting indicator */}
        {!expired && (
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            {t("cryptoWaiting")}
          </div>
        )}

        <div className="text-center">
          <Link
            href="/challenges"
            className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-4 transition-colors"
          >
            {t("cancelButton")}
          </Link>
        </div>
      </div>
    </div>
  );
}
