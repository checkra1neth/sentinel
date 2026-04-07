"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3002";

interface Stats {
  totalScanned: number;
  totalSafe: number;
  totalDangerous: number;
}

interface Verdict {
  token: string;
  tokenSymbol: string;
  riskScore: number;
  verdict: "SAFE" | "CAUTION" | "DANGEROUS";
  priceUsd: number;
  liquidityUsd: number;
  timestamp: number;
}

const VERDICT_COLOR: Record<string, string> = {
  SAFE: "#34d399",
  CAUTION: "#f59e0b",
  DANGEROUS: "#ef4444",
};

function formatUsd(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
  if (v >= 1) return `$${v.toFixed(2)}`;
  return `$${v.toFixed(6)}`;
}

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

export default function LandingPage(): React.ReactNode {
  const [stats, setStats] = useState<Stats | null>(null);
  const [verdicts, setVerdicts] = useState<Verdict[]>([]);

  const fetchData = useCallback(async (): Promise<void> => {
    try {
      const [statsRes, verdictsRes] = await Promise.all([
        fetch(`${API_URL}/api/stats`),
        fetch(`${API_URL}/api/verdicts?limit=5`),
      ]);
      if (statsRes.ok) {
        const d = await statsRes.json();
        setStats((d.verdicts ?? d) as Stats);
      }
      if (verdictsRes.ok) {
        const d = await verdictsRes.json();
        setVerdicts((d.verdicts ?? []) as Verdict[]);
      }
    } catch { /* server unavailable */ }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <div className="mx-auto max-w-[1400px] px-6 lg:px-10">
      {/* Hero */}
      <section className="py-24 lg:py-32 flex flex-col lg:flex-row items-start justify-between gap-16">
        <div className="flex-1 max-w-xl">
          <h1 className="text-4xl lg:text-5xl font-bold tracking-tight mb-4">
            Sentinel
          </h1>
          <p className="text-[#a1a1aa] text-lg leading-relaxed mb-8">
            Autonomous security oracle on X Layer. Three AI agents work in sequence: Scanner discovers tokens, Analyst scores risk, Executor invests in what&apos;s safe.
          </p>
          <Link
            href="/discover"
            className="inline-block text-sm font-medium text-[#09090b] bg-[#06b6d4] px-6 py-2.5 rounded hover:opacity-90 transition-opacity"
          >
            Open Dashboard
          </Link>
        </div>
        <div className="font-mono text-right">
          <div className="text-5xl font-bold tabular-nums">
            {stats?.totalScanned?.toLocaleString() ?? "—"}
          </div>
          <div className="text-sm text-[#a1a1aa] mt-1">tokens scanned</div>
        </div>
      </section>

      {/* Metrics line */}
      <div className="border-y border-white/[0.06] py-4 text-sm text-[#a1a1aa] font-mono flex flex-wrap gap-x-6 gap-y-1">
        <span>{stats?.totalScanned ?? 0} scanned</span>
        <span className="text-[#34d399]">{stats?.totalSafe ?? 0} safe</span>
        <span className="text-[#ef4444]">{stats?.totalDangerous ?? 0} threats</span>
        <span>3 autonomous agents</span>
        <span>X Layer (chain 196)</span>
      </div>

      {/* How it works + live verdicts */}
      <section className="py-16 lg:py-24 flex flex-col lg:flex-row gap-16">
        <div className="flex-1 space-y-8 text-sm text-[#a1a1aa] leading-relaxed">
          <div>
            <h3 className="text-[#fafafa] font-medium mb-1">Scanner</h3>
            <p>Monitors X Layer for new liquidity pairs every 5 minutes. Sources include dex-trenches, smart money signals, and trending tokens.</p>
          </div>
          <div>
            <h3 className="text-[#fafafa] font-medium mb-1">Analyst</h3>
            <p>Deep 7-signal risk scan: honeypot detection, rug history, tax analysis, holder concentration, liquidity depth, price volatility, community size. Publishes verdicts on-chain.</p>
          </div>
          <div>
            <h3 className="text-[#fafafa] font-medium mb-1">Executor</h3>
            <p>Invests in tokens rated SAFE via Uniswap V3 LP positions. Risk-based range sizing: lower risk means wider exposure. Tracks all positions and P&L.</p>
          </div>
        </div>

        {/* Live verdicts table */}
        <div className="flex-1">
          <h3 className="text-xs font-medium text-[#a1a1aa] uppercase tracking-wider mb-3">Recent Verdicts</h3>
          {verdicts.length === 0 ? (
            <p className="text-sm text-[#52525b]">No verdicts yet.</p>
          ) : (
            <table className="w-full text-xs font-mono">
              <thead>
                <tr className="text-[#52525b] text-left">
                  <th className="pb-2 font-medium">Token</th>
                  <th className="pb-2 font-medium">Verdict</th>
                  <th className="pb-2 font-medium text-right">Risk</th>
                  <th className="pb-2 font-medium text-right">Price</th>
                  <th className="pb-2 font-medium text-right">Liq</th>
                  <th className="pb-2 font-medium text-right">Age</th>
                </tr>
              </thead>
              <tbody>
                {verdicts.map((v) => (
                  <tr key={`${v.token}-${v.timestamp}`} className="border-t border-white/[0.04]">
                    <td className="py-2 text-[#fafafa]">{v.tokenSymbol}</td>
                    <td className="py-2" style={{ color: VERDICT_COLOR[v.verdict] }}>{v.verdict}</td>
                    <td className="py-2 text-right text-[#a1a1aa]">{v.riskScore}</td>
                    <td className="py-2 text-right text-[#a1a1aa]">{formatUsd(v.priceUsd)}</td>
                    <td className="py-2 text-right text-[#a1a1aa]">{formatUsd(v.liquidityUsd)}</td>
                    <td className="py-2 text-right text-[#52525b]">{timeAgo(v.timestamp)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/[0.06] py-6 flex items-center justify-between text-xs text-[#52525b] font-mono">
        <span>Sentinel &copy; 2026</span>
        <div className="flex gap-6">
          <a href="https://github.com/westerq/agentra" target="_blank" rel="noopener noreferrer" className="hover:text-[#a1a1aa] transition-colors">GitHub</a>
          <a href="https://www.okx.com/xlayer/explorer" target="_blank" rel="noopener noreferrer" className="hover:text-[#a1a1aa] transition-colors">Explorer</a>
        </div>
      </footer>
    </div>
  );
}
