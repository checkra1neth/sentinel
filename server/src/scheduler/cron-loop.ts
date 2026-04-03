import cron from "node-cron";
import { type BaseAgent } from "../agents/base-agent.js";
import { type DecisionEngine } from "../agents/decision-engine.js";
import type { AgentEvent } from "../types.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CronAgents {
  analyst: BaseAgent;
  auditor: BaseAgent;
  trader: BaseAgent;
}

interface CronConfig {
  analystCron: string;
  reinvestCron: string;
}

export interface CronResult {
  analystTask: cron.ScheduledTask;
  stop: () => void;
}

// ---------------------------------------------------------------------------
// Cron Loop
// ---------------------------------------------------------------------------

export function startCronLoop(
  agents: CronAgents,
  decisionEngine: DecisionEngine,
  cronConfig: CronConfig,
  onEvent?: (event: AgentEvent) => void,
): CronResult {
  const emit = (message: string, details?: Record<string, unknown>): void => {
    if (!onEvent) return;
    onEvent({
      timestamp: Date.now(),
      agent: "cron-loop",
      type: "scan",
      message,
      details,
    });
  };

  // Schedule analyst autonomous loop
  const analystTask = cron.schedule(cronConfig.analystCron, async () => {
    emit("Analyst autonomous loop triggered");

    try {
      await agents.analyst.autonomousLoop();
      emit("Analyst autonomous loop completed");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      emit(`Analyst loop failed: ${message}`);
      if (onEvent) {
        onEvent({
          timestamp: Date.now(),
          agent: "cron-loop",
          type: "error",
          message: `Analyst loop error: ${message}`,
        });
      }
    }
  });

  console.log(`[cron] Analyst loop scheduled: ${cronConfig.analystCron}`);

  const stop = (): void => {
    analystTask.stop();
    console.log("[cron] All cron tasks stopped");
  };

  return { analystTask, stop };
}
