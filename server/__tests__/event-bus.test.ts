import { describe, it, expect, beforeEach } from "vitest";
import { EventBus } from "../src/events/event-bus.js";
import type { AgentEvent } from "../src/types.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEvent(overrides: Partial<AgentEvent> = {}): AgentEvent {
  return {
    timestamp: Date.now(),
    agent: "test-agent",
    type: "scan",
    message: "test event",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("EventBus", () => {
  let bus: EventBus;

  beforeEach(() => {
    bus = new EventBus();
  });

  it("emit stores events in history", () => {
    bus.emit(makeEvent({ message: "event 1" }));
    bus.emit(makeEvent({ message: "event 2" }));
    bus.emit(makeEvent({ message: "event 3" }));

    const history = bus.getHistory();
    expect(history).toHaveLength(3);
    expect(history[0].message).toBe("event 1");
    expect(history[2].message).toBe("event 3");
  });

  it("getHistory returns correct count with limit", () => {
    for (let i = 0; i < 10; i++) {
      bus.emit(makeEvent({ message: `event ${i}` }));
    }

    const history = bus.getHistory(3);
    expect(history).toHaveLength(3);
    // Should return the LAST 3 events
    expect(history[0].message).toBe("event 7");
    expect(history[1].message).toBe("event 8");
    expect(history[2].message).toBe("event 9");
  });

  it("getHistory returns all events if limit exceeds total", () => {
    bus.emit(makeEvent({ message: "only one" }));

    const history = bus.getHistory(100);
    expect(history).toHaveLength(1);
    expect(history[0].message).toBe("only one");
  });

  it("getStats aggregates by agent", () => {
    bus.emit(makeEvent({ agent: "analyst" }));
    bus.emit(makeEvent({ agent: "analyst" }));
    bus.emit(makeEvent({ agent: "auditor" }));
    bus.emit(makeEvent({ agent: "trader" }));

    const stats = bus.getStats();
    expect(stats.totalEvents).toBe(4);
    expect(stats.byAgent.analyst).toBe(2);
    expect(stats.byAgent.auditor).toBe(1);
    expect(stats.byAgent.trader).toBe(1);
  });

  it("getStats aggregates by type", () => {
    bus.emit(makeEvent({ type: "scan" }));
    bus.emit(makeEvent({ type: "scan" }));
    bus.emit(makeEvent({ type: "buy_service" }));
    bus.emit(makeEvent({ type: "error" }));
    bus.emit(makeEvent({ type: "reinvest" }));

    const stats = bus.getStats();
    expect(stats.totalEvents).toBe(5);
    expect(stats.byType.scan).toBe(2);
    expect(stats.byType.buy_service).toBe(1);
    expect(stats.byType.error).toBe(1);
    expect(stats.byType.reinvest).toBe(1);
  });

  it("getStats returns zeros when empty", () => {
    const stats = bus.getStats();
    expect(stats.totalEvents).toBe(0);
    expect(Object.keys(stats.byAgent)).toHaveLength(0);
    expect(Object.keys(stats.byType)).toHaveLength(0);
  });

  it("trims history when exceeding maxHistory", () => {
    // EventBus has maxHistory of 1000
    for (let i = 0; i < 1050; i++) {
      bus.emit(makeEvent({ message: `event ${i}` }));
    }

    const history = bus.getHistory(2000);
    expect(history.length).toBeLessThanOrEqual(1000);
    // Most recent event should be the last one pushed
    expect(history[history.length - 1].message).toBe("event 1049");
  });

  it("emit does not throw when no WebSocket server attached", () => {
    expect(() => {
      bus.emit(makeEvent());
    }).not.toThrow();
  });
});
