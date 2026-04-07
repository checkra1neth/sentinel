import { type ScannerAgent } from "./scanner-agent.js";
import { type AnalystAgent } from "./analyst-agent.js";
import { type ExecutorAgent } from "./executor-agent.js";
import { type X402Client } from "../payments/x402-client.js";
import type { AgentEvent } from "../types.js";
import { settings } from "../settings.js";
import { pendingStore } from "../pending-store.js";

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
    const cfg = settings.get();

    // If analyze mode is manual — queue for user review
    if (cfg.analyze.mode === "manual") {
      pendingStore.add(address, source, "awaiting_analyze");
      this.emitEvent("log", `Queued ${address} for manual analysis (source: ${source})`);
      return;
    }

    // Auto-analyze
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
      this.emitEvent("error", `Analyst scan failed for ${address}: ${scanResult.error}`, { token: address });
      return;
    }

    const result = scanResult.result as Record<string, unknown> | undefined;
    const verdict = result?.verdict as string | undefined;
    const verdictLabel = (verdict ?? "UNKNOWN").toUpperCase();
    const riskScore = (result?.riskScore as number) ?? 100;
    const tokenSymbol = (result?.tokenSymbol as string) ?? address.slice(0, 8);

    this.emitEvent("scan", `${tokenSymbol} verdict: ${verdictLabel} (risk ${riskScore})`, {
      token: address,
      tokenSymbol,
      verdict: verdictLabel,
      riskScore,
    });

    if (verdictLabel === "SAFE") {
      // If invest mode is manual — queue for user review
      if (cfg.invest.mode === "manual") {
        pendingStore.add(address, source, "awaiting_invest");
        pendingStore.setVerdict(address, { riskScore, verdict: verdictLabel, tokenSymbol });
        this.emitEvent("log", `${tokenSymbol} is SAFE — queued for manual investment`);
        return;
      }

      // Auto-invest
      const amount = String(cfg.invest.maxPerPosition);
      this.emitEvent("buy_service", `${tokenSymbol} is SAFE (risk ${riskScore}) -> investing ${amount} USDT via Executor`, {
        token: address,
        riskScore,
      });

      const investResult = await this.services.executor.x402.buyService(
        this.services.executor.serviceId,
        "invest",
        { token: address, tokenSymbol, riskScore, amount },
      );

      if (investResult.success) {
        this.emitEvent("invest", `Invested ${amount} USDT in ${tokenSymbol}`, {
          token: address,
          amount,
          txHash: investResult.txHash,
        });
      } else {
        this.emitEvent("error", `Executor invest failed for ${tokenSymbol}: ${investResult.error}`, { token: address });
      }
    } else {
      this.emitEvent("scan", `${tokenSymbol} is ${verdictLabel} (risk ${riskScore}) — skipping`, { token: address, verdict: verdictLabel });
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
