import express from "express";
import http from "http";
import { config } from "./config.js";
import { createServiceRouter } from "./router/service-router.js";
import { startReinvestScheduler } from "./scheduler/reinvest.js";
import { startManageLoop } from "./scheduler/manage-loop.js";
import { startSentinelLoop } from "./scheduler/cron-loop.js";
import { ScannerAgent } from "./agents/scanner-agent.js";
import { AnalystAgent } from "./agents/analyst-agent.js";
import { ExecutorAgent } from "./agents/executor-agent.js";
import { DecisionEngine } from "./agents/decision-engine.js";
import { X402Client } from "./payments/x402-client.js";
import { eventBus } from "./events/event-bus.js";
import { createAgentWallets } from "./wallet/agentic-wallet.js";
import type { BaseAgent } from "./agents/base-agent.js";
import { settings } from "./settings.js";

// ---------------------------------------------------------------------------
// 1. Express app + http.Server
// ---------------------------------------------------------------------------

const app = express();
const server = http.createServer(app);

settings.load();

// ---------------------------------------------------------------------------
// 2. CORS + JSON
// ---------------------------------------------------------------------------

app.use((_req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Content-Type, X-Payment, X-Caller");
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
//    analyst wallet -> Scanner, auditor wallet -> Analyst, trader wallet -> Executor
// ---------------------------------------------------------------------------

const wallets = createAgentWallets();

// ---------------------------------------------------------------------------
// 4. Create 3 Sentinel agents with wallets
// ---------------------------------------------------------------------------

const scanner = new ScannerAgent(wallets.analyst);
const analyst = new AnalystAgent(wallets.auditor);
const executor = new ExecutorAgent(wallets.trader);

const agents: Record<string, BaseAgent> = {
  "1": scanner,
  "2": analyst,
  "3": executor,
};

// ---------------------------------------------------------------------------
// 5. Wire agent events -> eventBus
// ---------------------------------------------------------------------------

for (const agent of Object.values(agents)) {
  agent.onEvent((event) => eventBus.emit(event));
}

// ---------------------------------------------------------------------------
// 6. Create X402Clients for inter-agent payments
// ---------------------------------------------------------------------------

const baseUrl = `http://localhost:${config.port}`;

const scannerX402 = new X402Client(wallets.analyst, baseUrl);
const analystX402 = new X402Client(wallets.auditor, baseUrl);
const executorX402 = new X402Client(wallets.trader, baseUrl);

// Wire x402 client events -> eventBus
for (const client of [scannerX402, analystX402, executorX402]) {
  client.onEvent((event) => eventBus.emit(event));
}

// ---------------------------------------------------------------------------
// 7. Create DecisionEngine
// ---------------------------------------------------------------------------

const decisionEngine = new DecisionEngine({
  scanner: { agent: scanner, serviceId: 1, x402: scannerX402 },
  analyst: { agent: analyst, serviceId: 2, x402: analystX402 },
  executor: { agent: executor, serviceId: 3, x402: executorX402 },
});

decisionEngine.onEvent((event) => eventBus.emit(event));

// ---------------------------------------------------------------------------
// 8. Mount service router
// ---------------------------------------------------------------------------

const serviceRouter = createServiceRouter(agents);
app.use("/api", serviceRouter);

// ---------------------------------------------------------------------------
// 9. Attach WebSocket
// ---------------------------------------------------------------------------

eventBus.attachToServer(server);

// ---------------------------------------------------------------------------
// 10. Start sentinel cron loop
// ---------------------------------------------------------------------------

const sentinelLoop = startSentinelLoop(
  scanner,
  decisionEngine,
  config.cron.analystInterval,
  (event) => eventBus.emit(event),
);

// ---------------------------------------------------------------------------
// 11. Start reinvest scheduler
// ---------------------------------------------------------------------------

const reinvestTask = startReinvestScheduler(
  Object.values(agents),
  config.cron.reinvestInterval,
  (event) => eventBus.emit(event),
);

// ---------------------------------------------------------------------------
// 12. Manage loop (position sync, stop-loss, fee collection)
// ---------------------------------------------------------------------------

const manageLoop = startManageLoop(
  executor,
  (event) => eventBus.emit(event),
);

// ---------------------------------------------------------------------------
// 13. Listen
// ---------------------------------------------------------------------------

server.listen(config.port, () => {
  console.log("");
  console.log("\u{1F6E1}\uFE0F  Sentinel Security Oracle");
  console.log(`Server:    http://localhost:${config.port}`);
  console.log(`WebSocket: ws://localhost:${config.port}/api/events`);
  console.log(`Scanner:   ${scanner.walletAddress}`);
  console.log(`Analyst:   ${analyst.walletAddress}`);
  console.log(`Executor:  ${executor.walletAddress}`);
  console.log(`Cron:      ${config.cron.analystInterval}`);
  console.log("");
});

export { app, server, agents, decisionEngine, eventBus, sentinelLoop, reinvestTask, manageLoop };
