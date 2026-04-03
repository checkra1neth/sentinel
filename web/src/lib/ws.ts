"use client";

import { useState, useEffect, useRef, useCallback } from "react";

export interface AgentEvent {
  timestamp: number;
  agent: string;
  type: string;
  message: string;
  txHash?: string;
  details?: Record<string, unknown>;
}

const WS_URL =
  process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:3002/api/events";

const MAX_EVENTS = 100;
const RECONNECT_DELAY = 3000;

export function useAgentEvents(): {
  events: AgentEvent[];
  connected: boolean;
} {
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const connect = useCallback((): void => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = (): void => {
      setConnected(true);
    };

    ws.onmessage = (event: MessageEvent): void => {
      try {
        const data = JSON.parse(event.data as string) as {
          type: string;
          events?: AgentEvent[];
          event?: AgentEvent;
        };

        if (data.type === "history" && data.events) {
          setEvents(data.events.slice(-MAX_EVENTS));
        } else if (data.type === "event" && data.event) {
          setEvents((prev) => [...prev, data.event!].slice(-MAX_EVENTS));
        }
      } catch {
        // ignore malformed messages
      }
    };

    ws.onclose = (): void => {
      setConnected(false);
      wsRef.current = null;
      reconnectTimer.current = setTimeout(connect, RECONNECT_DELAY);
    };

    ws.onerror = (): void => {
      ws.close();
    };
  }, []);

  useEffect(() => {
    connect();

    return (): void => {
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
      }
      wsRef.current?.close();
    };
  }, [connect]);

  return { events, connected };
}
