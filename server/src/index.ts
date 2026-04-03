import express from "express";
import http from "http";
import { config } from "./config.js";
import { createServiceRouter } from "./router/service-router.js";
import { startReinvestScheduler } from "./scheduler/reinvest.js";
import { startCronLoop } from "./scheduler/cron-loop.js";
import { AnalystAgent } from "./agents/analyst-agent.js";
import { AuditorAgent } from "./agents/auditor-agent.js";
import { TraderAgent } from "./agents/trader-agent.js";
import { DecisionEngine } from "./agents/decision-engine.js";
import { X402Client } from "./payments/x402-client.js";
import { eventBus } from "./events/event-bus.js";
import { createAgentWallets } from "./wallet/agentic-wallet.js";

// ---------------------------------------------------------------------------
// 1. Express app + http.Server
// ---------------------------------------------------------------------------

const app = express();
const server = http.createServer(app);

// ---------------------------------------------------------------------------
// 2. CORS + JSON
// ---------------------------------------------------------------------------

app.use((_req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Content-Type, X-Payment");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  if (_req.method === "OPTIONS") {
    res.sendStatus(200);
    return;
  }
  next();
});
app.use(express.json());

// ---------------------------------------------------------------------------
// 3. Create Agentic Wallets
// ---------------------------------------------------------------------------

const wallets = createAgentWallets();

// ---------------------------------------------------------------------------
// 4. Create 3 agents with wallets
// ---------------------------------------------------------------------------

const analyst = new AnalystAgent(wallets.analyst);
const auditor = new AuditorAgent(wallets.auditor);
const trader = new TraderAgent(wallets.trader);

const agents: Record<string, import("./agents/base-agent.js").BaseAgent> = {
  "1": analyst,
  "2": auditor,
  "3": trader,
};

// ---------------------------------------------------------------------------
// 5. Wire event listeners to eventBus
// ---------------------------------------------------------------------------

for (const agent of Object.values(agents)) {
  agent.onEvent((event) => eventBus.emit(event));
}

// ---------------------------------------------------------------------------
// 6. Create X402Clients and DecisionEngine
// ---------------------------------------------------------------------------

const baseUrl = `http://localhost:${config.port}`;

const analystX402 = new X402Client(wallets.analyst, baseUrl);
const auditorX402 = new X402Client(wallets.auditor, baseUrl);
const traderX402 = new X402Client(wallets.trader, baseUrl);

// Wire x402 client events to eventBus
for (const client of [analystX402, auditorX402, traderX402]) {
  client.onEvent((event) => eventBus.emit(event));
}

const decisionEngine = new DecisionEngine({
  analyst: { agent: analyst, serviceId: 1, x402: analystX402 },
  auditor: { agent: auditor, serviceId: 2, x402: auditorX402 },
  trader: { agent: trader, serviceId: 3, x402: traderX402 },
});

decisionEngine.onEvent((event) => eventBus.emit(event));

// ---------------------------------------------------------------------------
// 7. Mount service router (pass agents)
// ---------------------------------------------------------------------------

const serviceRouter = createServiceRouter(agents);
app.use("/api", serviceRouter);

// ---------------------------------------------------------------------------
// 8. Attach eventBus WebSocket to server
// ---------------------------------------------------------------------------

eventBus.attachToServer(server);

// ---------------------------------------------------------------------------
// 9. Start cron loops (analyst + reinvest)
// ---------------------------------------------------------------------------

const cronLoop = startCronLoop(
  { analyst, auditor, trader },
  decisionEngine,
  { analystCron: config.cron.analystInterval, reinvestCron: config.cron.reinvestInterval },
  (event) => eventBus.emit(event),
);

const reinvestTask = startReinvestScheduler(
  Object.values(agents),
  config.cron.reinvestInterval,
  (event) => eventBus.emit(event),
);

// ---------------------------------------------------------------------------
// 10. Listen
// ---------------------------------------------------------------------------

server.listen(config.port, () => {
  console.log(`[server] Agentra server listening on port ${config.port}`);
  console.log(`[server] Registered ${Object.keys(agents).length} agents`);
  console.log(`[server] WebSocket events on ws://localhost:${config.port}/api/events`);
  console.log(`[server] Analyst cron: ${config.cron.analystInterval}`);
  console.log(`[server] Reinvest cron: ${config.cron.reinvestInterval}`);
});

export { app, server, agents, decisionEngine, eventBus, cronLoop, reinvestTask };
