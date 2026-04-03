import { type Server as HttpServer } from "http";
import { WebSocketServer, type WebSocket } from "ws";
import type { AgentEvent } from "../types.js";

// ---------------------------------------------------------------------------
// EventBus
// ---------------------------------------------------------------------------

export class EventBus {
  private history: AgentEvent[] = [];
  private wss: WebSocketServer | null = null;
  private readonly maxHistory = 1000;

  /** Attach WebSocket server to the given http.Server on /api/events path. */
  attachToServer(server: HttpServer): void {
    this.wss = new WebSocketServer({ server, path: "/api/events" });

    this.wss.on("connection", (ws: WebSocket) => {
      // Send last 50 events on connect
      const recentEvents = this.history.slice(-50);
      ws.send(JSON.stringify({ type: "history", events: recentEvents }));
    });

    console.log("[event-bus] WebSocket server attached on /api/events");
  }

  /** Store event in history and broadcast to all connected WebSocket clients. */
  emit(event: AgentEvent): void {
    this.history.push(event);

    // Trim history to max size
    if (this.history.length > this.maxHistory) {
      this.history = this.history.slice(-this.maxHistory);
    }

    // Broadcast to all connected clients
    if (this.wss) {
      const payload = JSON.stringify({ type: "event", event });
      for (const client of this.wss.clients) {
        if (client.readyState === 1) {
          // WebSocket.OPEN
          try {
            client.send(payload);
          } catch {
            // Ignore send errors on stale connections
          }
        }
      }
    }
  }

  /** Get recent event history. */
  getHistory(limit = 100): AgentEvent[] {
    return this.history.slice(-limit);
  }

  /** Get aggregated stats across all events. */
  getStats(): {
    totalEvents: number;
    byAgent: Record<string, number>;
    byType: Record<string, number>;
  } {
    const byAgent: Record<string, number> = {};
    const byType: Record<string, number> = {};

    for (const event of this.history) {
      byAgent[event.agent] = (byAgent[event.agent] ?? 0) + 1;
      byType[event.type] = (byType[event.type] ?? 0) + 1;
    }

    return {
      totalEvents: this.history.length,
      byAgent,
      byType,
    };
  }
}

/** Singleton event bus instance. */
export const eventBus = new EventBus();
