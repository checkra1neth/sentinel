import { Router, type Request, type Response } from "express";
import { x402Middleware } from "./x402-middleware.js";
import { getActiveServices, getAgentYield, getUsdtBalance } from "../contracts/client.js";
import { AnalystAgent } from "../agents/analyst-agent.js";
import { AuditorAgent } from "../agents/auditor-agent.js";
import { TraderAgent } from "../agents/trader-agent.js";
import { type Address } from "viem";
import { type BaseAgent } from "../agents/base-agent.js";

// Agent instances
const agents: Record<string, BaseAgent> = {
  "1": new AnalystAgent("0xCD047f843D9b9a95F703E8E0415a63886eb129FB"),
  "2": new AuditorAgent("0xCD047f843D9b9a95F703E8E0415a63886eb129FB"),
  "3": new TraderAgent("0xCD047f843D9b9a95F703E8E0415a63886eb129FB"),
};

export const serviceRouter = Router();

serviceRouter.get("/health", (_req: Request, res: Response): void => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

serviceRouter.get("/services", async (_req: Request, res: Response): Promise<void> => {
  try {
    const services = await getActiveServices();
    const serialized = services.map((s: Record<string, unknown>) => ({
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

serviceRouter.get(
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

serviceRouter.post(
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
        result,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ error: message });
    }
  },
);
