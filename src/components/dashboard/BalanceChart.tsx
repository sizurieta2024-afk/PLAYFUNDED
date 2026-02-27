"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

export interface BalancePoint {
  label: string; // formatted date
  value: number; // USD (not cents)
}

interface BalanceChartProps {
  data: BalancePoint[];
  startBalance: number; // USD (not cents)
  profitTarget: number; // USD (not cents)
  noDataLabel: string;
}

function formatUSD(v: number) {
  return `$${v.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

interface TooltipPayload {
  value: number;
}
interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  const val = payload[0].value;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-lg">
      <p className="text-muted-foreground mb-0.5">{label}</p>
      <p className="font-bold text-foreground tabular-nums">{formatUSD(val)}</p>
    </div>
  );
}

export function BalanceChart({
  data,
  startBalance,
  profitTarget,
  noDataLabel,
}: BalanceChartProps) {
  if (data.length < 2) {
    return (
      <div className="flex h-48 items-center justify-center text-muted-foreground text-sm">
        {noDataLabel}
      </div>
    );
  }

  const lastValue = data[data.length - 1].value;
  const isPositive = lastValue >= startBalance;
  const lineColor = isPositive ? "#2d6a4f" : "#ef4444";
  const fillColor = isPositive ? "#2d6a4f" : "#ef4444";

  const allValues = data.map((d) => d.value);
  const minVal = Math.min(...allValues, startBalance) * 0.98;
  const maxVal = Math.max(...allValues, profitTarget) * 1.02;

  return (
    <ResponsiveContainer width="100%" height={192}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="balanceFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={fillColor} stopOpacity={0.18} />
            <stop offset="95%" stopColor={fillColor} stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis
          dataKey="label"
          tick={{ fontSize: 10, fill: "#64748b" }}
          axisLine={false}
          tickLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          domain={[minVal, maxVal]}
          tickFormatter={(v: number) => formatUSD(v)}
          tick={{ fontSize: 10, fill: "#64748b" }}
          axisLine={false}
          tickLine={false}
          width={64}
        />
        <Tooltip content={<CustomTooltip />} />
        {/* Start balance reference line */}
        <ReferenceLine
          y={startBalance}
          stroke="#475569"
          strokeDasharray="3 3"
          strokeWidth={1}
        />
        {/* Profit target reference line */}
        <ReferenceLine
          y={profitTarget}
          stroke="#2d6a4f"
          strokeDasharray="4 2"
          strokeWidth={1.5}
          label={{
            value: formatUSD(profitTarget),
            position: "right",
            fontSize: 9,
            fill: "#2d6a4f",
          }}
        />
        <Area
          type="monotone"
          dataKey="value"
          stroke={lineColor}
          strokeWidth={2}
          fill="url(#balanceFill)"
          dot={false}
          activeDot={{ r: 4, fill: lineColor, strokeWidth: 0 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
