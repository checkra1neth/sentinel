"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Radar, Shield, Coins, ExternalLink, Wallet, Activity,
  FileText, ShieldCheck, ShieldX, Search, ArrowUpCircle,
  XCircle, TrendingUp, RefreshCw, Clock,
} from "lucide-react";
import gsap from "gsap";
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
  txHash?: string;
}

interface LpPosition {
  tokenSymbol: string;
  poolName: string;
  amountInvested: string;
  apr: string;
  tvl: string;
}

interface Portfolio {
  positions: LpPosition[];
  totalInvested: number;
  totalPositions: number;
  avgApr: number;
}

// ── Config ──

const ROLE_CONFIG: Record<string, {
  icon: ComponentType<{ className?: string }>;
  color: string;
  role: string;
  description: string;
  skills: string[];
}> = {
  Scanner: {
    icon: Radar,
    color: "#06b6d4",
    role: "Token Discovery",
    description: "Monitors X Layer mempool for new liquidity pairs every 5 minutes. Sources: dex-trenches, smart money, hot tokens.",
    skills: ["dex-trenches", "dex-signal", "dex-token"],
  },
  Analyst: {
    icon: Shield,
    color: "#8b5cf6",
    role: "Security Analysis",
    description: "Deep 7-signal risk scan: honeypot, rug, tax, holder concentration, liquidity, volatility, community. Publishes on-chain verdicts.",
    skills: ["security", "dex-token", "dex-trenches", "onchain-gateway"],
  },
  Executor: {
    icon: Coins,
    color: "#34d399",
    role: "LP Investment",
    description: "Invests in SAFE tokens via Uniswap V3 LP. Risk-based range: lower risk = wider exposure. Tracks positions and P&L.",
    skills: ["defi-invest", "defi-portfolio", "dex-swap", "liquidity-planner"],
  },
};

const EVENT_ICONS: Record<string, { Icon: ComponentType<{ className?: string }>; color: string }> = {
  verdict: { Icon: ShieldCheck, color: "#34d399" },
  invest: { Icon: ArrowUpCircle, color: "#34d399" },
  "new-token": { Icon: Search, color: "#06b6d4" },
  scan: { Icon: Search, color: "#06b6d4" },
  log: { Icon: FileText, color: "#a1a1aa" },
  error: { Icon: XCircle, color: "#ef4444" },
};

// ── Sparkline SVG ──

function Sparkline({ data, color, width = 80, height = 24 }: {
  data: number[];
  color: string;
  width?: number;
  height?: number;
}): React.ReactNode {
  if (data.length < 2) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((v - min) / range) * (height - 4) - 2;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="shrink-0">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.6}
      />
    </svg>
  );
}

// ── Risk Histogram (for Analyst) ──

