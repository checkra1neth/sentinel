"use client";

import { useState, useEffect, useCallback } from "react";
import { AgentCard } from "../../components/agent-card";
import { EconomyStats } from "../../components/economy-stats";
import { LiveFeed } from "../../components/live-feed";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3002";
const POLL_INTERVAL = 10_000;

interface AgentData {
  name: string;
  role: string;
  wallet: string;
  balance: string;
  services: unknown[];
  status?: "active" | "idle" | "error";
}

interface EconomyData {
  totalEvents: number;
  byAgent: Record<string, number>;
  byType: Record<string, number>;
}

export default function DashboardPage(): React.ReactNode {
  const [agents, setAgents] = useState<AgentData[]>([]);
  const [economy, setEconomy] = useState<EconomyData>({
    totalEvents: 0,
    byAgent: {},
    byType: {},
  });

  const fetchData = useCallback(async (): Promise<void> => {
    try {
      const [agentsRes, economyRes] = await Promise.all([
        fetch(`${API_URL}/api/agents`),
        fetch(`${API_URL}/api/economy/stats`),
      ]);

      if (agentsRes.ok) {
        const data = (await agentsRes.json()) as AgentData[];
        setAgents(data);
      }

      if (economyRes.ok) {
        const data = (await economyRes.json()) as EconomyData;
        setEconomy(data);
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
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="mt-2 text-gray-400">
          Real-time view of the Agentra agent economy on X Layer.
        </p>
      </div>

      <div className="mb-8">
        <EconomyStats totalEvents={economy.totalEvents} byType={economy.byType} />
      </div>

      {agents.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-white mb-4">Agents</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {agents.map((agent) => (
              <AgentCard
                key={agent.wallet}
                name={agent.name}
                role={agent.role}
                wallet={agent.wallet}
                balance={agent.balance}
                servicesCount={agent.services.length}
                status={agent.status ?? "idle"}
              />
            ))}
          </div>
        </div>
      )}

      <LiveFeed />
    </div>
  );
}
