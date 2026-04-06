"use client";

import {
  Radar,
  Shield,
  Coins,
  Eye,
  Clock,
  ShieldCheck,
  ShieldX,
  Search,
  ArrowUpCircle,
  XCircle,
  FileText,
  TrendingUp,
  RefreshCw,
  ArrowLeftRight,
} from "lucide-react";
import { useAgentEvents, type AgentEvent } from "../lib/ws";
import type { ComponentType } from "react";

const AGENT_COLORS: Record<string, string> = {
  Scanner: "#22d3ee",
  Analyst: "#6366f1",
  Executor: "#34d399",
  Sentinel: "#f59e0b",
  Cron: "#7a7f8a",
};

const AGENT_ICONS: Record<
  string,
  ComponentType<{ className?: string }>
> = {
  Scanner: Radar,
  Analyst: Shield,
  Executor: Coins,
  Sentinel: Eye,
  Cron: Clock,
};

const EVENT_CONFIG: Record<
  string,
  { Icon: ComponentType<{ className?: string }>; dotColor: string }
> = {
  verdict: { Icon: ShieldCheck, dotColor: "#34d399" },
  invest: { Icon: ArrowUpCircle, dotColor: "#34d399" },
  scan: { Icon: Search, dotColor: "#22d3ee" },
  buy_service: { Icon: Coins, dotColor: "#f59e0b" },
  sell_service: { Icon: TrendingUp, dotColor: "#6366f1" },
  swap: { Icon: ArrowLeftRight, dotColor: "#22d3ee" },
  reinvest: { Icon: RefreshCw, dotColor: "#34d399" },
  error: { Icon: XCircle, dotColor: "#ef4444" },
  log: { Icon: FileText, dotColor: "#7a7f8a" },
};

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString("en-US", { hour12: false });
}

function EventRow({
  event,
  isOdd,
}: {
  event: AgentEvent;
  isOdd: boolean;
}): React.ReactNode {
  const agentColor = AGENT_COLORS[event.agent] ?? "#7a7f8a";
  const AgentIcon = AGENT_ICONS[event.agent] ?? FileText;
  const eventCfg = EVENT_CONFIG[event.type] ?? {
    Icon: FileText,
    dotColor: "#7a7f8a",
  };

  return (
    <div
      className={`flex items-start gap-3 py-2 px-4 ${
        isOdd ? "bg-[#0f1116]/40" : ""
      }`}
    >
      {/* Colored dot */}
      <span
        className="shrink-0 mt-1.5 h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: eventCfg.dotColor }}
      />

      {/* Timestamp */}
      <span className="text-[11px] text-[#7a7f8a]/60 shrink-0 w-14 tabular-nums font-mono pt-px">
        {formatTime(event.timestamp)}
      </span>

      {/* Agent badge */}
      <span
        className="inline-flex items-center gap-1 shrink-0 text-[11px] font-medium"
        style={{ color: agentColor }}
      >
        <AgentIcon className="h-3 w-3" />
        {event.agent}
      </span>

      {/* Message */}
      <span className="text-xs text-[#7a7f8a] flex-1 break-words">
        {event.message}
      </span>

      {/* TX link */}
      {event.txHash && (
        <a
          href={`https://www.oklink.com/xlayer/tx/${event.txHash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[11px] text-[#6366f1] hover:text-[#818cf8] shrink-0 transition-colors font-mono"
        >
          tx
        </a>
      )}
    </div>
  );
}

export function LiveFeed(): React.ReactNode {
  const { events, connected } = useAgentEvents();

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] uppercase tracking-[0.15em] text-[#7a7f8a]">
          Live Events
        </span>
        <div className="flex items-center gap-2">
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{
              backgroundColor: connected ? "#22d3ee" : "#ef4444",
              boxShadow: connected
                ? "0 0 6px rgba(34, 211, 238, 0.4)"
                : "none",
            }}
          />
          <span className="text-[11px] text-[#7a7f8a]/60">
            {connected ? "Connected" : "Disconnected"}
          </span>
        </div>
      </div>

      {/* Event list */}
      <div className="max-h-80 overflow-y-auto feed-scroll rounded-md border border-[#1a1d24]/50">
        {events.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12">
            <Radar className="h-5 w-5 text-[#1a1d24] mb-2" />
            <p className="text-xs text-[#7a7f8a]/40">
              Waiting for agent activity...
            </p>
          </div>
        )}
        {[...events].reverse().map((event, i) => (
          <EventRow
            key={`${event.timestamp}-${i}`}
            event={event}
            isOdd={i % 2 === 1}
          />
        ))}
      </div>
    </div>
  );
}
