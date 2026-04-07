"use client";

import { useState, useEffect, useCallback } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3002";

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
}

interface Portfolio {
  positions: LpPosition[];
  totalInvested: number;
  totalPositions: number;
  avgApr: number;
  executorAddress: string;
}

function fmt(v: number): string {
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(1)}K`;
  return `$${v.toFixed(2)}`;
}

function ago(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

function truncAddr(a: string): string { return `${a.slice(0, 6)}...${a.slice(-4)}`; }

export default function PortfolioPage(): React.ReactNode {
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);

  const fetchData = useCallback(async (): Promise<void> => {
    try {
      const res = await fetch(`${API_URL}/api/portfolio`);
      if (res.ok) setPortfolio(await res.json() as Portfolio);
    } catch { /* */ }
  }, []);

  useEffect(() => {
    fetchData();
    const iv = setInterval(fetchData, 15_000);
    return () => clearInterval(iv);
  }, [fetchData]);

  return (
    <div className="mx-auto max-w-[1400px] px-6 lg:px-10 py-8">
      <h1 className="text-xl font-bold tracking-tight mb-6">Portfolio</h1>

      {/* Summary line */}
      <div className="mb-6 text-xs font-mono text-[#52525b] flex flex-wrap gap-x-4 gap-y-1">
        <span>Invested <span className="text-[#a1a1aa]">{fmt(portfolio?.totalInvested ?? 0)}</span></span>
        <span>Positions <span className="text-[#a1a1aa]">{portfolio?.totalPositions ?? 0}</span></span>
        <span>Avg APR <span className="text-[#a1a1aa]">{(portfolio?.avgApr ?? 0).toFixed(1)}%</span></span>
        {portfolio?.executorAddress && (
          <span>
            Executor{" "}
            <a
              href={`https://www.oklink.com/xlayer/address/${portfolio.executorAddress}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#52525b] hover:text-[#a1a1aa] transition-colors"
            >
              {truncAddr(portfolio.executorAddress)}
            </a>
          </span>
        )}
      </div>

      {/* Positions table */}
      {!portfolio || portfolio.positions.length === 0 ? (
        <p className="text-sm text-[#52525b] py-8">
          No positions yet. Executor invests in tokens rated SAFE.
        </p>
      ) : (
        <table className="w-full text-xs font-mono">
          <thead>
            <tr className="text-[#52525b] text-left border-b border-white/[0.06]">
              <th className="pb-2 font-medium">Token</th>
              <th className="pb-2 font-medium">Pool</th>
              <th className="pb-2 font-medium text-right">Invested</th>
              <th className="pb-2 font-medium text-right">APR</th>
              <th className="pb-2 font-medium text-right hidden sm:table-cell">TVL</th>
              <th className="pb-2 font-medium text-right hidden sm:table-cell">Range</th>
              <th className="pb-2 font-medium text-right">Age</th>
            </tr>
          </thead>
          <tbody>
            {portfolio.positions.map((p, i) => (
              <tr key={`${p.token}-${i}`} className="border-b border-white/[0.03]">
                <td className="py-2 text-[#fafafa]">{p.tokenSymbol}</td>
                <td className="py-2 text-[#a1a1aa]">{p.poolName}</td>
                <td className="py-2 text-right text-[#a1a1aa]">{fmt(Number(p.amountInvested))}</td>
                <td className="py-2 text-right text-[#34d399]">{(Number(p.apr) * 100).toFixed(1)}%</td>
                <td className="py-2 text-right text-[#a1a1aa] hidden sm:table-cell">{fmt(Number(p.tvl))}</td>
                <td className="py-2 text-right text-[#a1a1aa] hidden sm:table-cell">±{p.range}%</td>
                <td className="py-2 text-right text-[#52525b]">{ago(p.timestamp)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
