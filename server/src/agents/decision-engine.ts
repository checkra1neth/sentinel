import { type BaseAgent } from "./base-agent.js";
import { type X402Client } from "../payments/x402-client.js";
import type { AgentEvent } from "../types.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DecisionEventListener = (event: AgentEvent) => void;

interface AgentEntry {
  agent: BaseAgent;
  serviceId: number;
  x402: X402Client;
}

interface DecisionServices {
  analyst: AgentEntry;
  auditor: AgentEntry;
  trader: AgentEntry;
}

// ---------------------------------------------------------------------------
// Decision Engine
// ---------------------------------------------------------------------------

export class DecisionEngine {
  private readonly services: DecisionServices;
  private listeners: DecisionEventListener[] = [];

  constructor(services: DecisionServices) {
    this.services = services;
  }

  /**
   * Called when the Analyst discovers a token.
   * Decides whether to buy Auditor scan and/or Trader quote.
   */
  async onAnalystDiscovery(
    token: string,
    riskScore: number,
    recommendation: string,
  ): Promise<void> {
    this.emitEvent("scan", `Decision engine: evaluating ${token} (risk=${riskScore}, rec=${recommendation})`, {
      token,
      riskScore,
      recommendation,
    });

    // Skip tokens that are clearly dangerous
    if (recommendation === "AVOID") {
      this.emitEvent("scan", `Skipping ${token}: recommendation is AVOID`, { token });
      return;
    }

    // Low risk (< 10) and OPPORTUNITY -> go straight to Trader
    if (riskScore < 10 && recommendation === "OPPORTUNITY") {
      this.emitEvent("buy_service", `${token} is low-risk OPPORTUNITY -> buying Trader quote directly`, {
        token,
        riskScore,
      });

      const traderResult = await this.services.trader.x402.buyService(
        this.services.trader.serviceId,
        "swap",
        { fromToken: "USDT", toToken: token, amount: "10" },
      );

      this.emitEvent(
        traderResult.success ? "buy_service" : "error",
        `Trader quote for ${token}: ${traderResult.success ? "OK" : traderResult.error}`,
        { token, result: traderResult },
      );
      return;
    }

    // Risk 10-60 and not AVOID -> buy Auditor scan first
    if (riskScore >= 10 && riskScore <= 60) {
      this.emitEvent("buy_service", `${token} risk=${riskScore} -> buying Auditor scan`, {
        token,
        riskScore,
      });

      const auditResult = await this.services.auditor.x402.buyService(
        this.services.auditor.serviceId,
        "quick-scan",
        { contract: token },
      );

      if (!auditResult.success) {
        this.emitEvent("error", `Auditor scan failed for ${token}: ${auditResult.error}`, {
          token,
        });
        return;
      }

      // Check audit verdict
      const auditData = auditResult.result as Record<string, unknown> | undefined;
      const verdict = auditData?.verdict as string | undefined;

      this.emitEvent("scan", `Audit verdict for ${token}: ${verdict ?? "UNKNOWN"}`, {
        token,
        verdict,
      });

      // If audit passes -> buy Trader quote
      if (verdict === "CLEAN" || verdict === "LOW_RISK") {
        this.emitEvent("buy_service", `${token} passed audit -> buying Trader quote`, { token });

        const traderResult = await this.services.trader.x402.buyService(
          this.services.trader.serviceId,
          "swap",
          { fromToken: "USDT", toToken: token, amount: "10" },
        );

        this.emitEvent(
          traderResult.success ? "buy_service" : "error",
          `Trader quote for ${token}: ${traderResult.success ? "OK" : traderResult.error}`,
          { token, result: traderResult },
        );
      } else {
        this.emitEvent("scan", `${token} failed audit (${verdict}) -> skipping trade`, { token });
      }
    }
  }

  onEvent(listener: DecisionEventListener): void {
    this.listeners.push(listener);
  }

  private emitEvent(
    type: AgentEvent["type"],
    message: string,
    details?: Record<string, unknown>,
  ): void {
    const event: AgentEvent = {
      timestamp: Date.now(),
      agent: "decision-engine",
      type,
      message,
      details,
    };
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch {
        // Listener errors must not break the engine
      }
    }
  }
}
