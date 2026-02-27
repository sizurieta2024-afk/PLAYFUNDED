"use client";

import { Link } from "@/i18n/navigation";
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Clock, Zap } from "lucide-react";
import { MetricBar } from "./MetricBar";

interface ChallengeCardProps {
  challenge: {
    id: string;
    balance: number; // cents
    startBalance: number; // cents
    highestBalance: number; // cents
    peakBalance: number; // cents
    dailyStartBalance: number; // cents
    phase: string;
    status: string;
    startedAt: string; // ISO
    phase1StartBalance: number | null;
    phase2StartBalance: number | null;
    tier: {
      name: string;
      profitSplitPct: number;
      minPicks: number;
    };
  };
  settledPicksCount: number; // won + lost + push (toward minimum)
  pendingPicksCount: number;
  t: Record<string, string>;
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function getPhaseBadgeClass(phase: string): string {
  if (phase === "funded") return "bg-pf-brand/15 text-pf-brand";
  if (phase === "phase2") return "bg-blue-500/15 text-blue-400";
  return "bg-amber-500/15 text-amber-400";
}

function getPhaseLabel(phase: string, t: Record<string, string>): string {
  if (phase === "funded") return t.funded;
  if (phase === "phase2") return t.phase2;
  return t.phase1;
}

export function ChallengeCard({
  challenge,
  settledPicksCount,
  pendingPicksCount,
  t,
}: ChallengeCardProps) {
  // ── P&L ──────────────────────────────────────────────────────────────────
  const pnlCents = challenge.balance - challenge.startBalance;
  const pnlPct = ((pnlCents / challenge.startBalance) * 100).toFixed(1);
  const isProfitable = pnlCents >= 0;

  // ── Profit target bar ─────────────────────────────────────────────────────
  const phaseStartBalance =
    challenge.phase === "phase1"
      ? (challenge.phase1StartBalance ?? challenge.startBalance)
      : (challenge.phase2StartBalance ?? challenge.startBalance);
  const targetPct =
    challenge.phase === "funded" ? 0 : challenge.phase === "phase2" ? 10 : 20;
  const profitTargetBalance = Math.floor(
    phaseStartBalance * (1 + targetPct / 100),
  );
  const range = profitTargetBalance - phaseStartBalance;
  const profitProgress =
    range > 0
      ? Math.max(
          0,
          Math.min(
            100,
            Math.round(((challenge.balance - phaseStartBalance) / range) * 100),
          ),
        )
      : 100;

  // ── Drawdown bar ─────────────────────────────────────────────────────────
  const peak = challenge.peakBalance || challenge.startBalance;
  const drawdownCents = Math.max(0, peak - challenge.balance);
  const drawdownPct = (drawdownCents / peak) * 100;
  const drawdownBarPct = Math.min(100, Math.round((drawdownPct / 15) * 100));
  const drawdownDisplay = drawdownPct.toFixed(1) + "%";

  // ── Daily loss bar ────────────────────────────────────────────────────────
  const daily = challenge.dailyStartBalance || challenge.startBalance;
  const dailyLossCents = Math.max(0, daily - challenge.balance);
  const dailyLossPct = daily > 0 ? (dailyLossCents / daily) * 100 : 0;
  const dailyBarPct = Math.min(100, Math.round((dailyLossPct / 10) * 100));
  const dailyDisplay = dailyLossPct.toFixed(1) + "%";

  // ── Days active ───────────────────────────────────────────────────────────
  const daysActive = Math.floor(
    (Date.now() - new Date(challenge.startedAt).getTime()) /
      (1000 * 60 * 60 * 24),
  );

  const profitTargetLabel =
    challenge.phase === "phase2"
      ? t.profitTargetPhase2Label
      : t.profitTargetLabel;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="rounded-xl border border-border bg-card overflow-hidden"
    >
      {/* Phase color strip */}
      <div
        className={`h-1 w-full ${
          challenge.phase === "funded"
            ? "bg-pf-brand"
            : challenge.phase === "phase2"
              ? "bg-blue-500"
              : "bg-amber-500"
        }`}
      />

      <div className="p-5 space-y-5">
        {/* Header: phase badge + tier + status */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold ${getPhaseBadgeClass(challenge.phase)}`}
              >
                {getPhaseLabel(challenge.phase, t)}
              </span>
              <span className="text-xs text-muted-foreground">
                {challenge.tier.name}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {daysActive} {t.daysActive} · {challenge.tier.profitSplitPct}%{" "}
              {t.profitSplit}
            </p>
          </div>

          {/* P&L chip */}
          <div
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-sm font-bold tabular-nums shrink-0 ${
              isProfitable
                ? "bg-pf-brand/10 text-pf-brand"
                : "bg-red-500/10 text-red-400"
            }`}
          >
            {isProfitable ? (
              <TrendingUp className="w-3.5 h-3.5" />
            ) : (
              <TrendingDown className="w-3.5 h-3.5" />
            )}
            {isProfitable ? "+" : ""}
            {pnlPct}%
          </div>
        </div>

        {/* Balance */}
        <div>
          <p className="text-xs text-muted-foreground mb-0.5">{t.balance}</p>
          <p className="text-3xl font-bold tabular-nums tracking-tight">
            {formatCents(challenge.balance)}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t.startBalance}: {formatCents(challenge.startBalance)}
          </p>
        </div>

        {/* Progress bars */}
        <div className="space-y-3">
          <MetricBar
            label={profitTargetLabel}
            currentPct={profitProgress}
            displayValue={profitProgress + "%"}
            limitLabel={formatCents(profitTargetBalance)}
            variant="profit"
          />
          <MetricBar
            label={t.drawdownLabel}
            currentPct={drawdownBarPct}
            displayValue={drawdownDisplay}
            limitLabel="15%"
            variant="drawdown"
          />
          <MetricBar
            label={t.dailyLossLabel}
            currentPct={dailyBarPct}
            displayValue={dailyDisplay}
            limitLabel="10%"
            variant="daily"
          />
        </div>

        {/* Picks progress */}
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Zap className="w-3.5 h-3.5" />
            <span>
              <span className="font-semibold text-foreground tabular-nums">
                {settledPicksCount}
              </span>
              {" / "}
              {challenge.tier.minPicks} {t.picks} {t.completed_picks}
            </span>
          </div>
          {pendingPicksCount > 0 && (
            <span className="text-amber-500/80 text-xs">
              {pendingPicksCount} {t.pending.toLowerCase()}
            </span>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 pt-1">
          <Link
            href={`/dashboard/picks`}
            className="flex-1 text-center py-2 rounded-lg bg-pf-brand text-white text-xs font-semibold hover:bg-pf-brand/90 transition-colors"
          >
            {t.placePick}
          </Link>
          <Link
            href={`/dashboard/challenge/${challenge.id}`}
            className="flex-1 text-center py-2 rounded-lg border border-border bg-card text-xs font-medium text-muted-foreground hover:text-foreground hover:border-border/60 transition-colors"
          >
            {t.viewDetail}
          </Link>
        </div>
      </div>
    </motion.div>
  );
}
