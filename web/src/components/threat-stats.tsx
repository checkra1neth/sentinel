"use client";

import { Search, AlertTriangle, TrendingUp, Radio } from "lucide-react";
import type { ComponentType } from "react";

interface ThreatStatsProps {
  totalScanned: number;
  totalDangerous: number;
  lpPnl: string;
  agentCount: number;
}

interface StatConfig {
  key: string;
  label: string;
  Icon: ComponentType<{ className?: string }>;
  iconColor: string;
  iconBg: string;
  accentBorder: string;
}

const STATS_CONFIG: StatConfig[] = [
  {
    key: "scanned",
    label: "SCANNED",
    Icon: Search,
    iconColor: "text-cyan-400",
    iconBg: "bg-cyan-400/10",
    accentBorder: "border-b-cyan-500/40",
  },
  {
    key: "threats",
    label: "THREATS",
    Icon: AlertTriangle,
    iconColor: "text-red-400",
    iconBg: "bg-red-400/10",
    accentBorder: "border-b-red-500/40",
  },
  {
    key: "lpPnl",
    label: "LP INVESTED",
    Icon: TrendingUp,
    iconColor: "text-emerald-400",
    iconBg: "bg-emerald-400/10",
    accentBorder: "border-b-emerald-500/40",
  },
  {
    key: "agents",
    label: "LIVE AGENTS",
    Icon: Radio,
    iconColor: "text-purple-400",
    iconBg: "bg-purple-400/10",
    accentBorder: "border-b-purple-500/40",
  },
];

export function ThreatStats({
  totalScanned,
  totalDangerous,
  lpPnl,
  agentCount,
}: ThreatStatsProps): React.ReactNode {
  const values: Record<string, string | number> = {
    scanned: totalScanned,
    threats: totalDangerous,
    lpPnl: lpPnl,
    agents: agentCount,
  };

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      {STATS_CONFIG.map((stat) => {
        const { Icon } = stat;
        return (
          <div
            key={stat.key}
            className={`rounded-xl border border-slate-800 ${stat.accentBorder} border-b-2 bg-[#111827] p-4 flex flex-col gap-2 transition-all duration-200 hover:bg-[#151d2e]`}
          >
            <div className="flex items-center gap-2">
              <div
                className={`flex items-center justify-center h-7 w-7 rounded-lg ${stat.iconBg}`}
              >
                <Icon className={`h-4 w-4 ${stat.iconColor}`} />
              </div>
            </div>
            <span className="text-[11px] uppercase tracking-wider text-slate-500">
              {stat.label}
            </span>
            <span className="text-3xl font-bold tabular-nums text-white">
              {values[stat.key]}
            </span>
          </div>
        );
      })}
    </div>
  );
}
