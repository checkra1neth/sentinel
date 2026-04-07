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
  Scanner: "#06b6d4",
  Analyst: "#8b5cf6",
  Executor: "#34d399",
  Sentinel: "#f59e0b",
  Cron: "#a1a1aa",
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
  scan: { Icon: Search, dotColor: "#06b6d4" },
  buy_service: { Icon: Coins, dotColor: "#f59e0b" },
  sell_service: { Icon: TrendingUp, dotColor: "#8b5cf6" },
  swap: { Icon: ArrowLeftRight, dotColor: "#06b6d4" },
  reinvest: { Icon: RefreshCw, dotColor: "#34d399" },
  error: { Icon: XCircle, dotColor: "#ef4444" },
  log: { Icon: FileText, dotColor: "#a1a1aa" },
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
  const agentColor = AGENT_COLORS[event.agent] ?? "#a1a1aa";
  const AgentIcon = AGENT_ICONS[event.agent] ?? FileText;
  const eventCfg = EVENT_CONFIG[event.type] ?? {
    Icon: FileText,
    dotColor: "#a1a1aa",
  };

  return (
    <div
      className={`flex items-start gap-3 py-2 px-4 ${
        isOdd ? "bg-[#18181b]/40" : ""
      }`}
    >
      {/* Colored dot */}
      <span
        className="shrink-0 mt-1.5 h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: eventCfg.dotColor }}
      />

      {/* Timestamp */}
      <span className="text-[11px] text-[#a1a1aa]/60 shrink-0 w-14 tabular-nums font-mono pt-px">
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
      <span className="text-xs text-[#a1a1aa] flex-1 break-words">
        {event.message}
      </span>

      {/* TX link */}
      {event.txHash && (
        <a
          href={`https://www.oklink.com/xlayer/tx/${event.txHash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[11px] text-[#8b5cf6] hover:text-[#a78bfa] shrink-0 transition-colors font-mono"
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
        <span className="text-[11px] uppercase tracking-[0.15em] text-[#a1a1aa]">
          Live Events
        </span>
        <div className="flex items-center gap-2">
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{
              backgroundColor: connected ? "#06b6d4" : "#ef4444",
              boxShadow: "none",
            }}
          />
          <span className="text-[11px] text-[#a1a1aa]/60">
            {connected ? "Connected" : "Disconnected"}
          </span>
        </div>
      </div>

      {/* Event list */}
      <div className="max-h-80 overflow-y-auto feed-scroll rounded-lg border border-white/[0.06]">
        {events.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12">
            <Radar className="h-5 w-5 text-[#27272a] mb-2" />
            <p className="text-xs text-[#a1a1aa]/40">
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
