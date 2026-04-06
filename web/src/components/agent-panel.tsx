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
  if (!addr) return "—";
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
      <div className="flex items-center flex-wrap gap-x-6 gap-y-2">
        {agents.map((agent, i) => {
          const Icon = ROLE_ICONS[agent.role] ?? Radar;
          const color = ROLE_COLORS[agent.role] ?? "#a1a1aa";
          const isActive =
            agent.status === "active" || agent.status === "running";

          return (
            <div key={agent.id} className="flex items-center gap-x-6">
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
                <span className="text-[11px] font-mono text-[#a1a1aa]/60">
                  {truncateAddress(agent.address)}
                </span>
                <span className="text-[11px] font-mono text-[#a1a1aa]/40">
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
                      backgroundColor: isActive ? color : "#a1a1aa",
                    }}
                  />
                </span>
              </div>

              {/* Separator dot */}
              {i < agents.length - 1 && (
                <span className="text-[#27272a] select-none hidden sm:inline">
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
