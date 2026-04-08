"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchLpPositions,
  fetchAgents,
  collectAllRewards,
  exitPosition,
  formatUsd,
  timeAgo,
  truncAddr,
} from "../../lib/api";
import { PortfolioOverview } from "../../components/portfolio-overview";
import { TokenBalances } from "../../components/token-balances";
import { ApprovalManager } from "../../components/approval-manager";
import { DexHistory } from "../../components/dex-history";

interface LpPosition {
  token: string;
  tokenSymbol: string;
  poolName: string;
  platformName: string;
  amountInvested: string;
  apr: string;
  tvl: string;
  range: number;
  timestamp: number;
  investmentId?: string;
}

export default function PortfolioPage(): React.ReactNode {
  const queryClient = useQueryClient();

  const { data: lpData } = useQuery({
    queryKey: ["lp-positions"],
    queryFn: fetchLpPositions,
    refetchInterval: 15_000,
  });

  const { data: agentsData } = useQuery({
    queryKey: ["agents"],
    queryFn: fetchAgents,
    refetchInterval: 60_000,
  });

  const collectMutation = useMutation({
    mutationFn: collectAllRewards,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lp-positions"] });
    },
  });

  const exitMutation = useMutation({
    mutationFn: (investmentId: string) => exitPosition(investmentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lp-positions"] });
      queryClient.invalidateQueries({ queryKey: ["portfolio-overview"] });
    },
  });

  const positions: LpPosition[] = Array.isArray(lpData?.positions)
    ? (lpData.positions as Record<string, unknown>[]).map((p) => ({
        token: String(p.token ?? ""),
        tokenSymbol: String(p.tokenSymbol ?? "???"),
        poolName: String(p.poolName ?? ""),
        platformName: String(p.platformName ?? ""),
        amountInvested: String(p.amountInvested ?? "0"),
        apr: String(p.apr ?? "0"),
        tvl: String(p.tvl ?? "0"),
        range: Number(p.range ?? 0),
        timestamp: Number(p.timestamp ?? Date.now()),
        investmentId: String(p.investmentId ?? p.id ?? ""),
      }))
    : [];

  // Backend returns {agents: [{id, name, walletAddress}...]} — Executor is id "3"
  const agentsArr = (agentsData as Record<string, unknown>)?.agents as Record<string, unknown>[] | undefined;
  const executor = agentsArr?.find((a) => a.name === "Executor" || a.id === "3");
  const executorAddress = String(executor?.walletAddress ?? "");

  return (
    <div className="mx-auto max-w-[1400px] px-6 lg:px-10 py-8">
      <h1 className="text-xl font-bold tracking-tight mb-6">Portfolio</h1>

      {/* Overview stats */}
      <PortfolioOverview />

      {/* Token balances */}
      <TokenBalances />

      {/* LP Positions */}
      <div className="py-4">
        <div className="flex items-center justify-between mb-3">
          <div className="text-[10px] font-medium text-[#52525b] uppercase tracking-wider">LP Positions</div>
          {positions.length > 0 && (
            <button
              type="button"
              onClick={() => collectMutation.mutate()}
              disabled={collectMutation.isPending}
              className="text-[10px] font-mono text-[#a1a1aa] hover:text-[#fafafa] transition-colors disabled:opacity-40"
            >
              {collectMutation.isPending ? "Collecting..." : "Collect All"}
            </button>
          )}
        </div>
        {positions.length === 0 ? (
          <p className="text-xs text-[#52525b] font-mono py-4">
            No LP positions. Executor invests in tokens rated SAFE.
          </p>
        ) : (
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="text-left border-b border-white/[0.06]">
                <th className="pb-2 font-medium text-[10px] text-[#52525b] uppercase tracking-wider">Token</th>
                <th className="pb-2 font-medium text-[10px] text-[#52525b] uppercase tracking-wider">Pool</th>
                <th className="pb-2 font-medium text-[10px] text-[#52525b] uppercase tracking-wider text-right">Invested</th>
                <th className="pb-2 font-medium text-[10px] text-[#52525b] uppercase tracking-wider text-right">APR</th>
                <th className="pb-2 font-medium text-[10px] text-[#52525b] uppercase tracking-wider text-right hidden sm:table-cell">TVL</th>
                <th className="pb-2 font-medium text-[10px] text-[#52525b] uppercase tracking-wider text-right hidden sm:table-cell">Range</th>
                <th className="pb-2 font-medium text-[10px] text-[#52525b] uppercase tracking-wider text-right">Age</th>
                <th className="pb-2 font-medium text-[10px] text-[#52525b] uppercase tracking-wider text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {positions.map((p, i) => (
                <tr key={`${p.token}-${i}`} className="border-b border-white/[0.03]">
                  <td className="py-2 text-[#fafafa]">{p.tokenSymbol}</td>
                  <td className="py-2 text-[#a1a1aa]">{p.poolName}</td>
                  <td className="py-2 text-right text-[#a1a1aa]">{formatUsd(Number(p.amountInvested))}</td>
                  <td className="py-2 text-right text-[#34d399]">{(Number(p.apr) * 100).toFixed(1)}%</td>
                  <td className="py-2 text-right text-[#a1a1aa] hidden sm:table-cell">{formatUsd(Number(p.tvl))}</td>
                  <td className="py-2 text-right text-[#a1a1aa] hidden sm:table-cell">{p.range ? `\u00B1${p.range}%` : "--"}</td>
                  <td className="py-2 text-right text-[#52525b]">{timeAgo(p.timestamp)}</td>
                  <td className="py-2 text-right">
                    <button
                      type="button"
                      onClick={() => {
                        if (p.investmentId) exitMutation.mutate(p.investmentId);
                      }}
                      disabled={exitMutation.isPending || !p.investmentId}
                      className="text-[#ef4444] hover:text-[#f87171] transition-colors disabled:opacity-40 text-[10px]"
                    >
                      Exit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Approvals */}
      {executorAddress && <ApprovalManager address={executorAddress} />}

      {/* DEX History */}
      <DexHistory />
    </div>
  );
}
