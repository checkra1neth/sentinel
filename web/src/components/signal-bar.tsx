"use client";

import { useAgentEvents } from "../lib/ws";
import { timeAgo } from "../lib/api";

const SIGNAL_COLORS: Record<string, string> = {
  whale: "#34d399",
  smart_money: "#a78bfa",
  kol: "#f59e0b",
  scanner: "#06b6d4",
  signal_smart_money: "#a78bfa",
  signal_kol: "#f59e0b",
  signal_whale: "#34d399",
};

function getSignalLabel(tracker: string): string {
  if (tracker.includes("whale")) return "whale";
  if (tracker.includes("smart")) return "smart money";
  if (tracker.includes("kol")) return "kol";
  return tracker;
}

export function SignalBar(): React.ReactNode {
  const { events, connected } = useAgentEvents();

  const signals = events
    .filter((e) => ["new-token", "verdict", "signal"].some((t) => e.type.includes(t)))
    .slice(-10)
    .reverse();

  return (
    <div className="border-b border-white/[0.06] py-1.5 font-mono text-[11px] text-[#52525b] overflow-hidden whitespace-nowrap flex items-center gap-1.5">
      <span
        className="inline-block w-[5px] h-[5px] rounded-full flex-shrink-0"
        style={{ background: connected ? "#34d399" : "#ef4444" }}
      />
      <span className="text-[10px] text-[#a1a1aa] uppercase tracking-wider mr-2">live</span>
      {signals.length === 0 && <span>Waiting for signals...</span>}
      {signals.map((evt, i) => (
        <span key={`${evt.timestamp}-${i}`}>
          {i > 0 && <span className="mx-3" style={{ color: "rgba(255,255,255,0.06)" }}>|</span>}
          <span style={{ color: SIGNAL_COLORS[String(evt.details?.tracker ?? "scanner")] ?? "#a1a1aa" }}>
            {getSignalLabel(String(evt.details?.tracker ?? evt.type))}
          </span>{" "}
          <span className="text-[#fafafa]">{String(evt.details?.tokenSymbol ?? evt.details?.token ?? "").slice(0, 10)}</span>{" "}
          <span>{evt.details?.amount ? `$${Number(evt.details.amount).toLocaleString()}` : ""}</span>
          <span className="ml-1">&mdash; {timeAgo(evt.timestamp)}</span>
        </span>
      ))}
    </div>
  );
}
