"use client";

import { useState, useEffect, useCallback } from "react";
import { ScanInput } from "../../components/scan-input";
import { AgentPanel } from "../../components/agent-panel";
import { LiveFeed } from "../../components/live-feed";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3002";

interface Verdict {
  token: string;
  tokenName: string;
  tokenSymbol: string;
  riskScore: number;
  verdict: "SAFE" | "CAUTION" | "DANGEROUS";
  priceUsd: number;
  marketCap: number;
  liquidityUsd: number;
  buyTax: number;
  sellTax: number;
  holderConcentration: number;
  risks: string[];
  timestamp: number;
  txHash?: string;
  lpInvested?: string;
}

interface Stats {
  totalScanned: number;
  totalSafe: number;
  totalCaution: number;
  totalDangerous: number;
  totalLpInvested: string;
}

const VC: Record<string, string> = { SAFE: "#34d399", CAUTION: "#f59e0b", DANGEROUS: "#ef4444" };

function fmt(v: number): string {
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(1)}K`;
  if (v >= 1) return `$${v.toFixed(2)}`;
  return `$${v.toFixed(6)}`;
}

function ago(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  return `${Math.floor(s / 3600)}h`;
}

export default function FeedPage(): React.ReactNode {
  const [verdicts, setVerdicts] = useState<Verdict[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);

  const fetchData = useCallback(async (): Promise<void> => {
    try {
      const [vRes, sRes] = await Promise.all([
        fetch(`${API_URL}/api/verdicts?limit=30`),
        fetch(`${API_URL}/api/stats`),
      ]);
      if (vRes.ok) {
        const d = await vRes.json();
        setVerdicts((d.verdicts ?? []) as Verdict[]);
      }
      if (sRes.ok) {
        const d = await sRes.json();
        setStats((d.verdicts ?? d) as Stats);
      }
    } catch { /* */ }
  }, []);

  useEffect(() => {
    fetchData();
    const iv = setInterval(fetchData, 10_000);
    return () => clearInterval(iv);
  }, [fetchData]);

  const handleVerdict = useCallback((v: Record<string, unknown>): void => {
    setVerdicts((prev) => [v as unknown as Verdict, ...prev]);
  }, []);

  return (
    <div className="mx-auto max-w-[1400px] px-6 lg:px-10 py-8">
      <ScanInput onVerdictReceived={handleVerdict} />

      {/* Stats line */}
      <div className="mb-4 text-xs font-mono text-[#52525b] flex flex-wrap gap-x-4 gap-y-1">
        <span>Scanned <span className="text-[#a1a1aa]">{stats?.totalScanned ?? 0}</span></span>
        <span>Safe <span className="text-[#34d399]">{stats?.totalSafe ?? 0}</span></span>
        <span>Threats <span className="text-[#ef4444]">{stats?.totalDangerous ?? 0}</span></span>
        <span>LP <span className="text-[#a1a1aa]">{stats?.totalLpInvested ?? "$0"}</span></span>
      </div>

      <AgentPanel />

      {/* Threat Feed table */}
      <div className="mb-10">
        <h2 className="text-xs text-[#52525b] uppercase tracking-wider mb-3">Threat Feed</h2>
        {verdicts.length === 0 ? (
          <p className="text-sm text-[#52525b] py-8">No verdicts yet. Scan a token or wait for the autonomous scanner.</p>
        ) : (
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="text-[#52525b] text-left border-b border-white/[0.06]">
                <th className="pb-2 font-medium">Verdict</th>
                <th className="pb-2 font-medium">Token</th>
                <th className="pb-2 font-medium text-right">Risk</th>
                <th className="pb-2 font-medium text-right hidden sm:table-cell">Price</th>
                <th className="pb-2 font-medium text-right hidden md:table-cell">MCap</th>
                <th className="pb-2 font-medium text-right hidden md:table-cell">Liq</th>
                <th className="pb-2 font-medium text-right hidden lg:table-cell">Tax</th>
                <th className="pb-2 font-medium text-right">Age</th>
              </tr>
            </thead>
            <tbody>
              {verdicts.map((v) => (
                <tr
                  key={`${v.token}-${v.timestamp}`}
                  className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors"
                >
                  <td className="py-2 font-medium" style={{ color: VC[v.verdict] }}>{v.verdict}</td>
                  <td className="py-2 text-[#fafafa]">{v.tokenSymbol}</td>
                  <td className="py-2 text-right text-[#a1a1aa]">{v.riskScore}</td>
                  <td className="py-2 text-right text-[#a1a1aa] hidden sm:table-cell">{fmt(v.priceUsd)}</td>
                  <td className="py-2 text-right text-[#a1a1aa] hidden md:table-cell">{fmt(v.marketCap)}</td>
                  <td className="py-2 text-right text-[#a1a1aa] hidden md:table-cell">{fmt(v.liquidityUsd)}</td>
                  <td className="py-2 text-right text-[#a1a1aa] hidden lg:table-cell">{v.buyTax}/{v.sellTax}%</td>
                  <td className="py-2 text-right text-[#52525b]">{ago(v.timestamp)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <LiveFeed />
    </div>
  );
}
