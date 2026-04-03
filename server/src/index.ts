import express from "express";
import { config } from "./config.js";
import { serviceRouter } from "./router/service-router.js";
import { startReinvestScheduler } from "./scheduler/reinvest.js";
import { AnalystAgent } from "./agents/analyst-agent.js";
import { AuditorAgent } from "./agents/auditor-agent.js";
import { TraderAgent } from "./agents/trader-agent.js";

const app = express();
app.use(express.json());
app.use("/api", serviceRouter);

const agents = [
  new AnalystAgent("0x0000000000000000000000000000000000000010"),
  new AuditorAgent("0x0000000000000000000000000000000000000020"),
  new TraderAgent("0x0000000000000000000000000000000000000030"),
];

startReinvestScheduler(agents);

app.listen(config.port, () => {
  console.log(`[server] Agentra server listening on port ${config.port}`);
  console.log(`[server] Registered ${agents.length} agents`);
});

export { app };