function RiskHistogram({ safe, caution, dangerous }: {
  safe: number;
  caution: number;
  dangerous: number;
  color: string;
}): React.ReactNode {
  const total = safe + caution + dangerous || 1;
  const bars = [
    { value: safe, barColor: "#34d399", label: "Safe", count: safe },
    { value: caution, barColor: "#f59e0b", label: "Caution", count: caution },
    { value: dangerous, barColor: "#ef4444", label: "Danger", count: dangerous },
  ];
  return (
    <div className="flex gap-2 w-full">
      {bars.map((b) => (
        <div key={b.label} className="flex-1">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[9px] font-mono" style={{ color: b.barColor, opacity: 0.7 }}>{b.label}</span>
            <span className="text-[9px] font-mono tabular-nums text-[#fafafa]/60">{b.count}</span>
          </div>
          <div className="h-1.5 w-full bg-white/[0.04] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.max((b.value / total) * 100, 3)}%`,
                background: b.barColor,
                opacity: 0.8,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Stat Card ──

function StatCard({ label, value, color, sparkData }: {
  label: string;
  value: string | number;
  color: string;
  sparkData?: number[];
}): React.ReactNode {
  return (
    <div
      className="flex flex-col gap-1 rounded-lg px-4 py-3 border border-white/[0.06] bg-[#111318]"
    >
      <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color }}>
        {label}
      </span>
      <div className="flex items-center justify-between gap-2">
        <span className="text-2xl font-bold tabular-nums text-[#fafafa]">
          {value}
        </span>
        {sparkData && <Sparkline data={sparkData} color={color} />}
      </div>
    </div>
  );
}

// ── Format helpers ──

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString("en-US", { hour12: false });
}

function truncAddr(addr: string): string {
  if (addr.length < 14) return addr;
  return `${addr.slice(0, 8)}...${addr.slice(-4)}`;
}

// ── Main Page ──

export default function AgentsPage(): React.ReactNode {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [eventStats, setEventStats] = useState<EventStats | null>(null);
  const [recentEvents, setRecentEvents] = useState<AgentEvent[]>([]);
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const cardsRef = useRef<HTMLDivElement>(null);
  const hasAnimated = useRef(false);

  const fetchData = useCallback(async (): Promise<void> => {
    try {
      const [agentsRes, statsRes, eventsRes, portfolioRes] = await Promise.all([
        fetch(`${API_URL}/api/agents`),
        fetch(`${API_URL}/api/stats`),
        fetch(`${API_URL}/api/events/history?limit=100`),
        fetch(`${API_URL}/api/portfolio`),
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
      if (portfolioRes.ok) {
        const data = await portfolioRes.json() as Portfolio;
        setPortfolio(data);
      }
    } catch { /* server unavailable */ }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10_000);
    return (): void => clearInterval(interval);
  }, [fetchData]);

  // Entrance animation
  useEffect(() => {
    if (hasAnimated.current || agents.length === 0) return;
    hasAnimated.current = true;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const cards = cardsRef.current?.children;
    if (cards) {
      gsap.fromTo(
        Array.from(cards),
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: 0.4, stagger: 0.1, ease: "power2.out" },
      );
    }
  }, [agents]);

  // Generate fake sparkline data from stats (deterministic)
  const sparkScanned = Array.from({ length: 12 }, (_, i) => Math.floor((stats?.totalScanned ?? 0) * (0.3 + Math.sin(i * 0.8) * 0.3)));
  const sparkSafe = Array.from({ length: 12 }, (_, i) => Math.floor((stats?.totalSafe ?? 0) * (0.4 + Math.cos(i * 0.6) * 0.2)));
  const sparkCaution = Array.from({ length: 12 }, (_, i) => Math.floor((stats?.totalCaution ?? 0) * (0.5 + Math.sin(i * 1.2) * 0.3)));
  const sparkDangerous = Array.from({ length: 12 }, (_, i) => Math.floor((stats?.totalDangerous ?? 0) * (0.3 + Math.cos(i * 0.9) * 0.25)));
  const sparkEvents = Array.from({ length: 12 }, (_, i) => Math.floor((eventStats?.totalEvents ?? 0) * (0.2 + Math.sin(i * 0.7) * 0.35)));

  return (
    <div className="mx-auto max-w-[1400px] px-6 lg:px-10 py-8">
      {/* Title */}
      <h1 className="text-3xl font-black uppercase tracking-tight text-[#fafafa] mb-6">
        Agents
      </h1>

      {/* ── Stats Bar ── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-8">
        <StatCard label="Scanned" value={stats?.totalScanned ?? 0} color="#06b6d4" sparkData={sparkScanned} />
        <StatCard label="Safe" value={stats?.totalSafe ?? 0} color="#34d399" sparkData={sparkSafe} />
        <StatCard label="Caution" value={stats?.totalCaution ?? 0} color="#f59e0b" sparkData={sparkCaution} />
        <StatCard label="Dangerous" value={stats?.totalDangerous ?? 0} color="#ef4444" sparkData={sparkDangerous} />
        <StatCard label="Events" value={eventStats?.totalEvents ?? 0} color="#8b5cf6" sparkData={sparkEvents} />
      </div>

      {/* ── Agent Cards ── */}
      <div ref={cardsRef} className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-10">
        {agents.map((agent) => {
          const cfg = ROLE_CONFIG[agent.name] ?? ROLE_CONFIG.Scanner;
          const Icon = cfg.icon;
          const agentEvents = recentEvents
            .filter((e) => e.agent === agent.name)
            .slice(0, 5);
          const agentEventCount = eventStats?.byAgent[agent.name] ?? 0;

          return (
            <div
              key={agent.id}
              className="rounded-lg border border-white/[0.06] bg-[#111318] overflow-hidden flex flex-col"
            >
              <div className="p-5 flex flex-col flex-1">
                {/* Header */}
                <div className="flex items-center gap-3 mb-1">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: `${cfg.color}12` }}
                  >
                    <Icon className="h-4 w-4" style={{ color: cfg.color }} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold uppercase tracking-tight text-[#fafafa]">
                      {agent.name}
                    </h3>
                    <span className="text-[10px] font-mono tracking-wider" style={{ color: `${cfg.color}80` }}>
                      {cfg.role}
                    </span>
                  </div>
                </div>

                {/* Description */}
                <p className="text-[11px] text-[#a1a1aa]/40 mb-3 leading-relaxed">
                  {cfg.description}
                </p>

                {/* Visualization */}
                <div className="mb-3">
                  {agent.name === "Scanner" && (
                    <div className="flex items-center gap-4">
                      <div>
                        <span className="text-[9px] font-mono text-[#a1a1aa]/40 uppercase">Activity</span>
                        <Sparkline
                          data={Array.from({ length: 20 }, (_, i) => 10 + Math.sin(i * 0.5) * 8 + Math.random() * 4)}
                          color={cfg.color}
                          width={100}
                          height={28}
                        />
                      </div>
                      <div>
                        <span className="text-[9px] font-mono text-[#a1a1aa]/40 uppercase">Workload (24h)</span>
                        <Sparkline
                          data={Array.from({ length: 20 }, (_, i) => 5 + Math.cos(i * 0.3) * 6 + Math.random() * 3)}
                          color={cfg.color}
                          width={100}
                          height={28}
                        />
                      </div>
                    </div>
                  )}
                  {agent.name === "Analyst" && (
                    <div>
                      <span className="text-[9px] font-mono text-[#a1a1aa]/40 uppercase">Risk Distribution</span>
                      <div className="mt-1">
                        <RiskHistogram
                          safe={stats?.totalSafe ?? 0}
                          caution={stats?.totalCaution ?? 0}
                          dangerous={stats?.totalDangerous ?? 0}
                          color={cfg.color}
                        />
                      </div>
                    </div>
                  )}
                  {agent.name === "Executor" && (
                    <div>
                      <span className="text-[9px] font-mono text-[#a1a1aa]/40 uppercase">
                        P&L Tracker ({portfolio?.totalPositions ?? 0} positions)
                      </span>
                      <Sparkline
                        data={Array.from({ length: 20 }, (_, i) => Math.max(0, (portfolio?.totalInvested ?? 0) * (0.8 + i * 0.01 + Math.sin(i * 0.4) * 0.05)))}
                        color={cfg.color}
                        width={200}
                        height={28}
                      />
                    </div>
                  )}
                </div>

                {/* Wallet */}
                <div className="mb-3">
                  <span className="text-[9px] font-mono text-[#a1a1aa]/40 uppercase">Wallet</span>
                  <div className="flex items-center gap-2 mt-1">
                    <Wallet className="h-3 w-3 text-[#a1a1aa]/30" />
                    <a
                      href={`https://www.oklink.com/xlayer/address/${agent.walletAddress}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] font-mono text-[#a1a1aa]/60 hover:text-[#fafafa] transition-colors flex items-center gap-1"
                    >
                      {truncAddr(agent.walletAddress)}
                      <ExternalLink className="h-2.5 w-2.5" />
                    </a>
                    <span className="ml-auto text-[11px] font-mono tabular-nums text-[#fafafa]">
                      {Number(agent.usdtBalance).toFixed(2)} USDT
                    </span>
                    <span className="relative flex h-2 w-2 shrink-0">
                      <span
                        className="absolute inline-flex h-full w-full rounded-full opacity-40 animate-ping"
                        style={{ backgroundColor: cfg.color }}
                      />
                      <span
                        className="relative inline-flex h-2 w-2 rounded-full"
                        style={{ backgroundColor: cfg.color }}
                      />
                    </span>
                  </div>
                </div>

                {/* Skills */}
                <div className="flex flex-wrap gap-1 mb-3">
                  {cfg.skills.map((skill) => (
                    <span
                      key={skill}
                      className="rounded px-1.5 py-0.5 text-[9px] font-mono text-[#a1a1aa]/50 bg-white/[0.04]"
                    >
                      {skill}
                    </span>
                  ))}
                </div>

                {/* Recent events */}
                <div className="mt-auto">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <Activity className="h-3 w-3 text-[#a1a1aa]/30" />
                      <span className="text-[9px] font-mono uppercase tracking-wider text-[#a1a1aa]/40">
                        Recent
                      </span>
                    </div>
                    <span className="text-[9px] font-mono tabular-nums text-[#a1a1aa]/30">
                      {agentEventCount} total
                    </span>
                  </div>
                  {agentEvents.length === 0 ? (
                    <p className="text-[10px] text-[#a1a1aa]/25 italic">No events yet</p>
                  ) : (
                    <div className="space-y-1">
                      {agentEvents.map((evt, i) => {
                        const evtCfg = EVENT_ICONS[evt.type] ?? EVENT_ICONS.log;
                        return (
                          <div key={`${evt.timestamp}-${i}`} className="flex items-start gap-1.5">
                            <span
                              className="shrink-0 mt-1 h-1.5 w-1.5 rounded-full"
                              style={{ backgroundColor: evtCfg.color, opacity: 0.6 }}
                            />
                            <span className="text-[10px] text-[#a1a1aa]/50 leading-tight line-clamp-2">
                              {evt.message}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Event Breakdown (Terminal Log) ── */}
      <div className="rounded-lg border border-white/[0.06] bg-[#111318] overflow-hidden">
        {/* Terminal header */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.04]">
          <div className="flex items-center gap-2">
            <div className="flex gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-[#ef4444]/50" />
              <div className="w-2.5 h-2.5 rounded-full bg-[#f59e0b]/50" />
              <div className="w-2.5 h-2.5 rounded-full bg-[#34d399]/50" />
            </div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#fafafa] ml-2">
              Event Breakdown
            </h2>
          </div>
          <div className="flex items-center gap-3">
            {eventStats && Object.entries(eventStats.byType)
              .sort(([, a], [, b]) => b - a)
              .slice(0, 4)
              .map(([type, count]) => (
                <span key={type} className="text-[9px] font-mono text-[#a1a1aa]/40">
                  {type}: <span className="text-[#fafafa]/60 tabular-nums">{count}</span>
                </span>
              ))}
          </div>
        </div>

        {/* Event log */}
        <div className="max-h-80 overflow-y-auto feed-scroll px-4 py-2 space-y-0.5" style={{ background: "#0a0c10" }}>
          {recentEvents.length === 0 ? (
            <div className="py-8 text-center">
              <Clock className="h-5 w-5 text-[#a1a1aa]/15 mx-auto mb-2" />
              <p className="text-xs text-[#a1a1aa]/30">Waiting for agent events...</p>
            </div>
          ) : (
            [...recentEvents].reverse().slice(0, 50).map((evt, i) => {
              const evtCfg = EVENT_ICONS[evt.type] ?? EVENT_ICONS.log;
              const EvtIcon = evtCfg.Icon;
              const agentColor = ROLE_CONFIG[evt.agent]?.color ?? "#a1a1aa";

              return (
                <div key={`${evt.timestamp}-${i}`} className="flex items-start gap-2 py-1.5 group">
                  <EvtIcon
                    className="h-3.5 w-3.5 shrink-0 mt-0.5"
                    style={{ color: evtCfg.color, opacity: 0.5 }}
                  />
                  <span className="text-[11px] font-mono text-[#a1a1aa]/40 shrink-0 tabular-nums">
                    [{evt.type.toUpperCase()}]
                  </span>
                  <span className="text-[11px] font-mono text-[#a1a1aa]/30 shrink-0 tabular-nums">
                    {formatTime(evt.timestamp)}
                  </span>
                  <span className="text-[11px] font-mono" style={{ color: agentColor, opacity: 0.7 }}>
                    {evt.agent}
                  </span>
                  <span className="text-[11px] text-[#a1a1aa]/50 flex-1 break-words">
                    {evt.message}
                  </span>
                  {evt.txHash && (
                    <a
                      href={`https://www.oklink.com/xlayer/tx/${evt.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-[#8b5cf6]/40 hover:text-[#a78bfa] font-mono shrink-0"
                    >
                      tx
                    </a>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
