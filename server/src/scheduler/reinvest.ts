import cron from "node-cron";
import { type BaseAgent } from "../agents/base-agent.js";

export function startReinvestScheduler(agents: BaseAgent[]): cron.ScheduledTask {
  const task = cron.schedule("*/10 * * * *", () => {
    for (const agent of agents) {
      const { threshold, percent } = agent.reinvestConfig;
      agent.log(
        `Checking reinvest: threshold=${threshold} USDT, percent=${percent}%`,
      );
      // In production this would check on-chain balance and trigger reinvestment
      agent.log("Reinvest check complete (mock)");
    }
  });

  console.log("[scheduler] Reinvest scheduler started (every 10 minutes)");
  return task;
}
