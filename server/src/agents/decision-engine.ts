import { type ScannerAgent } from "./scanner-agent.js";
import { type AnalystAgent } from "./analyst-agent.js";
import { type ExecutorAgent } from "./executor-agent.js";
import { type X402Client } from "../payments/x402-client.js";
import type { AgentEvent, Verdict } from "../types.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DecisionEventListener = (event: AgentEvent) => void;

interface AgentEntry<T> {
  agent: T;
  serviceId: number;
  x402: X402Client;
}

interface DecisionServices {
  scanner: AgentEntry<ScannerAgent>;
  analyst: AgentEntry<AnalystAgent>;
  executor: AgentEntry<ExecutorAgent>;
}

// ---------------------------------------------------------------------------
// Decision Engine
// ---------------------------------------------------------------------------

const MAX_TOKENS_PER_BATCH = 5;

export class DecisionEngine {
  private readonly services: DecisionServices;
  private listeners: DecisionEventListener[] = [];

  constructor(services: DecisionServices) {
    this.services = services;
  }

  /**
   * Called by cron after Scanner discovers new tokens.
   * For each token (max 5):
   *   1. Buy Analyst scan via x402
   *   2. If verdict is SAFE -> buy Executor invest via x402
   *   3. Emit events throughout
   */
  async onTokensDiscovered(
    tokens: Array<{ address: string; source: string }>,
  ): Promise<void> {
    const batch = tokens.slice(0, MAX_TOKENS_PER_BATCH);

    this.emitEvent(
      "scan",
      `Decision engine: processing ${batch.length} of ${tokens.length} discovered tokens`,
      { total: tokens.length, processing: batch.length },
    );

    for (const token of batch) {
      try {
        await this.processToken(token.address, token.source);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        this.emitEvent("error", `Failed to process ${token.address}: ${message}`, {
          token: token.address,
        });
      }
    }
  }

  onEvent(listener: DecisionEventListener): void {
    this.listeners.push(listener);
  }

  // -------------------------------------------------------------------------
  // Internal
  // -------------------------------------------------------------------------

  private async processToken(address: string, source: string): Promise<void> {
    // 1. Buy Analyst scan via x402
    this.emitEvent("buy_service", `Buying Analyst scan for ${address} (${source})`, {
      token: address,
      source,
    });

    const scanResult = await this.services.analyst.x402.buyService(
      this.services.analyst.serviceId,
      "scan",
      { token: address },
    );

    if (!scanResult.success) {
      this.emitEvent("error", `Analyst scan failed for ${address}: ${scanResult.error}`, {
        token: address,
      });
      return;
    }

    const verdict = scanResult.result as Verdict | undefined;
    const verdictLabel = verdict?.verdict ?? "UNKNOWN";
    const riskScore = verdict?.riskScore ?? -1;

    this.emitEvent("scan", `Verdict for ${address}: ${verdictLabel} (risk ${riskScore})`, {
      token: address,
      verdict: verdictLabel,
      riskScore,
    });

    // 2. If SAFE -> buy Executor invest
    if (verdictLabel === "SAFE") {
      this.emitEvent("buy_service", `${address} is SAFE -> buying Executor invest`, {
        token: address,
      });

      const investResult = await this.services.executor.x402.buyService(
        this.services.executor.serviceId,
        "invest",
        { token: address, amount: "10" },
      );

      this.emitEvent(
        investResult.success ? "invest" : "error",
        investResult.success
          ? `Invested in ${address} via Executor`
          : `Executor invest failed for ${address}: ${investResult.error}`,
        { token: address, result: investResult },
      );
    } else {
      this.emitEvent("scan", `${address} verdict=${verdictLabel} -> skipping invest`, {
        token: address,
        verdict: verdictLabel,
      });
    }
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
