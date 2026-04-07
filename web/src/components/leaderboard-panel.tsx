"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchLeaderboard, truncAddr } from "../lib/api";

export function LeaderboardPanel(): React.ReactNode {
  const { data } = useQuery({
    queryKey: ["leaderboard"],
    queryFn: fetchLeaderboard,
    refetchInterval: 30_000,
  });

  const leaders = Array.isArray(data?.data) ? (data.data as Record<string, unknown>[]).slice(0, 4) : [];

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between py-3 border-t border-white/[0.06]">
        <span className="text-[10px] font-medium text-[#52525b] uppercase tracking-wider">Top Traders — 7d</span>
        <span className="text-[10px] text-[#a1a1aa] cursor-pointer hover:text-[#fafafa] transition-colors">
          View all &rarr;
        </span>
      </div>
      {leaders.length === 0 ? (
        <p className="text-xs text-[#52525b] font-mono">No leaderboard data.</p>
      ) : (
        <div className="flex font-mono text-[11px]">
          {leaders.map((l, i) => (
            <div
              key={i}
              className={`flex-1 py-2 ${i < leaders.length - 1 ? "border-r border-white/[0.04]" : ""}`}
            >
              <div className="text-[10px] text-[#52525b]">{truncAddr(String(l.address ?? l.walletAddress ?? ""))}</div>
              <div className="text-[#34d399] font-medium">
                {l.pnl ?? l.realizedPnlUsd ? `+$${Number(l.pnl ?? l.realizedPnlUsd).toLocaleString()}` : "—"}
              </div>
              <div className="text-[9px] text-[#52525b] mt-0.5">
                {l.winRate ? `${l.winRate}% win` : ""}{l.tradeCount ? ` · ${l.tradeCount} trades` : ""}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
