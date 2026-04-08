"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchPortfolioOverview, fetchPortfolioPnl, formatUsd, REFETCH_NORMAL } from "../lib/api";

export function PortfolioOverview(): React.ReactNode {
  const { data: overview } = useQuery({
    queryKey: ["portfolio-overview"],
    queryFn: () => fetchPortfolioOverview("7d"),
    refetchInterval: REFETCH_NORMAL,
  });

  const { data: pnl } = useQuery({
    queryKey: ["portfolio-pnl"],
    queryFn: fetchPortfolioPnl,
    refetchInterval: REFETCH_NORMAL,
  });

  // Backend wraps in {success, data} or returns flat from /portfolio
  const ovData = (overview as Record<string, unknown>)?.data as Record<string, unknown> | undefined;
  const pnlData = (pnl as Record<string, unknown>)?.data as Record<string, unknown> | undefined;
  const totalValue = Number(ovData?.totalValue ?? overview?.totalValue ?? overview?.totalInvested ?? 0);
  const pnl24h = Number(pnlData?.pnl24h ?? pnlData?.dailyPnl ?? pnl?.pnl24h ?? 0);
  const pnl7d = Number(pnlData?.pnl7d ?? pnlData?.weeklyPnl ?? pnl?.pnl7d ?? 0);
  const positions = Number(ovData?.totalPositions ?? overview?.totalPositions ?? 0);

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
