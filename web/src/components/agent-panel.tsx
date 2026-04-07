"use client";

import { useState, useEffect, useCallback } from "react";
import { Radar, Shield, Coins } from "lucide-react";
import type { ComponentType } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002";
const POLL_INTERVAL = 10_000;

interface Agent {
  id: string;
  role: string;
  address: string;
  balance: string;
  status: string;
}

const ROLE_ICONS: Record<string, ComponentType<{ className?: string }>> = {
  Scanner: Radar,
  Analyst: Shield,
  Executor: Coins,
};

const ROLE_COLORS: Record<string, string> = {
  Scanner: "#06b6d4",
  Analyst: "#8b5cf6",
  Executor: "#34d399",
};

function truncateAddress(addr: string | undefined): string {
  if (!addr) return "--";
  if (addr.length < 12) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export function AgentPanel(): React.ReactNode {
  const [agents, setAgents] = useState<Agent[]>([]);

  const fetchAgents = useCallback(async (): Promise<void> => {
    try {
      const res = await fetch(`${API_URL}/api/agents`);
      if (res.ok) {
        const data = (await res.json()) as { agents?: Array<Record<string, string>> };
        setAgents(
          (data.agents ?? []).map((a) => ({
            id: a.id || a.name,
            role: a.name || a.role || "Unknown",
            address: a.walletAddress || a.wallet || a.address || "",
            balance: a.usdtBalance || a.balance || "0",
            status: a.status || "active",
          })),
        );
      }
    } catch {
      // server unavailable
    }
  }, []);

  useEffect(() => {
    fetchAgents();
    const interval = setInterval(() => {
      fetchAgents();
    }, POLL_INTERVAL);
    return (): void => clearInterval(interval);
  }, [fetchAgents]);

  if (agents.length === 0) return null;

  return (
    <div className="mb-8">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-0 rounded-lg border border-white/[0.06] overflow-hidden">
        {agents.map((agent, i) => {
          const Icon = ROLE_ICONS[agent.role] ?? Radar;
          const color = ROLE_COLORS[agent.role] ?? "#a1a1aa";
          const isActive = agent.status === "active" || agent.status === "running";

          return (
            <div
              key={agent.id}
              className="flex items-center gap-3 px-4 py-3 relative"
              style={{
                background: `linear-gradient(90deg, ${color}08 0%, transparent 100%)`,
                borderLeft: i === 0 ? "none" : undefined,
              }}
            >

              <Icon className="h-4 w-4 shrink-0" style={{ color }} />

              <span
                className="text-[11px] font-bold uppercase tracking-[0.12em] shrink-0"
                style={{ color }}
              >
                {agent.role}
              </span>

              <span className="text-[11px] font-mono text-[#a1a1aa]/50 flex-1 truncate">
                {truncateAddress(agent.address)}
              </span>

              {/* Status dot */}
              <span className="relative flex h-2 w-2 shrink-0">
                {isActive && (
                  <span
                    className="absolute inline-flex h-full w-full rounded-full opacity-40 animate-ping"
                    style={{ backgroundColor: color }}
                  />
                )}
                <span
                  className="relative inline-flex h-2 w-2 rounded-full"
                  style={{ backgroundColor: isActive ? color : "#a1a1aa" }}
                />
              </span>

              {/* Arrow separator between agents */}
              {i < agents.length - 1 && (
                <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 z-10 hidden sm:flex items-center justify-center w-5 h-5 rounded-full bg-[#09090b] border border-white/[0.06]">
                  <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                    <path d="M2 1L5 4L2 7" stroke="#a1a1aa" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" opacity="0.4" />
                  </svg>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
