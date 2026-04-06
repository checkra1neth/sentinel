"use client";

interface ThreatStatsProps {
  totalScanned: number;
  totalDangerous: number;
  lpPnl: string;
  agentCount: number;
}

const STATS_CONFIG = [
  {
    key: "scanned" as const,
    label: "Scanned",
    icon: "\uD83D\uDD0D",
    color: "text-blue-400",
  },
  {
    key: "threats" as const,
    label: "Threats",
    icon: "\uD83D\uDED1",
    color: "text-red-400",
  },
  {
    key: "lpPnl" as const,
    label: "LP P&L",
    icon: "\uD83D\uDCB0",
    color: "text-emerald-400",
  },
  {
    key: "agents" as const,
    label: "Agents",
    icon: "\uD83E\uDD16",
    color: "text-purple-400",
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
      {STATS_CONFIG.map((stat) => (
        <div
          key={stat.key}
          className="rounded-xl border border-gray-800 bg-gray-900/50 p-4 flex flex-col gap-1"
        >
          <div className="flex items-center gap-2">
            <span>{stat.icon}</span>
            <span className="text-xs text-gray-500">{stat.label}</span>
          </div>
          <span className={`text-2xl font-bold ${stat.color}`}>
            {values[stat.key]}
          </span>
        </div>
      ))}
    </div>
  );
}
