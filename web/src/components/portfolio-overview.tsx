"use client";

import { useQuery } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { fetchPortfolioOverview, fetchPortfolioPnl, formatUsd, REFETCH_NORMAL, STALE_FAST } from "../lib/api";

export function PortfolioOverview(): React.ReactNode {
  const { address, isConnected } = useAccount();
  const { data: overview, isLoading: loadingOverview } = useQuery({
    queryKey: ["portfolio-overview", address],
    queryFn: () => fetchPortfolioOverview("7d", address),
    enabled: !!address,
    staleTime: STALE_FAST,
    refetchInterval: REFETCH_NORMAL,
  });

  const { data: pnl, isLoading: loadingPnl } = useQuery({
    queryKey: ["portfolio-pnl", address],
    queryFn: () => fetchPortfolioPnl(address),
    enabled: !!address,
    staleTime: STALE_FAST,
    refetchInterval: REFETCH_NORMAL,
  });

  if (!isConnected) return null;

  const isLoading = loadingOverview || loadingPnl;

  // Backend wraps in {success, data} or returns flat from /portfolio
  const ovData = (overview as Record<string, unknown>)?.data as Record<string, unknown> | undefined;
  const pnlData = (pnl as Record<string, unknown>)?.data as Record<string, unknown> | undefined;
  const totalValue = Number(ovData?.totalValue ?? overview?.totalValue ?? overview?.totalInvested ?? 0);
  const pnl24h = Number(pnlData?.pnl24h ?? pnlData?.dailyPnl ?? pnl?.pnl24h ?? 0);
  const pnl7d = Number(pnlData?.pnl7d ?? pnlData?.weeklyPnl ?? pnl?.pnl7d ?? 0);
  const positions = Number(ovData?.totalPositions ?? overview?.totalPositions ?? 0);

  return (
    <div className="flex flex-wrap gap-x-6 gap-y-3 py-4 border-b border-white/[0.06]">
      <StatItem label="Total Value" value={isLoading ? undefined : formatUsd(totalValue)} />
      <StatItem
        label="24h PnL"
        value={isLoading ? undefined : `${pnl24h >= 0 ? "+" : ""}${formatUsd(Math.abs(pnl24h))}`}
        color={pnl24h >= 0 ? "#34d399" : "#ef4444"}
      />
      <StatItem
        label="7d PnL"
        value={isLoading ? undefined : `${pnl7d >= 0 ? "+" : ""}${formatUsd(Math.abs(pnl7d))}`}
        color={pnl7d >= 0 ? "#34d399" : "#ef4444"}
      />
      <StatItem label="Positions" value={isLoading ? undefined : String(positions)} />
    </div>
  );
}

function StatItem({
  label,
  value,
  color,
}: {
  label: string;
  value?: string;
  color?: string;
}): React.ReactNode {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-medium text-[#52525b] uppercase tracking-wider">{label}</span>
      {value ? (
        <span className="text-sm font-mono font-medium" style={{ color: color ?? "#fafafa" }}>
          {value}
        </span>
      ) : (
        <div className="h-5 w-20 bg-white/[0.04] animate-pulse rounded mt-0.5" />
      )}
    </div>
  );
}
