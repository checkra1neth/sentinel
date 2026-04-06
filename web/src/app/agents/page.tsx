"use client";

import { useState, useEffect, useCallback } from "react";
import { Radar, Shield, Coins, ExternalLink, Wallet, Activity } from "lucide-react";
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
}

interface EventStats {
  totalEvents: number;
  byAgent: Record<string, number>;
  byType: Record<string, number>;
}

interface AgentEvent {
  timestamp: number;
  agent: string;
  type: string;
  message: string;
}

const ROLE_CONFIG: Record<string, {
  icon: ComponentType<{ className?: string }>;
  color: string;
  role: string;
  description: string;
  skills: string[];
}> = {
  Scanner: {
    icon: Radar,
    color: "#22d3ee",
    role: "Token Discovery",
    description: "Discovers new tokens on X Layer every 5 minutes. Queries 4 sources: dex-trenches (NEW, MIGRATED), smart money signals, and hot tokens. Deduplicates and filters already-scanned tokens.",
    skills: ["dex-trenches", "dex-signal", "dex-token"],
  },
  Analyst: {
    icon: Shield,
    color: "#6366f1",
    role: "Security Analysis",
    description: "Deep security scan from 7 data sources. Risk scoring 0-100 with 7 categories: honeypot, rug history, tax analysis, holder concentration, liquidity depth, price volatility, community size. Publishes verdicts on-chain to VerdictRegistry.",
    skills: ["security", "dex-token", "dex-trenches", "onchain-gateway"],
  },
  Executor: {
    icon: Coins,
    color: "#34d399",
    role: "LP Investment",
    description: "Invests in tokens rated SAFE by the Analyst. Searches Uniswap pools via OKX DeFi skill, invests with risk-based position range: lower risk = wider LP range = more exposure. Tracks positions and P&L.",
    skills: ["defi-invest", "defi-portfolio", "dex-swap", "liquidity-planner"],
  },
};

