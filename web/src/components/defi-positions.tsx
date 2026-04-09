"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { fetchDefiPositions, collectAllRewards, exitPosition, formatUsd, REFETCH_NORMAL, STALE_NORMAL } from "../lib/api";
import { TypeBadge } from "./type-badge";
import { StatusBadge } from "./status-badge";
import { RangeBar } from "./range-bar";

interface Position {
  investmentId: string;
  name: string;
  platform: string;
  productType: string;
  value: number;
  earned: number;
  apy: number;
  status: string;
  lower?: number;
  upper?: number;
  current?: number;
  openedAt?: string;
}

function parsePositions(raw: Record<string, unknown>): Position[] {
  const data = (raw?.data ?? raw) as Record<string, unknown>;
  const list = data?.investments ?? data?.positions ?? data?.list;
  if (!Array.isArray(list)) return [];

  return (list as Record<string, unknown>[]).map((p) => ({
    investmentId: String(p.investmentId ?? p.id ?? ""),
    name: String(p.name ?? p.poolName ?? p.tokenSymbol ?? ""),
    platform: String(p.platformName ?? p.platform ?? ""),
    productType: String(p.investType ?? p.productGroup ?? "DEX_POOL"),
    value: Number(p.totalValue ?? p.value ?? p.holdingAmount ?? 0),
    earned: Number(p.earnedAmount ?? p.earned ?? p.claimableAmount ?? 0),
    apy: Number(p.rate ?? p.apy ?? 0) * (Number(p.rate ?? 0) < 1 ? 100 : 1),
    status: p.isInRange === false ? "Out of Range" : p.isInRange === true ? "In Range" : "Active",
    lower: Number(p.lowerPrice ?? p.tickLower ?? 0) || undefined,
    upper: Number(p.upperPrice ?? p.tickUpper ?? 0) || undefined,
    current: Number(p.currentPrice ?? p.price ?? 0) || undefined,
    openedAt: p.openedAt ? String(p.openedAt) : undefined,
  }));
}

