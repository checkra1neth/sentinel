"use client";

import { useState, useEffect, useCallback } from "react";
import { Radar, Shield, Coins } from "lucide-react";
import type { ComponentType } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002";
const POLL_INTERVAL = 10_000;

interface Agent {
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
  Scanner: "#22d3ee",
  Analyst: "#6366f1",
  Executor: "#34d399",
};

function truncateAddress(addr: string): string {
  if (addr.length < 12) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-2)}`;
}

export function AgentPanel(): React.ReactNode {
  const [agents, setAgents] = useState<Agent[]>([]);

  const fetchAgents = useCallback(async (): Promise<void> => {
    try {
      const res = await fetch(`${API_URL}/api/agents`);
      if (res.ok) {
        const data = (await res.json()) as { agents?: Agent[] };
        setAgents(data.agents ?? []);
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
      <div className="flex items-center flex-wrap gap-x-6 gap-y-2">
        {agents.map((agent, i) => {
          const Icon = ROLE_ICONS[agent.role] ?? Radar;
          const color = ROLE_COLORS[agent.role] ?? "#7a7f8a";
          const isActive =
            agent.status === "active" || agent.status === "running";

          return (
            <div key={agent.role} className="flex items-center gap-x-6">
              <div className="flex items-center gap-2">
                <span className="shrink-0" style={{ color }}>
                  <Icon className="h-3 w-3" />
                </span>
                <span
                  className="text-[11px] font-semibold uppercase tracking-[0.15em]"
                  style={{ color }}
                >
                  {agent.role}
                </span>
                <span className="text-[11px] font-mono text-[#7a7f8a]/60">
                  {truncateAddress(agent.address)}
                </span>
                <span className="text-[11px] font-mono text-[#7a7f8a]/40">
                  {agent.balance} USDT
                </span>
                <span className="relative flex h-1.5 w-1.5 shrink-0">
                  {isActive && (
                    <span
                      className="absolute inline-flex h-full w-full rounded-full opacity-50 animate-ping"
                      style={{ backgroundColor: color }}
                    />
                  )}
                  <span
                    className="relative inline-flex h-1.5 w-1.5 rounded-full"
                    style={{
                      backgroundColor: isActive ? color : "#7a7f8a",
                    }}
                  />
                </span>
              </div>

              {/* Separator dot */}
              {i < agents.length - 1 && (
                <span className="text-[#1a1d24] select-none hidden sm:inline">
                  /
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