export default function AgentsPage(): React.ReactNode {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [eventStats, setEventStats] = useState<EventStats | null>(null);
  const [recentEvents, setRecentEvents] = useState<AgentEvent[]>([]);

  const fetchData = useCallback(async (): Promise<void> => {
    try {
      const [agentsRes, statsRes, eventsRes] = await Promise.all([
        fetch(`${API_URL}/api/agents`),
        fetch(`${API_URL}/api/stats`),
        fetch(`${API_URL}/api/events/history?limit=50`),
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
      if (eventsRes.ok) {
        const data = await eventsRes.json() as { events: AgentEvent[] };
        setRecentEvents(data.events ?? []);
      }
    } catch { /* */ }
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

      {/* Pipeline stats */}
      {stats && (
        <div className="flex flex-wrap items-center gap-x-8 gap-y-2 text-xs mb-8">
          <span><span className="text-[#7a7f8a]/60">Scanned </span><span className="font-mono tabular-nums text-[#e8eaed]">{stats.totalScanned}</span></span>
          <span><span className="text-[#7a7f8a]/60">Safe </span><span className="font-mono tabular-nums text-[#34d399]">{stats.totalSafe}</span></span>
          <span><span className="text-[#7a7f8a]/60">Caution </span><span className="font-mono tabular-nums text-[#f59e0b]">{stats.totalCaution}</span></span>
          <span><span className="text-[#7a7f8a]/60">Dangerous </span><span className="font-mono tabular-nums text-[#ef4444]">{stats.totalDangerous}</span></span>
          <span><span className="text-[#7a7f8a]/60">Events </span><span className="font-mono tabular-nums text-[#e8eaed]">{eventStats?.totalEvents ?? 0}</span></span>
        </div>
      )}

      {/* Agent cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-10">
        {agents.map((agent) => {
          const cfg = ROLE_CONFIG[agent.name] ?? ROLE_CONFIG.Scanner;
          const Icon = cfg.icon;
          const agentEventCount = eventStats?.byAgent[agent.name] ?? 0;
          const agentEvents = recentEvents
            .filter((e) => e.agent === agent.name)
            .slice(0, 5);

          return (
            <div
              key={agent.id}
              className="rounded-md border border-[#1a1d24]/50 p-5 flex flex-col"
              style={{ borderTopColor: cfg.color, borderTopWidth: 2 }}
            >
              {/* Header */}
              <div className="flex items-center gap-2 mb-1">
                <span style={{ color: cfg.color }}><Icon className="h-4 w-4" /></span>
                <span className="text-sm font-semibold uppercase tracking-[0.15em]" style={{ color: cfg.color }}>
                  {agent.name}
                </span>
                <span className="text-[10px] text-[#7a7f8a]/40 ml-auto">{cfg.role}</span>
              </div>

              {/* Description */}
              <p className="text-[11px] text-[#7a7f8a]/50 mb-4 leading-relaxed">
                {cfg.description}
              </p>

              {/* Wallet info */}
              <div className="space-y-2 mb-4">
                <div className="flex items-center gap-2">
                  <Wallet className="h-3 w-3 text-[#7a7f8a]/30" />
                  <a
                    href={`https://www.oklink.com/xlayer/address/${agent.walletAddress}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] font-mono text-[#7a7f8a]/50 hover:text-[#6366f1] transition-colors flex items-center gap-1"
                  >
                    {agent.walletAddress.slice(0, 10)}...{agent.walletAddress.slice(-6)}
                    <ExternalLink className="h-2.5 w-2.5" />
                  </a>
                </div>
                <div className="flex items-center gap-4 text-xs">
                  <span>
                    <span className="text-[#7a7f8a]/40">Balance </span>
                    <span className="font-mono tabular-nums text-[#e8eaed]">{Number(agent.usdtBalance).toFixed(2)} USDT</span>
                  </span>
                  <span>
                    <span className="text-[#7a7f8a]/40">Events </span>
                    <span className="font-mono tabular-nums text-[#e8eaed]">{agentEventCount}</span>
                  </span>
                </div>
              </div>

              {/* Skills used */}
              <div className="flex flex-wrap gap-1 mb-4">
                {cfg.skills.map((skill) => (
                  <span key={skill} className="rounded px-1.5 py-px text-[9px] text-[#7a7f8a]/40 bg-[#1a1d24]/40">
                    {skill}
                  </span>
                ))}
              </div>

              {/* Recent events for this agent */}
              <div className="mt-auto">
                <div className="flex items-center gap-1.5 mb-2">
                  <Activity className="h-3 w-3 text-[#7a7f8a]/30" />
                  <span className="text-[10px] uppercase tracking-[0.12em] text-[#7a7f8a]/40">Recent</span>
                </div>
                {agentEvents.length === 0 ? (
                  <p className="text-[10px] text-[#7a7f8a]/30">No events yet</p>
                ) : (
                  <div className="space-y-1">
                    {agentEvents.map((evt, i) => (
                      <div key={`${evt.timestamp}-${i}`} className="flex items-start gap-2">
                        <span className="shrink-0 mt-1 h-1 w-1 rounded-full" style={{ backgroundColor: cfg.color, opacity: 0.5 }} />
                        <span className="text-[10px] text-[#7a7f8a]/50 leading-tight line-clamp-1">{evt.message}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Event type breakdown */}
      {eventStats && Object.keys(eventStats.byType).length > 0 && (
        <div>
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[#7a7f8a] mb-3">
            Event Breakdown
          </h2>
          <div className="flex flex-wrap gap-3">
            {Object.entries(eventStats.byType)
              .sort(([, a], [, b]) => b - a)
              .map(([type, count]) => (
                <div key={type} className="flex items-center gap-2 rounded border border-[#1a1d24]/30 px-3 py-1.5">
                  <span className="text-[10px] uppercase tracking-wider text-[#7a7f8a]/50">{type}</span>
                  <span className="text-xs font-mono tabular-nums text-[#e8eaed]">{count}</span>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
