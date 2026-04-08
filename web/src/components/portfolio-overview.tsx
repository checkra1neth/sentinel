"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchPortfolioOverview, fetchPortfolioPnl, formatUsd } from "../lib/api";

export function PortfolioOverview(): React.ReactNode {
  const { data: overview } = useQuery({
    queryKey: ["portfolio-overview"],
    queryFn: () => fetchPortfolioOverview("7d"),
    refetchInterval: 15_000,
  });

  const { data: pnl } = useQuery({
    queryKey: ["portfolio-pnl"],
    queryFn: fetchPortfolioPnl,
    refetchInterval: 15_000,
  });

  const totalValue = Number(overview?.totalValue ?? overview?.totalInvested ?? 0);
  const pnl24h = Number(pnl?.pnl24h ?? pnl?.dailyPnl ?? 0);
  const pnl7d = Number(pnl?.pnl7d ?? pnl?.weeklyPnl ?? 0);
  const positions = Number(overview?.totalPositions ?? overview?.positionsCount ?? 0);

  return (
    <div className="flex flex-wrap gap-x-6 gap-y-3 py-4 border-b border-white/[0.06]">
      <StatItem label="Total Value" value={formatUsd(totalValue)} />
      <StatItem
        label="24h PnL"
        value={`${pnl24h >= 0 ? "+" : ""}${formatUsd(Math.abs(pnl24h))}`}
        color={pnl24h >= 0 ? "#34d399" : "#ef4444"}
      />
      <StatItem
        label="7d PnL"
        value={`${pnl7d >= 0 ? "+" : ""}${formatUsd(Math.abs(pnl7d))}`}
        color={pnl7d >= 0 ? "#34d399" : "#ef4444"}
      />
      <StatItem label="Positions" value={String(positions)} />
    </div>
  );
}

function StatItem({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}): React.ReactNode {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-medium text-[#52525b] uppercase tracking-wider">{label}</span>
      <span className="text-sm font-mono font-medium" style={{ color: color ?? "#fafafa" }}>
        {value}
      </span>
    </div>
  );
}
