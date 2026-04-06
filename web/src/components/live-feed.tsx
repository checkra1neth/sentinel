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
  Wifi,
  WifiOff,
  TrendingUp,
  RefreshCw,
  ArrowLeftRight,
} from "lucide-react";
import { useAgentEvents, type AgentEvent } from "../lib/ws";
import type { ComponentType } from "react";

const AGENT_CONFIG: Record<
  string,
  { color: string; bgColor: string; Icon: ComponentType<{ className?: string }> }
> = {
  Scanner: { color: "text-cyan-400", bgColor: "bg-cyan-400/10", Icon: Radar },
  Analyst: { color: "text-purple-400", bgColor: "bg-purple-400/10", Icon: Shield },
  Executor: { color: "text-emerald-400", bgColor: "bg-emerald-400/10", Icon: Coins },
  Sentinel: { color: "text-amber-400", bgColor: "bg-amber-400/10", Icon: Eye },
  Cron: { color: "text-slate-400", bgColor: "bg-slate-400/10", Icon: Clock },
};

const EVENT_ICONS: Record<
  string,
  { Icon: ComponentType<{ className?: string }>; color: string }
> = {
  verdict: { Icon: ShieldCheck, color: "text-emerald-400" },
  invest: { Icon: ArrowUpCircle, color: "text-emerald-400" },
  scan: { Icon: Search, color: "text-cyan-400" },
  buy_service: { Icon: Coins, color: "text-amber-400" },
  sell_service: { Icon: TrendingUp, color: "text-purple-400" },
  swap: { Icon: ArrowLeftRight, color: "text-cyan-400" },
  reinvest: { Icon: RefreshCw, color: "text-emerald-400" },
  error: { Icon: XCircle, color: "text-red-400" },
  log: { Icon: FileText, color: "text-slate-500" },
};

const SEVERITY_BORDERS: Record<string, string> = {
  verdict: "border-l-emerald-500/50",
  invest: "border-l-emerald-500/50",
  scan: "border-l-cyan-500/30",
  buy_service: "border-l-amber-500/30",
  sell_service: "border-l-purple-500/30",
  swap: "border-l-cyan-500/30",
  reinvest: "border-l-emerald-500/30",
  error: "border-l-red-500/50",
  log: "border-l-slate-700",
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
  const agentCfg = AGENT_CONFIG[event.agent] ?? {
    color: "text-slate-400",
    bgColor: "bg-slate-400/10",
    Icon: FileText,
  };
  const eventCfg = EVENT_ICONS[event.type] ?? {
    Icon: FileText,
    color: "text-slate-500",
  };
  const borderColor = SEVERITY_BORDERS[event.type] ?? "border-l-slate-700";
  const { Icon: AgentIcon } = agentCfg;
  const { Icon: EventIcon } = eventCfg;

  return (
    <div
      className={`flex items-start gap-2 py-2 px-3 border-l-2 ${borderColor} ${
        isOdd ? "bg-slate-900/30" : ""
      }`}
    >
      <span className="text-[11px] text-slate-600 shrink-0 w-16 tabular-nums pt-0.5">
        {formatTime(event.timestamp)}
      </span>
      <EventIcon className={`h-3.5 w-3.5 shrink-0 mt-0.5 ${eventCfg.color}`} />
      <span
        className={`inline-flex items-center gap-1 shrink-0 rounded px-1.5 py-0.5 text-[11px] font-semibold ${agentCfg.color} ${agentCfg.bgColor}`}
      >
        <AgentIcon className="h-3 w-3" />
        {event.agent}
      </span>
      <span className="text-xs text-slate-300 flex-1 break-words">
        {event.message}
      </span>
      {event.txHash && (
        <a
          href={`https://www.oklink.com/xlayer/tx/${event.txHash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[11px] text-cyan-400 hover:text-cyan-300 shrink-0 transition-colors"
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
    <div className="rounded-xl border border-slate-800 bg-[#111827] overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800/50">
        <span className="text-[11px] uppercase tracking-wider text-slate-500">
          Live Events
        </span>
        <div className="flex items-center gap-2">
          {connected ? (
            <Wifi className="h-3.5 w-3.5 text-emerald-400" />
          ) : (
            <WifiOff className="h-3.5 w-3.5 text-red-400" />
          )}
          <span className="text-[11px] text-slate-500">
            {connected ? "Connected" : "Disconnected"}
          </span>
        </div>
      </div>

      <div className="max-h-96 overflow-y-auto font-mono">
        {events.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12">
            <Radar className="h-6 w-6 text-slate-700 mb-2" />
            <p className="text-xs text-slate-600">
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
