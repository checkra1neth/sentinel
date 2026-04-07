"use client";

import { useState, useEffect, useCallback } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002";

interface Agent {
  name: string;
  walletAddress: string;
}

function truncAddr(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
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
    } catch { /* */ }
  }, []);

  useEffect(() => {
    fetchAgents();
    const iv = setInterval(fetchAgents, 10_000);
    return () => clearInterval(iv);
  }, [fetchAgents]);

  if (agents.length === 0) return null;

  return (
    <div className="mb-6 text-xs font-mono text-[#52525b] flex flex-wrap gap-x-4 gap-y-1">
      {agents.map((a) => (
        <span key={a.name}>
          <span className="text-[#a1a1aa]">{a.name}</span>{" "}
          {truncAddr(a.walletAddress)}
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#34d399] ml-1.5 align-middle" />
        </span>
      ))}
    </div>
  );
}
