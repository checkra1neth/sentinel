"use client";

import { useAgentEvents, type AgentEvent } from "../lib/ws";

const AGENT_COLORS: Record<string, string> = {
  Scanner: "text-blue-400",
  Analyst: "text-purple-400",
  Executor: "text-emerald-400",
  Sentinel: "text-yellow-400",
  Cron: "text-gray-400",
};

const EVENT_ICONS: Record<string, string> = {
  verdict: "\uD83D\uDEE1\uFE0F",
  invest: "\uD83D\uDCB0",
  scan: "\uD83D\uDD0D",
  buy_service: "\uD83D\uDCB0",
  sell_service: "\uD83D\uDCC8",
  swap: "\uD83D\uDD04",
  reinvest: "\uD83C\uDF31",
  error: "\u26A0\uFE0F",
};

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString("en-US", { hour12: false });
}

function EventRow({ event }: { event: AgentEvent }): React.ReactNode {
  const agentColor = AGENT_COLORS[event.agent] ?? "text-gray-400";
  const icon = EVENT_ICONS[event.type] ?? "\u2022";

  return (
    <div className="flex items-start gap-2 py-1.5 border-b border-gray-800/50 last:border-0">
      <span className="text-xs text-gray-600 shrink-0 w-18">
        {formatTime(event.timestamp)}
      </span>
      <span className="shrink-0 w-5 text-center">{icon}</span>
      <span className={`text-xs font-semibold shrink-0 ${agentColor}`}>
        [{event.agent}]
      </span>
      <span className="text-xs text-gray-300 flex-1 break-words">
        {event.message}
      </span>
      {event.txHash && (
        <a
          href={`https://www.oklink.com/xlayer/tx/${event.txHash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-emerald-500 hover:text-emerald-400 shrink-0 underline"
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
    <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white">Live Event Feed</h2>
        <div className="flex items-center gap-2">
          <span
            className={`h-2 w-2 rounded-full ${
              connected ? "bg-emerald-400" : "bg-red-400"
            }`}
          />
          <span className="text-xs text-gray-500">
            {connected ? "Connected" : "Disconnected"}
          </span>
        </div>
      </div>

      <div className="max-h-96 overflow-y-auto font-mono">
        {events.length === 0 && (
          <p className="text-sm text-gray-500 text-center py-8">
            No events yet. Waiting for agent activity...
          </p>
        )}
        {[...events].reverse().map((event, i) => (
          <EventRow key={`${event.timestamp}-${i}`} event={event} />
        ))}
      </div>
    </div>
  );
}