export function DefiPositions(): React.ReactNode {
  const { address, isConnected } = useAccount();
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data: rawPositions, isLoading } = useQuery({
    queryKey: ["defi-positions", address],
    queryFn: () => fetchDefiPositions(address!),
    enabled: !!address,
    staleTime: STALE_NORMAL,
    refetchInterval: REFETCH_NORMAL,
  });

  const positions = useMemo(() => parsePositions(rawPositions ?? {}), [rawPositions]);

  const totalValue = positions.reduce((s, p) => s + p.value, 0);
  const totalEarned = positions.reduce((s, p) => s + p.earned, 0);
  const avgApy = positions.length > 0
    ? positions.reduce((s, p) => s + p.apy * p.value, 0) / (totalValue || 1)
    : 0;

  const collectMutation = useMutation({
    mutationFn: collectAllRewards,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["defi-positions"] }),
  });

  const exitMutation = useMutation({
    mutationFn: ({ id, ratio }: { id: string; ratio: number }) => exitPosition(id, ratio),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["defi-positions"] }),
  });

  if (!isConnected) {
    return (
      <div className="py-16 text-center text-xs font-mono text-[#52525b]">
        Connect wallet to view your positions
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex-1 h-16 bg-white/[0.04] animate-pulse rounded-lg" />
          ))}
        </div>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-14 bg-white/[0.04] animate-pulse rounded-lg" />
        ))}
      </div>
    );
  }

  if (positions.length === 0) {
    return (
      <div className="py-16 text-center text-xs font-mono text-[#52525b]">
        No positions yet — explore DeFi products in the Explore tab
      </div>
    );
  }

  return (
    <div>
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard label="Total Value" value={formatUsd(totalValue)} />
        <StatCard label="Total Earned" value={`+${formatUsd(totalEarned)}`} color="#34d399" />
        <StatCard label="Positions" value={String(positions.length)} />
        <StatCard label="Avg APY" value={`${avgApy.toFixed(2)}%`} color="#34d399" />
      </div>

      {/* Collect All */}
      {totalEarned > 0 && (
        <div className="flex justify-end mb-4">
          <button
            onClick={() => collectMutation.mutate()}
            disabled={collectMutation.isPending}
            className="px-4 py-1.5 rounded text-[11px] font-semibold bg-[#34d399]/10 text-[#34d399] border border-[#34d399]/20 hover:bg-[#34d399]/20 transition-colors cursor-pointer disabled:opacity-50"
          >
            {collectMutation.isPending ? "Collecting..." : `Collect All (${formatUsd(totalEarned)})`}
          </button>
        </div>
      )}

      {/* Position list */}
      <div className="space-y-2">
        {positions.map((pos) => {
          const isOpen = expanded === pos.investmentId;
          return (
            <div key={pos.investmentId} className="border border-white/[0.06] rounded-lg overflow-hidden">
              <button
                onClick={() => setExpanded(isOpen ? null : pos.investmentId)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/[0.02] transition-colors cursor-pointer text-left"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-semibold text-[#fafafa]">{pos.name}</span>
                  <TypeBadge type={pos.productType} />
                  <StatusBadge status={pos.status} />
                </div>
                <div className="flex items-center gap-6 text-xs font-mono">
                  <span className="text-[#fafafa]">{formatUsd(pos.value)}</span>
                  <span className="text-[#34d399]">+{formatUsd(pos.earned)}</span>
                  <span className="text-[#52525b]">{isOpen ? "▲" : "▼"}</span>
                </div>
              </button>

              {isOpen && (
                <div className="px-4 pb-4 pt-1 border-t border-white/[0.04] space-y-3">
                  {pos.lower && pos.upper && pos.current && (
                    <div>
                      <div className="text-[10px] font-mono text-[#52525b] mb-1">
                        Range: {pos.lower.toFixed(4)} — {pos.upper.toFixed(4)}
                      </div>
                      <RangeBar lower={pos.lower} upper={pos.upper} current={pos.current} />
                    </div>
                  )}

                  <div className="flex gap-6 text-[11px] font-mono">
                    <div><span className="text-[#52525b]">Platform </span><span className="text-[#a1a1aa]">{pos.platform}</span></div>
                    <div><span className="text-[#52525b]">APY </span><span className="text-emerald-400">{pos.apy.toFixed(2)}%</span></div>
                    {pos.openedAt && <div><span className="text-[#52525b]">Opened </span><span className="text-[#a1a1aa]">{pos.openedAt}</span></div>}
                  </div>

                  <div className="flex gap-2">
                    {pos.earned > 0 && (
                      <button
                        onClick={() => collectMutation.mutate()}
                        disabled={collectMutation.isPending}
                        className="px-3 py-1.5 rounded text-[10px] font-semibold bg-[#34d399]/10 text-[#34d399] border border-[#34d399]/20 hover:bg-[#34d399]/20 transition-colors cursor-pointer disabled:opacity-50"
                      >
                        Collect {formatUsd(pos.earned)}
                      </button>
                    )}
                    <button
                      onClick={() => exitMutation.mutate({ id: pos.investmentId, ratio: 1 })}
                      disabled={exitMutation.isPending}
                      className="px-3 py-1.5 rounded text-[10px] font-semibold bg-white/[0.04] text-[#a1a1aa] border border-white/[0.06] hover:text-[#fafafa] transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {exitMutation.isPending ? "Exiting..." : "Exit Position"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color?: string }): React.ReactNode {
  return (
    <div className="border border-white/[0.06] rounded-lg px-4 py-3">
      <div className="text-[10px] font-medium text-[#52525b] uppercase tracking-wider">{label}</div>
      <div className="text-sm font-mono font-semibold mt-1" style={{ color: color ?? "#fafafa" }}>{value}</div>
    </div>
  );
}
