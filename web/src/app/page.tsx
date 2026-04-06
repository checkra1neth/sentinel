"use client";

import { useState, useEffect, useCallback } from "react";
import { VerdictCard } from "../components/verdict-card";
import { ThreatStats } from "../components/threat-stats";
import { LiveFeed } from "../components/live-feed";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3002";
const POLL_INTERVAL = 10_000;

interface Verdict {
  token: string;
  tokenName: string;
  tokenSymbol: string;
  riskScore: number;
  verdict: "SAFE" | "CAUTION" | "DANGEROUS";
  isHoneypot: boolean;
  hasRug: boolean;
  hasMint: boolean;
  isProxy: boolean;
  buyTax: number;
  sellTax: number;
  holderConcentration: number;
  risks: string[];
  priceUsd: number;
  marketCap: number;
  liquidityUsd: number;
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
  lpPnl: string;
  events: Record<string, unknown>;
}

interface AgentData {
  id: string;
  name: string;
  wallet: string;
  balance: string;
}

export default function Home(): React.ReactNode {
  const [verdicts, setVerdicts] = useState<Verdict[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [agentCount, setAgentCount] = useState(0);

  const fetchData = useCallback(async (): Promise<void> => {
    try {
      const [verdictsRes, statsRes, agentsRes] = await Promise.all([
        fetch(`${API_URL}/api/verdicts?limit=30`),
        fetch(`${API_URL}/api/stats`),
        fetch(`${API_URL}/api/agents`),
      ]);

      if (verdictsRes.ok) {
        const data = (await verdictsRes.json()) as { verdicts: Verdict[] };
        setVerdicts(data.verdicts ?? []);
      }

      if (statsRes.ok) {
        const data = (await statsRes.json()) as Stats;
        setStats(data);
      }

      if (agentsRes.ok) {
        const data = (await agentsRes.json()) as { agents: AgentData[] };
        setAgentCount(data.agents?.length ?? 0);
      }
    } catch {
      // server unavailable, keep stale data
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => {
      fetchData();
    }, POLL_INTERVAL);
    return (): void => clearInterval(interval);
  }, [fetchData]);

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">
          <span className="mr-2">{"\uD83D\uDEE1\uFE0F"}</span>
          Sentinel
        </h1>
        <p className="mt-2 text-gray-400">
          Real-time threat feed. Autonomous agents scan, analyze, and protect
          liquidity on X Layer.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="mb-8">
        <ThreatStats
          totalScanned={stats?.totalScanned ?? 0}
          totalDangerous={stats?.totalDangerous ?? 0}
          lpPnl={stats?.totalLpInvested ?? "$0"}
          agentCount={agentCount}
        />
      </div>

      {/* Verdict Feed */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-white mb-4">Verdict Feed</h2>
        {verdicts.length === 0 ? (
          <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-12 text-center">
            <div className="text-4xl mb-3">{"\uD83D\uDD0D"}</div>
            <p className="text-gray-400">
              Sentinel is scanning... Verdicts will appear here.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {verdicts.map((v) => (
              <VerdictCard
                key={`${v.token}-${v.timestamp}`}
                verdict={v}
              />
            ))}
          </div>
        )}
      </div>

      {/* Live Feed */}
      <LiveFeed />
    </div>
  );
}
