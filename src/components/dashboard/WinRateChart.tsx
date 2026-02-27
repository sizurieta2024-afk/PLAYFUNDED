"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
} from "recharts";

export interface WinRateEntry {
  category: string;
  won: number;
  lost: number;
  void: number;
  push: number;
}

interface WinRateChartProps {
  data: WinRateEntry[];
  noDataLabel: string;
}

interface TooltipPayload {
  name: string;
  value: number;
  color: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  const total = payload.reduce((s, p) => s + p.value, 0);
  const won = payload.find((p) => p.name === "Won")?.value ?? 0;
  const winRate = total > 0 ? Math.round((won / total) * 100) : 0;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-lg space-y-1">
      <p className="font-semibold text-foreground">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: {p.value}
        </p>
      ))}
      <p className="text-muted-foreground">Win rate: {winRate}%</p>
    </div>
  );
}

export function WinRateChart({ data, noDataLabel }: WinRateChartProps) {
  const hasData = data.some((d) => d.won + d.lost > 0);

  if (!hasData) {
    return (
      <div className="flex h-40 items-center justify-center text-muted-foreground text-sm">
        {noDataLabel}
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={160}>
      <BarChart
        data={data}
        margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
        barGap={2}
        barSize={18}
      >
        <XAxis
          dataKey="category"
          tick={{ fontSize: 10, fill: "#64748b" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 10, fill: "#64748b" }}
          axisLine={false}
          tickLine={false}
          allowDecimals={false}
          width={24}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend
          iconType="square"
          iconSize={8}
          wrapperStyle={{ fontSize: 10, color: "#64748b" }}
        />
        <Bar dataKey="won" name="Won" stackId="a" radius={[0, 0, 0, 0]}>
          {data.map((_, i) => (
            <Cell key={`won-${i}`} fill="#2d6a4f" />
          ))}
        </Bar>
        <Bar dataKey="lost" name="Lost" stackId="a" radius={[3, 3, 0, 0]}>
          {data.map((_, i) => (
            <Cell key={`lost-${i}`} fill="#ef4444" />
          ))}
        </Bar>
        <Bar dataKey="push" name="Push" stackId="a" radius={[3, 3, 0, 0]}>
          {data.map((_, i) => (
            <Cell key={`push-${i}`} fill="#64748b" />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
