"use client";

import { useState, useEffect, useCallback } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3002";

interface Agent { id: string; name: string; walletAddress: string; usdtBalance: string; }
interface Stats { totalScanned: number; totalSafe: number; totalCaution: number; totalDangerous: number; }
interface EventStats { totalEvents: number; byAgent: Record<string, number>; }
interface AgentEvent { timestamp: number; agent: string; type: string; message: string; txHash?: string; }

const ROLE_META: Record<string, { role: string; skills: string[] }> = {
  Scanner: { role: "Token Discovery", skills: ["dex-trenches", "dex-signal", "dex-token"] },
  Analyst: { role: "Security Analysis", skills: ["security", "dex-token", "dex-trenches", "onchain-gateway"] },
  Executor: { role: "LP Investment", skills: ["defi-invest", "defi-portfolio", "dex-swap", "liquidity-planner"] },
};

const TYPE_COLOR: Record<string, string> = { verdict: "#34d399", "new-token": "#06b6d4", invest: "#34d399", error: "#ef4444" };

function truncAddr(a: string): string { return `${a.slice(0, 6)}...${a.slice(-4)}`; }
function fmtTime(ts: number): string { return new Date(ts).toLocaleTimeString("en-US", { hour12: false }); }

export default function AgentsPage(): React.ReactNode {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [eventStats, setEventStats] = useState<EventStats | null>(null);
  const [events, setEvents] = useState<AgentEvent[]>([]);

  const fetchData = useCallback(async (): Promise<void> => {
    try {
      const [aR, sR, eR] = await Promise.all([
        fetch(`${API_URL}/api/agents`),
        fetch(`${API_URL}/api/stats`),
        fetch(`${API_URL}/api/events/history?limit=50`),
      ]);
      if (aR.ok) { const d = await aR.json(); setAgents((d as { agents: Agent[] }).agents ?? []); }
      if (sR.ok) { const d = await sR.json(); setStats((d as { verdicts: Stats }).verdicts ?? null); setEventStats((d as { events: EventStats }).events ?? null); }
      if (eR.ok) { const d = await eR.json(); setEvents((d as { events: AgentEvent[] }).events ?? []); }
    } catch { /* */ }
  }, []);

  useEffect(() => { fetchData(); const iv = setInterval(fetchData, 10_000); return () => clearInterval(iv); }, [fetchData]);

  return (
    <div className="mx-auto max-w-[1400px] px-6 lg:px-10 py-8">
      <h1 className="text-xl font-bold tracking-tight mb-6">Agents</h1>

      {/* Stats line */}
      <div className="mb-6 text-xs font-mono text-[#52525b] flex flex-wrap gap-x-4 gap-y-1">
        <span>Scanned <span className="text-[#a1a1aa]">{stats?.totalScanned ?? 0}</span></span>
        <span>Safe <span className="text-[#34d399]">{stats?.totalSafe ?? 0}</span></span>
        <span>Caution <span className="text-[#f59e0b]">{stats?.totalCaution ?? 0}</span></span>
        <span>Dangerous <span className="text-[#ef4444]">{stats?.totalDangerous ?? 0}</span></span>
        <span>Events <span className="text-[#a1a1aa]">{eventStats?.totalEvents ?? 0}</span></span>
      </div>

      {/* Agent sections */}
      <div className="space-y-1 mb-10">
        {agents.map((agent) => {
          const meta = ROLE_META[agent.name] ?? ROLE_META.Scanner;
          const agentEvents = events.filter((e) => e.agent === agent.name).slice(0, 3);
          const evtCount = eventStats?.byAgent[agent.name] ?? 0;

          return (
            <div key={agent.id} className="border border-white/[0.06] rounded px-5 py-4">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm font-mono mb-2">
                <span className="font-medium text-[#fafafa]">{agent.name.toUpperCase()}</span>
                <span className="text-[#52525b]">{meta.role}</span>
                <a
                  href={`https://www.oklink.com/xlayer/address/${agent.walletAddress}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#52525b] hover:text-[#a1a1aa] transition-colors"
                >
                  {truncAddr(agent.walletAddress)}
                </a>
                <span className="text-[#a1a1aa]">{Number(agent.usdtBalance).toFixed(2)} USDT</span>
                <span className="text-[#52525b] ml-auto">{evtCount} events</span>
              </div>
              <div className="text-xs font-mono text-[#52525b] mb-2">
                {meta.skills.join(" · ")}
              </div>
              {agentEvents.length > 0 && (
                <div className="text-xs font-mono text-[#52525b] space-y-0.5">
                  {agentEvents.map((evt, i) => (
                    <div key={`${evt.timestamp}-${i}`}>
                      <span className="text-[#a1a1aa]/40">{fmtTime(evt.timestamp)}</span>{" "}
                      {evt.message}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Event Log table */}
      <h2 className="text-xs text-[#52525b] uppercase tracking-wider mb-3">Event Log</h2>
      <div className="max-h-96 overflow-y-auto feed-scroll">
        <table className="w-full text-xs font-mono">
          <thead>
            <tr className="text-[#52525b] text-left border-b border-white/[0.06]">
              <th className="pb-2 font-medium w-20">Type</th>
              <th className="pb-2 font-medium w-20">Time</th>
              <th className="pb-2 font-medium w-20">Agent</th>
              <th className="pb-2 font-medium">Message</th>
            </tr>
          </thead>
          <tbody>
            {events.length === 0 && (
              <tr><td colSpan={4} className="py-6 text-[#52525b]">Waiting for agent events...</td></tr>
            )}
            {[...events].reverse().slice(0, 50).map((evt, i) => (
              <tr key={`${evt.timestamp}-${i}`} className="border-b border-white/[0.03]">
                <td className="py-1.5" style={{ color: TYPE_COLOR[evt.type] ?? "#a1a1aa" }}>{evt.type.toUpperCase()}</td>
                <td className="py-1.5 text-[#52525b]">{fmtTime(evt.timestamp)}</td>
                <td className="py-1.5 text-[#a1a1aa]">{evt.agent}</td>
                <td className="py-1.5 text-[#52525b]">{evt.message}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
