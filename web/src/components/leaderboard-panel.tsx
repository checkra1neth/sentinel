"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchLeaderboard, truncAddr, REFETCH_NORMAL } from "../lib/api";

const TIME_FRAMES = [
  { label: "1d", value: "1" },
  { label: "3d", value: "3" },
  { label: "7d", value: "7" },
] as const;

export function LeaderboardPanel(): React.ReactNode {
  const [timeFrame, setTimeFrame] = useState("3");

  const { data } = useQuery({
    queryKey: ["leaderboard", timeFrame],
    queryFn: () => fetchLeaderboard(timeFrame),
    refetchInterval: REFETCH_NORMAL,
  });

  const leaders = Array.isArray(data?.data) ? (data.data as Record<string, unknown>[]).slice(0, 4) : [];

  const timeLabel = TIME_FRAMES.find((t) => t.value === timeFrame)?.label ?? "3d";

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between py-3 border-t border-white/[0.06]">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-medium text-[#52525b] uppercase tracking-wider">Top Traders — {timeLabel}</span>
          <div className="flex gap-1">
            {TIME_FRAMES.map((tf) => (
              <button
                key={tf.value}
                type="button"
                onClick={() => setTimeFrame(tf.value)}
                className={`px-2.5 py-1 rounded text-[10px] font-mono border transition-colors cursor-pointer ${
                  timeFrame === tf.value
                    ? "border-[#06b6d4]/40 text-[#06b6d4] bg-[#06b6d4]/10"
                    : "border-white/[0.06] text-[#52525b] hover:text-[#a1a1aa]"
                }`}
              >
                {tf.label}
              </button>
            ))}
          </div>
        </div>
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
