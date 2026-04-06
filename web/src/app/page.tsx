"use client";

import { useState, useEffect, useCallback } from "react";
import { Shield, Eye, Radio, Search } from "lucide-react";
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
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      {/* Hero */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Shield className="h-7 w-7 text-emerald-400" />
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Sentinel
          </h1>
        </div>
        <p className="text-sm text-slate-400">
          Autonomous Security Oracle on X Layer. Real-time threat scanning,
          analysis, and liquidity protection.
        </p>
        <div className="mt-3 flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          <span className="text-[11px] uppercase tracking-wider text-slate-500">
            Scanning X Layer
          </span>
        </div>
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
        <div className="flex items-center gap-2 mb-4">
          <Eye className="h-4 w-4 text-slate-500" />
          <h2 className="text-lg font-semibold tracking-tight text-white">
            Recent Verdicts
          </h2>
        </div>
        {verdicts.length === 0 ? (
          <div className="rounded-xl border border-slate-800 bg-[#111827] p-12 text-center">
            <Search className="h-8 w-8 text-slate-600 mx-auto mb-3" />
            <p className="text-sm text-slate-400">
              Sentinel is scanning... Verdicts will appear here.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {verdicts.map((v) => (
              <VerdictCard key={`${v.token}-${v.timestamp}`} verdict={v} />
            ))}
          </div>
        )}
      </div>

      {/* Live Feed */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Radio className="h-4 w-4 text-slate-500" />
          <h2 className="text-lg font-semibold tracking-tight text-white">
            Agent Activity
          </h2>
        </div>
        <LiveFeed />
      </div>
    </div>
  );
}
