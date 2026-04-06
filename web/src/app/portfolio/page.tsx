"use client";

import { useState, useEffect, useCallback } from "react";
import { Coins, TrendingUp, Layers, ExternalLink } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3002";

interface LpPosition {
  token: string;
  tokenSymbol: string;
  poolName: string;
  platformName: string;
  investmentId: number;
  amountInvested: string;
  apr: string;
  tvl: string;
  range: number;
  timestamp: number;
}

interface Portfolio {
  positions: LpPosition[];
  totalInvested: number;
  totalPositions: number;
  avgApr: number;
  executorAddress: string;
}

function formatUsd(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(2)}`;
}

function getTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function PortfolioPage(): React.ReactNode {
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);

  const fetchPortfolio = useCallback(async (): Promise<void> => {
    try {
      const res = await fetch(`${API_URL}/api/portfolio`);
      if (res.ok) {
        setPortfolio(await res.json() as Portfolio);
      }
    } catch {
      // server unavailable
    }
  }, []);

  useEffect(() => {
    fetchPortfolio();
    const interval = setInterval(fetchPortfolio, 15_000);
    return (): void => clearInterval(interval);
  }, [fetchPortfolio]);

  return (
    <div className="mx-auto max-w-[1400px] px-6 lg:px-10 py-8">
      <div className="mb-8">
        <h1 className="text-sm font-semibold uppercase tracking-[0.25em] text-[#e8eaed] mb-1">
          Portfolio
        </h1>
        <p className="text-xs text-[#7a7f8a]">
          Executor agent LP positions &mdash; skin in the game
        </p>
      </div>

      {/* Stats row */}
      <div className="flex flex-wrap items-center gap-x-8 gap-y-3 mb-8">
        <div className="flex items-center gap-2">
          <Coins className="h-3.5 w-3.5 text-[#34d399]" />
          <span className="text-[11px] uppercase tracking-[0.15em] text-[#7a7f8a]">Invested</span>
          <span className="text-lg font-semibold tabular-nums text-[#e8eaed]">
            ${portfolio?.totalInvested.toFixed(2) ?? "0.00"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Layers className="h-3.5 w-3.5 text-[#6366f1]" />
          <span className="text-[11px] uppercase tracking-[0.15em] text-[#7a7f8a]">Positions</span>
          <span className="text-lg font-semibold tabular-nums text-[#e8eaed]">
            {portfolio?.totalPositions ?? 0}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <TrendingUp className="h-3.5 w-3.5 text-[#34d399]" />
          <span className="text-[11px] uppercase tracking-[0.15em] text-[#7a7f8a]">Avg APR</span>
          <span className="text-lg font-semibold tabular-nums text-[#34d399]">
            {((portfolio?.avgApr ?? 0) * 100).toFixed(1)}%
          </span>
        </div>
      </div>

      {/* Executor address */}
      {portfolio?.executorAddress && (
        <div className="mb-6">
          <a
            href={`https://www.oklink.com/xlayer/address/${portfolio.executorAddress}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-mono text-[#7a7f8a]/60 hover:text-[#6366f1] transition-colors"
          >
            Executor: {portfolio.executorAddress}
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      )}

      {/* Positions */}
      {(!portfolio || portfolio.positions.length === 0) ? (
        <div className="py-16 text-center border border-[#1a1d24]/30 rounded-md">
          <Coins className="h-8 w-8 text-[#1a1d24] mx-auto mb-4" />
          <p className="text-sm text-[#7a7f8a]/60 mb-1">
            No positions yet
          </p>
          <p className="text-xs text-[#7a7f8a]/30 max-w-sm mx-auto">
            The Executor agent will invest in tokens rated SAFE by the Analyst.
            Fund the Executor wallet with USDT to enable autonomous investing.
          </p>
        </div>
      ) : (
        <div className="rounded-md border border-[#1a1d24]/50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center gap-4 py-2 px-4 text-[10px] uppercase tracking-[0.12em] text-[#7a7f8a]/50 border-b border-[#1a1d24]/30">
            <span className="w-24">Token</span>
            <span className="flex-1">Pool</span>
            <span className="w-20 text-right">Invested</span>
            <span className="w-20 text-right">APR</span>
            <span className="w-16 text-right">Range</span>
            <span className="w-20 text-right">TVL</span>
            <span className="w-16 text-right">When</span>
          </div>
          {portfolio.positions.map((pos, i) => (
            <div
              key={`${pos.token}-${pos.timestamp}`}
              className={`flex items-center gap-4 py-2.5 px-4 text-xs ${i % 2 === 1 ? "bg-[#0f1116]/40" : ""}`}
            >
              <span className="w-24 font-semibold text-[#e8eaed] truncate">{pos.tokenSymbol}</span>
              <div className="flex-1 min-w-0 flex items-center gap-2">
                <span className="text-[#e8eaed]/80 font-mono truncate">{pos.poolName}</span>
                <span className="text-[10px] text-[#7a7f8a]/40">{pos.platformName}</span>
              </div>
              <span className="w-20 text-right font-mono tabular-nums text-[#e8eaed]">
                ${Number(pos.amountInvested).toFixed(2)}
              </span>
              <span className="w-20 text-right font-mono tabular-nums text-[#34d399]">
                {(Number(pos.apr) * 100).toFixed(1)}%
              </span>
              <span className="w-16 text-right font-mono tabular-nums text-[#7a7f8a]">
                {pos.range > 0 ? `\u00B1${pos.range}%` : "\u2014"}
              </span>
              <span className="w-20 text-right font-mono tabular-nums text-[#7a7f8a]">
                {formatUsd(Number(pos.tvl))}
              </span>
              <span className="w-16 text-right text-[#7a7f8a]/50 tabular-nums">
                {getTimeAgo(pos.timestamp)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
