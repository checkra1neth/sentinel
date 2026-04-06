import { Router, type Request, type Response } from "express";
import { x402Middleware } from "./x402-middleware.js";
import { type BaseAgent } from "../agents/base-agent.js";
import { type ExecutorAgent } from "../agents/executor-agent.js";
import { verdictStore } from "../verdicts/verdict-store.js";
import { eventBus } from "../events/event-bus.js";

// ---------------------------------------------------------------------------
// Router factory — accepts agents map from index.ts
// ---------------------------------------------------------------------------

export function createServiceRouter(
  agents: Record<string, BaseAgent>,
): Router {
  const router = Router();

  // -------------------------------------------------------------------------
  // Health
  // -------------------------------------------------------------------------

  router.get("/health", (_req: Request, res: Response): void => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // -------------------------------------------------------------------------
  // Verdicts — free public feed
  // -------------------------------------------------------------------------

  router.get("/verdicts", (req: Request, res: Response): void => {
    const limit = Number(req.query.limit ?? 50);
    const verdicts = verdictStore.getRecent(limit);
    res.json({ verdicts });
  });

  // -------------------------------------------------------------------------
  // Verdict detail — x402 paywall (0.50 USDT)
  // -------------------------------------------------------------------------

  router.get(
    "/verdicts/:token",
    x402Middleware(2, "0.50"),
    async (req: Request, res: Response): Promise<void> => {
      try {
        const { token } = req.params;
        const analyst = agents["2"];
        if (!analyst) {
          res.status(503).json({ error: "Analyst agent not available" });
          return;
        }
        const result = await analyst.execute("report", { token });
        res.json({ verdict: result });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ error: message });
      }
    },
  );

  // -------------------------------------------------------------------------
  // Manual scan — x402 paywall (0.10 USDT)
  // -------------------------------------------------------------------------

  router.post(
    "/scan/:token",
    x402Middleware(2, "0.10"),
    async (req: Request, res: Response): Promise<void> => {
      try {
        const { token } = req.params;
        const analyst = agents["2"];
        if (!analyst) {
          res.status(503).json({ error: "Analyst agent not available" });
          return;
        }
        const result = await analyst.execute("scan", { token });
        res.json({ verdict: result });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ error: message });
      }
    },
  );

  // -------------------------------------------------------------------------
  // Agents overview
  // -------------------------------------------------------------------------

  router.get("/agents", async (_req: Request, res: Response): Promise<void> => {
    try {
      const agentList = await Promise.all(
        Object.entries(agents).map(async ([id, agent]) => {
          let usdtBalance = "0";
          try {
            usdtBalance = await agent.wallet.getUsdtBalance();
          } catch {
            // Balance fetch may fail if wallet not configured
          }
          return {
            id,
            name: agent.name,
            walletAddress: agent.walletAddress,
            usdtBalance,
          };
        }),
      );
      res.json({ agents: agentList });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ error: message });
    }
  });

  // -------------------------------------------------------------------------
  // Portfolio — Executor LP positions
  // -------------------------------------------------------------------------

  router.get("/portfolio", (_req: Request, res: Response): void => {
    const executor = agents["3"] as ExecutorAgent | undefined;
    if (!executor) {
      res.status(503).json({ error: "Executor agent not available" });
      return;
    }

    const positions = executor.lpPositions;
    const totalInvested = positions.reduce(
      (sum, p) => sum + Number(p.amountInvested),
      0,
    );
    const totalApr = positions.length > 0
      ? positions.reduce((sum, p) => sum + Number(p.apr ?? 0), 0) / positions.length
      : 0;

    res.json({
      positions,
      totalInvested,
      totalPositions: positions.length,
      avgApr: totalApr,
      executorAddress: executor.walletAddress,
    });
  });

  // -------------------------------------------------------------------------
  // Stats — verdictStore + eventBus
  // -------------------------------------------------------------------------

  router.get("/stats", (_req: Request, res: Response): void => {
    const verdictStats = verdictStore.getStats();
    const eventStats = eventBus.getStats();
    res.json({ verdicts: verdictStats, events: eventStats });
  });

  // -------------------------------------------------------------------------
  // Event history
  // -------------------------------------------------------------------------

  router.get("/events/history", (req: Request, res: Response): void => {
    const limit = Number(req.query.limit ?? 100);
    res.json({ events: eventBus.getHistory(limit) });
  });

  // -------------------------------------------------------------------------
  // Generic x402 service execution (inter-agent payments)
  // -------------------------------------------------------------------------

  router.post(
    "/services/:serviceId/:action",
    x402Middleware(1, "10.00"),
    async (req: Request, res: Response): Promise<void> => {
      try {
        const { serviceId, action } = req.params;
        const agent = agents[serviceId];

        if (!agent) {
          res.status(404).json({ error: `No agent for service ${serviceId}` });
          return;
        }

        const result = await agent.execute(action, req.body ?? {});

        res.json({
          serviceId: Number(serviceId),
          action,
          paymentVerified: req.paymentVerified ?? false,
          paymentPayer: req.paymentPayer,
          result,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ error: message });
      }
    },
  );

  return router;
}
