import { Router, type Request, type Response } from "express";
import { x402Middleware } from "./x402-middleware.js";
import { getActiveServices, getAgentYield, getUsdtBalance } from "../contracts/client.js";
import { type Address } from "viem";
import { type BaseAgent } from "../agents/base-agent.js";
import { eventBus } from "../events/event-bus.js";

// ---------------------------------------------------------------------------
// Router factory — accepts agents from index.ts
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
  // On-chain services
  // -------------------------------------------------------------------------

  router.get("/services", async (_req: Request, res: Response): Promise<void> => {
    try {
      const services = await getActiveServices();
      const serialized = (services as Record<string, unknown>[]).map((s) => ({
        id: Number(s.id),
        agent: s.agent,
        serviceType: s.serviceType,
        endpoint: s.endpoint,
        priceUsdt: Number(s.priceUsdt) / 1e6,
        active: s.active,
      }));
      res.json({ services: serialized });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ error: message });
    }
  });

  router.get(
    "/services/:agentAddress/stats",
    async (req: Request, res: Response): Promise<void> => {
      try {
        const agentAddress = req.params.agentAddress as Address;
        const [balance, yield_] = await Promise.all([
          getUsdtBalance(agentAddress),
          getAgentYield(agentAddress),
        ]);
        res.json({
          agent: agentAddress,
          balance: balance.toString(),
          yield: yield_.toString(),
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        res.status(500).json({ error: message });
      }
    },
  );

  // -------------------------------------------------------------------------
  // Service execution (x402 gated)
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
            reinvestConfig: agent.reinvestConfig,
            services: agent.registeredServices,
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
  // Agent events
  // -------------------------------------------------------------------------

  router.get("/agents/:address/events", (req: Request, res: Response): void => {
    const { address } = req.params;
    const limit = Number(req.query.limit ?? 50);

    // Find agent name by wallet address
    const agent = Object.values(agents).find(
      (a) => a.walletAddress.toLowerCase() === address.toLowerCase(),
    );

    if (!agent) {
      // Also try matching by agent name
      const agentByName = Object.values(agents).find(
        (a) => a.name.toLowerCase() === address.toLowerCase(),
      );
      if (!agentByName) {
        res.status(404).json({ error: `Agent not found: ${address}` });
        return;
      }
      const filtered = eventBus.getHistory(1000).filter(
        (e) => e.agent === agentByName.name,
      );
      res.json({ events: filtered.slice(-limit) });
      return;
    }

    const filtered = eventBus.getHistory(1000).filter(
      (e) => e.agent === agent.name,
    );
    res.json({ events: filtered.slice(-limit) });
  });

  // -------------------------------------------------------------------------
  // Economy stats
  // -------------------------------------------------------------------------

  router.get("/economy/stats", (_req: Request, res: Response): void => {
    res.json(eventBus.getStats());
  });

  // -------------------------------------------------------------------------
  // Event history
  // -------------------------------------------------------------------------

  router.get("/events/history", (req: Request, res: Response): void => {
    const limit = Number(req.query.limit ?? 100);
    res.json({ events: eventBus.getHistory(limit) });
  });

  return router;
}

// Keep backward-compatible default export for any existing code
export const serviceRouter = createServiceRouter({});
