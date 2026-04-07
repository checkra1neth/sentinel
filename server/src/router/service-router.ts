import { Router, type Request, type Response } from "express";
import { x402Middleware } from "./x402-middleware.js";
import { type BaseAgent } from "../agents/base-agent.js";
import { type ExecutorAgent } from "../agents/executor-agent.js";
import { verdictStore } from "../verdicts/verdict-store.js";
import { eventBus } from "../events/event-bus.js";
import { settings } from "../settings.js";
import { pendingStore } from "../pending-store.js";
import { type ScannerAgent } from "../agents/scanner-agent.js";
import { onchainosSignal, onchainosSwap } from "../lib/onchainos.js";
import { config } from "../config.js";

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
    x402Middleware(2, "0.01"),
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
    x402Middleware(2, "0.01"),
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
    x402Middleware(1, "0.01"),
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

  // ── Invest ──

  router.post("/invest/preview", async (req: Request, res: Response): Promise<void> => {
    try {
      const executor = agents["3"];
      if (!executor) { res.status(503).json({ error: "Executor not available" }); return; }
      const { token, amount } = req.body as { token?: string; amount?: string };
      if (!token) { res.status(400).json({ error: "token required" }); return; }
      const result = await executor.execute("preview", { token, amount });
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  router.post("/invest/execute", async (req: Request, res: Response): Promise<void> => {
    try {
      const executor = agents["3"];
      if (!executor) { res.status(503).json({ error: "Executor not available" }); return; }
      const { token, amount, tokenSymbol, riskScore } = req.body as {
        token?: string; amount?: string; tokenSymbol?: string; riskScore?: number;
      };
      if (!token) { res.status(400).json({ error: "token required" }); return; }
      const result = await executor.execute("invest", {
        token,
        amount: amount ?? String(settings.get().invest.maxPerPosition),
        tokenSymbol: tokenSymbol ?? token.slice(0, 8),
        riskScore: riskScore ?? 15,
      });
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  router.post("/invest/swap", async (req: Request, res: Response): Promise<void> => {
    try {
      const { fromToken, toToken, amount } = req.body as {
        fromToken?: string; toToken?: string; amount?: string;
      };
      if (!fromToken || !toToken || !amount) {
        res.status(400).json({ error: "fromToken, toToken, amount required" });
        return;
      }
      const executor = agents["3"] as unknown as { walletAddress: string } | undefined;
      if (!executor) { res.status(503).json({ error: "Executor not available" }); return; }

      const result = onchainosSwap.execute(
        fromToken, toToken, amount, executor.walletAddress, config.chainId,
      );
      res.json({ success: result.success, data: result.data, error: result.success ? undefined : "Swap failed" });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  // ── Analyze ──

  router.get("/analyze/:token", async (req: Request, res: Response): Promise<void> => {
    try {
      const { token } = req.params;
      const analyst = agents["2"];
      if (!analyst) { res.status(503).json({ error: "Analyst not available" }); return; }

      const cached = verdictStore.getByToken(token);
      if (cached && !req.query.fresh) {
        res.json({ verdict: cached, cached: true });
        return;
      }

      const result = await analyst.execute("scan", { token });
      res.json({ verdict: result, cached: false });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  router.post("/analyze/:token/rescan", async (req: Request, res: Response): Promise<void> => {
    try {
      const { token } = req.params;
      const analyst = agents["2"];
      if (!analyst) { res.status(503).json({ error: "Analyst not available" }); return; }
      const result = await analyst.execute("scan", { token });
      res.json({ verdict: result });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  // ── Settings ──

  router.get("/settings", (_req: Request, res: Response): void => {
    res.json(settings.get());
  });

  router.patch("/settings", (req: Request, res: Response): void => {
    const updated = settings.update(req.body ?? {});
    res.json(updated);
  });

  // ── Discover ──

  router.get("/discover/feed", async (req: Request, res: Response): Promise<void> => {
    try {
      const scanner = agents["1"] as unknown as ScannerAgent | undefined;
      if (!scanner) { res.status(503).json({ error: "Scanner not available" }); return; }
      const tokens = await scanner.discoverTokens();
      const limit = Number(req.query.limit ?? 50);
      res.json({ tokens: tokens.slice(0, limit) });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  router.get("/discover/whales", async (req: Request, res: Response): Promise<void> => {
    try {
      const limit = Number(req.query.limit ?? 20);
      const signals: Array<Record<string, unknown>> = [];

      // Tracker activities: smart_money, kol
      for (const tracker of ["smart_money", "kol"]) {
        try {
          const result = await onchainosSignal.activities(tracker);
          if (result.success && Array.isArray(result.data)) {
            for (const s of result.data as Array<Record<string, unknown>>) {
              signals.push({ ...s, tracker });
            }
          }
        } catch { /* tracker unavailable */ }
      }

      // Signal list: smart_money (1), kol (2), whale (3)
      for (const [wt, label] of [["1", "signal_smart_money"], ["2", "signal_kol"], ["3", "signal_whale"]] as const) {
        try {
          const result = await onchainosSignal.list(196, wt);
          if (result.success && Array.isArray(result.data)) {
            for (const s of result.data as Array<Record<string, unknown>>) {
              signals.push({ ...s, tracker: label });
            }
          }
        } catch { /* */ }
      }

      res.json({ signals: signals.slice(0, limit) });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  router.post("/discover/scan", async (_req: Request, res: Response): Promise<void> => {
    try {
      const scanner = agents["1"] as unknown as ScannerAgent | undefined;
      if (!scanner) { res.status(503).json({ error: "Scanner not available" }); return; }
      const tokens = await scanner.autonomousLoop();
      res.json({ triggered: true, tokensFound: tokens.length, tokens });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  // ── Pending ──

  router.get("/pending/analyze", (_req: Request, res: Response): void => {
    res.json({ tokens: pendingStore.getByStatus("awaiting_analyze") });
  });

  router.get("/pending/invest", (_req: Request, res: Response): void => {
    res.json({ tokens: pendingStore.getByStatus("awaiting_invest") });
  });

  router.post("/pending/analyze/:token/approve", async (req: Request, res: Response): Promise<void> => {
    try {
      const { token } = req.params;
      const analyst = agents["2"];
      if (!analyst) { res.status(503).json({ error: "Analyst not available" }); return; }
      const result = await analyst.execute("scan", { token });
      pendingStore.remove(token);
      res.json({ result });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  router.post("/pending/invest/:token/approve", async (req: Request, res: Response): Promise<void> => {
    try {
      const { token } = req.params;
      const pending = pendingStore.get(token);
      const executor = agents["3"];
      if (!executor) { res.status(503).json({ error: "Executor not available" }); return; }
      const amount = String(settings.get().invest.maxPerPosition);
      const result = await executor.execute("invest", {
        token,
        tokenSymbol: pending?.verdict?.tokenSymbol ?? token.slice(0, 8),
        riskScore: pending?.verdict?.riskScore ?? 0,
        amount,
      });
      pendingStore.remove(token);
      res.json({ result });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  router.delete("/pending/:token", (req: Request, res: Response): void => {
    const removed = pendingStore.remove(req.params.token);
    res.json({ removed });
  });

  return router;
}
