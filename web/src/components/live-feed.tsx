"use client";

import { useAgentEvents } from "../lib/ws";

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString("en-US", { hour12: false });
}

export function LiveFeed(): React.ReactNode {
  const { events, connected } = useAgentEvents();

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-[#52525b] uppercase tracking-wider">Activity</span>
        <span className="text-xs font-mono text-[#52525b]">
          {connected ? "connected" : "disconnected"}
        </span>
      </div>
      <div className="max-h-60 overflow-y-auto feed-scroll font-mono text-xs text-[#52525b] space-y-0.5">
        {events.length === 0 && <p>Waiting for agent events...</p>}
        {[...events].reverse().slice(0, 50).map((evt, i) => (
          <div key={`${evt.timestamp}-${i}`}>
            <span className="text-[#a1a1aa]/40">{formatTime(evt.timestamp)}</span>{" "}
            <span className="text-[#a1a1aa]">{evt.agent}</span>{" "}
            {evt.message}
          </div>
        ))}
      </div>
    </div>
  );
}
