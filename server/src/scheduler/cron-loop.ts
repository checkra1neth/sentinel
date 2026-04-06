import cron from "node-cron";
import { type ScannerAgent } from "../agents/scanner-agent.js";
import { type DecisionEngine } from "../agents/decision-engine.js";
import type { AgentEvent } from "../types.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SentinelLoopResult {
  task: cron.ScheduledTask;
  stop: () => void;
}

// ---------------------------------------------------------------------------
// Sentinel Cron Loop
// ---------------------------------------------------------------------------

export function startSentinelLoop(
  scanner: ScannerAgent,
  decisionEngine: DecisionEngine,
  cronInterval: string,
  onEvent?: (event: AgentEvent) => void,
): SentinelLoopResult {
  const emit = (
    type: AgentEvent["type"],
    message: string,
    details?: Record<string, unknown>,
  ): void => {
    if (!onEvent) return;
    onEvent({
      timestamp: Date.now(),
      agent: "cron-loop",
      type,
      message,
      details,
    });
  };

  const task = cron.schedule(cronInterval, async () => {
    emit("scan", "Sentinel cron: starting scanner discovery");

    try {
      // 1. Scanner discovers new tokens
      const newTokens = await scanner.autonomousLoop();

      emit("scan", `Scanner found ${newTokens.length} new tokens`, {
        count: newTokens.length,
      });

      // 2. If any new tokens -> feed to decision engine
      if (newTokens.length > 0) {
        const tokenPayload = newTokens.map((t) => ({
          address: t.address,
          source: t.source,
        }));

        await decisionEngine.onTokensDiscovered(tokenPayload);

        emit("scan", "Sentinel cron: decision engine processing complete", {
          processed: tokenPayload.length,
        });
      } else {
        emit("scan", "Sentinel cron: no new tokens discovered");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      emit("error", `Sentinel cron error: ${message}`);
    }
  });

  console.log(`[cron] Sentinel loop scheduled: ${cronInterval}`);

  const stop = (): void => {
    task.stop();
    console.log("[cron] Sentinel loop stopped");
  };

  return { task, stop };
}
