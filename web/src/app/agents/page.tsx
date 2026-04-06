"use client";

import { useState, useEffect, useCallback } from "react";
import { Radar, Shield, Coins, ExternalLink, Wallet } from "lucide-react";
import { LiveFeed } from "../../components/live-feed";
import type { ComponentType } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3002";

interface Agent {
  id: string;
  name: string;
  walletAddress: string;
  usdtBalance: string;
}

interface Stats {
  totalScanned: number;
  totalSafe: number;
  totalCaution: number;
  totalDangerous: number;
  totalLpInvested: number;
  lpPnl: number;
}

interface EventStats {
  totalEvents: number;
  byAgent: Record<string, number>;
  byType: Record<string, number>;
}

const ROLE_CONFIG: Record<string, { icon: ComponentType<{ className?: string }>; color: string; description: string }> = {
  Scanner: {
    icon: Radar,
    color: "#22d3ee",
    description: "Discovers new tokens on X Layer via dex-trenches, smart money signals, and hot tokens",
  },
  Analyst: {
    icon: Shield,
    color: "#6366f1",
    description: "Deep security analysis using 7 data sources, publishes on-chain verdicts to VerdictRegistry",
  },
  Executor: {
    icon: Coins,
    color: "#34d399",
    description: "Invests in SAFE-rated tokens via Uniswap LP with risk-based position sizing",
  },
};

export default function AgentsPage(): React.ReactNode {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [eventStats, setEventStats] = useState<EventStats | null>(null);

  const fetchData = useCallback(async (): Promise<void> => {
    try {
      const [agentsRes, statsRes] = await Promise.all([
        fetch(`${API_URL}/api/agents`),
        fetch(`${API_URL}/api/stats`),
      ]);
      if (agentsRes.ok) {
        const data = await agentsRes.json() as { agents: Agent[] };
        setAgents(data.agents ?? []);
      }
      if (statsRes.ok) {
        const data = await statsRes.json() as { verdicts: Stats; events: EventStats };
        setStats(data.verdicts ?? null);
        setEventStats(data.events ?? null);
      }
    } catch {
      // server unavailable
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10_000);
    return (): void => clearInterval(interval);
  }, [fetchData]);

  return (
    <div className="mx-auto max-w-[1400px] px-6 lg:px-10 py-8">
      <div className="mb-8">
        <h1 className="text-sm font-semibold uppercase tracking-[0.25em] text-[#e8eaed] mb-1">
          Agents
        </h1>
        <p className="text-xs text-[#7a7f8a]">
          Three autonomous agents with Agentic Wallets on X Layer
        </p>
      </div>

      {/* Agent cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
        {agents.map((agent) => {
          const cfg = ROLE_CONFIG[agent.name] ?? ROLE_CONFIG.Scanner;
          const Icon = cfg.icon;
          const eventCount = eventStats?.byAgent[agent.name] ?? 0;

          return (
            <div
              key={agent.id}
              className="rounded-md border border-[#1a1d24]/50 p-4"
              style={{ borderTopColor: cfg.color, borderTopWidth: 2 }}
            >
              {/* Header */}
              <div className="flex items-center gap-2 mb-3">
                <span style={{ color: cfg.color }}><Icon className="h-4 w-4" /></span>
                <span className="text-sm font-semibold uppercase tracking-[0.15em]" style={{ color: cfg.color }}>
                  {agent.name}
                </span>
                <span className="ml-auto relative flex h-2 w-2">
                  <span
                    className="absolute inline-flex h-full w-full rounded-full opacity-50 animate-ping"
                    style={{ backgroundColor: cfg.color }}
                  />
                  <span
                    className="relative inline-flex h-2 w-2 rounded-full"
                    style={{ backgroundColor: cfg.color }}
                  />
                </span>
              </div>

              {/* Description */}
              <p className="text-[11px] text-[#7a7f8a]/60 mb-4 leading-relaxed">
                {cfg.description}
              </p>

              {/* Wallet */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Wallet className="h-3 w-3 text-[#7a7f8a]/40" />
                  <a
                    href={`https://www.oklink.com/xlayer/address/${agent.walletAddress}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] font-mono text-[#7a7f8a]/60 hover:text-[#6366f1] transition-colors flex items-center gap-1"
                  >
                    {agent.walletAddress.slice(0, 6)}...{agent.walletAddress.slice(-4)}
                    <ExternalLink className="h-2.5 w-2.5" />
                  </a>
                </div>

                <div className="flex items-baseline gap-3">
                  <div>
                    <span className="text-[10px] uppercase tracking-wider text-[#7a7f8a]/40">Balance </span>
                    <span className="text-xs font-mono tabular-nums text-[#e8eaed]">
                      {Number(agent.usdtBalance).toFixed(2)} USDT
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase tracking-wider text-[#7a7f8a]/40">Events </span>
                    <span className="text-xs font-mono tabular-nums text-[#e8eaed]">
                      {eventCount}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Pipeline stats */}
      {stats && (
        <div className="mb-10">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[#7a7f8a] mb-4">
            Pipeline Stats
          </h2>
          <div className="flex flex-wrap items-center gap-x-8 gap-y-2 text-xs">
            <span><span className="text-[#7a7f8a]/60">Scanned </span><span className="font-mono tabular-nums text-[#e8eaed]">{stats.totalScanned}</span></span>
            <span><span className="text-[#7a7f8a]/60">Safe </span><span className="font-mono tabular-nums text-[#34d399]">{stats.totalSafe}</span></span>
            <span><span className="text-[#7a7f8a]/60">Caution </span><span className="font-mono tabular-nums text-[#f59e0b]">{stats.totalCaution}</span></span>
            <span><span className="text-[#7a7f8a]/60">Dangerous </span><span className="font-mono tabular-nums text-[#ef4444]">{stats.totalDangerous}</span></span>
            <span><span className="text-[#7a7f8a]/60">LP Invested </span><span className="font-mono tabular-nums text-[#e8eaed]">${stats.totalLpInvested.toFixed(2)}</span></span>
            <span><span className="text-[#7a7f8a]/60">Events </span><span className="font-mono tabular-nums text-[#e8eaed]">{eventStats?.totalEvents ?? 0}</span></span>
          </div>
        </div>
      )}

      {/* Live feed */}
      <div>
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[#7a7f8a] mb-4">
          Agent Activity
        </h2>
        <LiveFeed />
      </div>
    </div>
  );
}
