"use client";

import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { fetchDefiPositions, fetchDefiPositionDetail, formatUsd, REFETCH_NORMAL, STALE_NORMAL } from "../lib/api";
import { StatusBadge } from "./status-badge";

interface Network {
  chain: string;
  chainIndex: string;
  value: number;
}

interface Position {
  investmentId: string;
  name: string;
  platform: string;
  platformLogo: string;
  value: number;
  investmentCount: number;
  networks: Network[];
}

interface DetailToken {
  symbol: string;
  amount: string;
  valueUsd: number;
}

interface DetailInvestment {
  investName: string;
  investType: number;
  unlockDate?: string;
  tokens: DetailToken[];
}

function parsePositions(raw: Record<string, unknown>): Position[] {
  const data = (raw?.data ?? raw) as Record<string, unknown>;
  const list = data?.investments ?? data?.positions ?? data?.list;
  if (!Array.isArray(list)) return [];

  return (list as Record<string, unknown>[]).map((p) => ({
    investmentId: String(p.investmentId ?? p.id ?? ""),
    name: String(p.name ?? p.poolName ?? p.tokenSymbol ?? ""),
    platform: String(p.platformName ?? p.platform ?? ""),
    platformLogo: String(p.platformLogo ?? ""),
    value: Number(p.totalValue ?? p.value ?? p.holdingAmount ?? 0),
    investmentCount: Number(p.investmentCount ?? 0),
    networks: Array.isArray(p.networks)
      ? (p.networks as Record<string, unknown>[]).map((n) => ({
          chain: String(n.chain ?? ""),
          chainIndex: String(n.chainIndex ?? ""),
          value: Number(n.value ?? 0),
        }))
      : [],
  }));
}

function PositionDetail({ address, pos }: { address: string; pos: Position }): React.ReactNode {
  // Fetch detail for the first network (lazy on expand)
  const chainIndex = pos.networks[0]?.chainIndex ?? "1";
  const { data: detailRaw, isLoading } = useQuery({
    queryKey: ["defi-position-detail", address, chainIndex, pos.investmentId],
    queryFn: () => fetchDefiPositionDetail(address, Number(chainIndex), pos.investmentId),
    staleTime: 60_000,
  });

  const investments: DetailInvestment[] = useMemo(() => {
    const data = (detailRaw?.data ?? detailRaw) as Record<string, unknown> | undefined;
    const list = data?.investments;
    if (!Array.isArray(list)) return [];
    return (list as Record<string, unknown>[]).map((inv) => ({
      investName: String(inv.investName ?? ""),
      investType: Number(inv.investType ?? 0),
      unlockDate: inv.unlockDate ? String(inv.unlockDate) : undefined,
      tokens: Array.isArray(inv.tokens)
        ? (inv.tokens as Record<string, unknown>[]).map((t) => ({
            symbol: String(t.symbol ?? ""),
            amount: String(t.amount ?? "0"),
            valueUsd: Number(t.valueUsd ?? 0),
          }))
        : [],
    }));
  }, [detailRaw]);

  if (isLoading) {
    return (
      <div className="px-4 pb-4 pt-2 border-t border-white/[0.04]">
        <div className="h-4 w-48 bg-white/[0.04] animate-pulse rounded" />
      </div>
    );
  }

  const hasLock = investments.some((inv) => inv.unlockDate);

  return (
    <div className="px-4 pb-4 pt-2 border-t border-white/[0.04] space-y-3">
      {/* Chains */}
      <div className="flex gap-4 text-[11px] font-mono">
        <div>
          <span className="text-[#52525b]">Chains </span>
          <span className="text-[#a1a1aa]">{pos.networks.map((n) => n.chain).join(", ") || "—"}</span>
        </div>
        <div>
          <span className="text-[#52525b]">Sub-positions </span>
          <span className="text-[#a1a1aa]">{pos.investmentCount}</span>
        </div>
      </div>

      {/* Investments detail */}
      {investments.length > 0 && (
        <div className="space-y-2">
          {investments.map((inv, i) => (
            <div key={i} className="rounded bg-white/[0.02] border border-white/[0.04] px-3 py-2">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[11px] font-mono text-[#fafafa]">{inv.investName}</span>
                {inv.unlockDate && (
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    Locked until {inv.unlockDate}
                  </span>
                )}
              </div>
              <div className="flex gap-3 flex-wrap">
                {inv.tokens.map((t, j) => (
                  <span key={j} className="text-[10px] font-mono text-[#a1a1aa]">
                    {Number(t.amount).toFixed(4)} {t.symbol}
                    {t.valueUsd > 0.01 && (
                      <span className="text-[#52525b] ml-1">({formatUsd(t.valueUsd)})</span>
                    )}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lock warning instead of Exit */}
      {hasLock && (
        <div className="text-[10px] font-mono text-amber-400/60">
          Some positions are locked and cannot be withdrawn yet.
        </div>
      )}
    </div>
  );
}

export function DefiPositions(): React.ReactNode {
  const { address, isConnected } = useAccount();
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data: rawPositions, isLoading } = useQuery({
    queryKey: ["defi-positions", address],
    queryFn: () => fetchDefiPositions(address!, "ethereum,bsc,polygon,arbitrum,base,xlayer,optimism,avalanche"),
    enabled: !!address,
    staleTime: STALE_NORMAL,
    refetchInterval: REFETCH_NORMAL,
  });

  const positions = useMemo(() => parsePositions(rawPositions ?? {}), [rawPositions]);
  const totalValue = positions.reduce((s, p) => s + p.value, 0);

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
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex-1 h-16 bg-white/[0.04] animate-pulse rounded-lg" />
          ))}
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
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
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
        <StatCard label="Total Value" value={formatUsd(totalValue)} />
        <StatCard label="Protocols" value={String(positions.length)} />
        <StatCard label="Positions" value={String(positions.reduce((s, p) => s + p.investmentCount, 0))} />
      </div>

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
                  {pos.platformLogo && (
                    <img src={pos.platformLogo} alt="" className="w-4 h-4 rounded-full" />
                  )}
                  <span className="text-xs font-mono font-semibold text-[#fafafa]">{pos.name}</span>
                  <StatusBadge status="Active" />
                </div>
                <div className="flex items-center gap-6 text-xs font-mono">
                  <span className="text-[#fafafa]">{formatUsd(pos.value)}</span>
                  <span className="text-[#52525b] text-[10px]">{pos.investmentCount} pos</span>
                  <span className="text-[#52525b]">{isOpen ? "▲" : "▼"}</span>
                </div>
              </button>

              {isOpen && address && (
                <PositionDetail address={address} pos={pos} />
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
