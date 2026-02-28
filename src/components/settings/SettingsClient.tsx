"use client";

import { useState, useTransition } from "react";
import { updateWeeklyLimit, selfExclude, cancelTempExclusion } from "@/app/actions/settings";
import { useTranslations } from "next-intl";

interface Props {
  email: string;
  name: string | null;
  weeklyDepositLimitUsd: number | null;
  selfExcludedUntil: string | null;
  isPermExcluded: boolean;
}

export function SettingsClient({
  email,
  name,
  weeklyDepositLimitUsd,
  selfExcludedUntil,
  isPermExcluded,
}: Props) {
  const t = useTranslations("settings");
  const [pending, startTransition] = useTransition();

  // Weekly limit state
  const [limitInput, setLimitInput] = useState(
    weeklyDepositLimitUsd !== null ? String(weeklyDepositLimitUsd) : "",
  );
  const [limitMsg, setLimitMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Exclusion UI state
  const [showExclude, setShowExclude] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<"30d" | "90d" | "180d" | "permanent" | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [excludeMsg, setExcludeMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function handleSaveLimit() {
    const val = limitInput.trim() === "" ? null : parseFloat(limitInput);
    if (val !== null && (isNaN(val) || val < 10 || val > 100_000)) {
      setLimitMsg({ ok: false, text: t("limitInvalid") });
      return;
    }
    startTransition(async () => {
      const res = await updateWeeklyLimit(val);
      if (res.error) setLimitMsg({ ok: false, text: res.error });
      else setLimitMsg({ ok: true, text: t("limitSaved") });
    });
  }

  function handleExclude() {
    if (!selectedPeriod) return;
    if (selectedPeriod === "permanent" && confirmText !== "CONFIRM") return;
    startTransition(async () => {
      const res = await selfExclude(selectedPeriod);
      if (res.error) setExcludeMsg({ ok: false, text: res.error });
      else {
        setExcludeMsg({ ok: true, text: t("excludeSuccess") });
        setShowExclude(false);
        setSelectedPeriod(null);
        setConfirmText("");
      }
    });
  }

  function handleCancelExclusion() {
    startTransition(async () => {
      const res = await cancelTempExclusion();
      if (res.error) setExcludeMsg({ ok: false, text: res.error });
      else setExcludeMsg({ ok: true, text: t("exclusionCancelled") });
    });
  }

  const isCurrentlyExcluded =
    isPermExcluded ||
    (selfExcludedUntil && new Date(selfExcludedUntil) > new Date());

  return (
    <div className="space-y-8">
      {/* ── Profile ────────────────────────────────────────────────── */}
      <section className="rounded-xl border border-border bg-card p-6 space-y-4">
        <h2 className="text-sm font-semibold">{t("profileSection")}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">{t("emailLabel")}</p>
            <p className="text-sm font-medium">{email}</p>
          </div>
          {name && (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">{t("nameLabel")}</p>
              <p className="text-sm font-medium">{name}</p>
            </div>
          )}
        </div>
      </section>

      {/* ── Weekly deposit limit ───────────────────────────────────── */}
      <section className="rounded-xl border border-border bg-card p-6 space-y-4">
        <div>
          <h2 className="text-sm font-semibold">{t("weeklyLimitSection")}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">{t("weeklyLimitDesc")}</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
            <input
              type="number"
              min={10}
              max={100000}
              value={limitInput}
              onChange={(e) => {
                setLimitInput(e.target.value);
                setLimitMsg(null);
              }}
              placeholder={t("noLimit")}
              disabled={pending}
              className="pl-7 pr-3 py-2 text-sm rounded-lg border border-border bg-background w-40 focus:outline-none focus:ring-1 focus:ring-pf-brand/40"
            />
          </div>
          <button
            onClick={handleSaveLimit}
            disabled={pending}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-pf-brand text-white hover:bg-pf-brand/90 transition-colors disabled:opacity-40"
          >
            {t("save")}
          </button>
          {limitInput !== "" && (
            <button
              onClick={() => {
                setLimitInput("");
                setLimitMsg(null);
                startTransition(async () => {
                  await updateWeeklyLimit(null);
                  setLimitMsg({ ok: true, text: t("limitRemoved") });
                });
              }}
              disabled={pending}
              className="text-xs text-muted-foreground hover:text-foreground underline transition-colors"
            >
              {t("removeLimit")}
            </button>
          )}
        </div>
        {limitMsg && (
          <p className={`text-xs ${limitMsg.ok ? "text-pf-brand" : "text-red-400"}`}>
            {limitMsg.text}
          </p>
        )}
      </section>

      {/* ── Account Safety (exclusion — buried at bottom) ─────────── */}
      <section className="pt-2">
        <details className="group">
          <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground transition-colors list-none flex items-center gap-1.5 select-none w-fit">
            <span className="group-open:rotate-90 transition-transform inline-block text-muted-foreground/60">›</span>
            {t("safetySection")}
          </summary>

          <div className="mt-4 rounded-xl border border-border bg-card/50 p-5 space-y-4">
            <p className="text-xs text-muted-foreground leading-relaxed">
              {t("safetyDesc")}
            </p>

            {/* Current exclusion status */}
            {isCurrentlyExcluded && (
              <div className="rounded-lg bg-yellow-500/10 border border-yellow-500/20 px-4 py-3 space-y-1">
                <p className="text-xs font-medium text-yellow-600 dark:text-yellow-400">
                  {isPermExcluded
                    ? t("permExcludedStatus")
                    : t("tempExcludedStatus", {
                        date: new Date(selfExcludedUntil!).toLocaleDateString(),
                      })}
                </p>
                {!isPermExcluded && (
                  <button
                    onClick={handleCancelExclusion}
                    disabled={pending}
                    className="text-xs text-muted-foreground hover:text-foreground underline transition-colors"
                  >
                    {t("cancelExclusion")}
                  </button>
                )}
              </div>
            )}

            {excludeMsg && (
              <p className={`text-xs ${excludeMsg.ok ? "text-pf-brand" : "text-red-400"}`}>
                {excludeMsg.text}
              </p>
            )}

            {!isPermExcluded && !showExclude && (
              <button
                onClick={() => setShowExclude(true)}
                className="text-xs text-muted-foreground hover:text-foreground underline transition-colors"
              >
                {t("selfExcludeLink")}
              </button>
            )}

            {showExclude && !isPermExcluded && (
              <div className="space-y-4 border-t border-border pt-4">
                <p className="text-xs font-medium">{t("choosePeriod")}</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(["30d", "90d", "180d", "permanent"] as const).map((p) => (
                    <button
                      key={p}
                      onClick={() => {
                        setSelectedPeriod(p);
                        setConfirmText("");
                      }}
                      className={`py-2 px-3 text-xs rounded-lg border transition-colors ${
                        selectedPeriod === p
                          ? p === "permanent"
                            ? "border-red-500 bg-red-500/10 text-red-500"
                            : "border-pf-brand bg-pf-brand/10 text-pf-brand"
                          : "border-border text-muted-foreground hover:border-foreground hover:text-foreground"
                      }`}
                    >
                      {t(`period_${p}`)}
                    </button>
                  ))}
                </div>

                {selectedPeriod === "permanent" && (
                  <div className="space-y-2">
                    <p className="text-xs text-red-400">{t("permWarning")}</p>
                    <input
                      type="text"
                      value={confirmText}
                      onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
                      placeholder='Type "CONFIRM"'
                      className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-red-500/40"
                    />
                  </div>
                )}

                <div className="flex items-center gap-3">
                  <button
                    onClick={handleExclude}
                    disabled={
                      pending ||
                      !selectedPeriod ||
                      (selectedPeriod === "permanent" && confirmText !== "CONFIRM")
                    }
                    className="px-4 py-2 text-xs font-medium rounded-lg bg-muted text-foreground hover:bg-muted/80 transition-colors disabled:opacity-40"
                  >
                    {t("confirmExclude")}
                  </button>
                  <button
                    onClick={() => {
                      setShowExclude(false);
                      setSelectedPeriod(null);
                      setConfirmText("");
                    }}
                    className="text-xs text-muted-foreground hover:text-foreground underline transition-colors"
                  >
                    {t("cancel")}
                  </button>
                </div>
              </div>
            )}
          </div>
        </details>
      </section>
    </div>
  );
}
