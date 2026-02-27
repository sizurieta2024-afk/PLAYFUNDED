"use client";

import { motion } from "framer-motion";

type BarVariant = "profit" | "drawdown" | "daily";

interface MetricBarProps {
  label: string;
  currentPct: number; // 0–100: how full the bar is (danger direction)
  displayValue: string; // e.g. "3.2%" or "$450"
  limitLabel: string; // e.g. "15% limit"
  variant: BarVariant;
}

const COLORS: Record<BarVariant, { bar: string; bg: string; text: string }> = {
  profit: {
    bar: "bg-pf-brand",
    bg: "bg-muted",
    text: "text-pf-brand",
  },
  drawdown: {
    bar: "bg-red-500",
    bg: "bg-muted",
    text: "text-red-400",
  },
  daily: {
    bar: "bg-amber-500",
    bg: "bg-muted",
    text: "text-amber-400",
  },
};

export function MetricBar({
  label,
  currentPct,
  displayValue,
  limitLabel,
  variant,
}: MetricBarProps) {
  const clampedPct = Math.max(0, Math.min(100, currentPct));
  const c = COLORS[variant];

  // Warn when bar is >75% full (approaching limit)
  const isWarning = variant !== "profit" && clampedPct > 75;
  const barColor =
    isWarning && variant === "drawdown"
      ? "bg-red-600"
      : isWarning && variant === "daily"
        ? "bg-amber-600"
        : c.bar;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-muted-foreground">{label}</span>
        <span className={`font-semibold tabular-nums ${c.text}`}>
          {displayValue}
          {variant !== "profit" && (
            <span className="text-muted-foreground font-normal ml-1">
              / {limitLabel}
            </span>
          )}
        </span>
      </div>
      <div className={`h-1.5 rounded-full overflow-hidden ${c.bg}`}>
        <motion.div
          className={`h-full rounded-full ${barColor}`}
          initial={{ width: 0 }}
          animate={{ width: `${clampedPct}%` }}
          transition={{ duration: 0.7, ease: "easeOut", delay: 0.1 }}
        />
      </div>
    </div>
  );
}
