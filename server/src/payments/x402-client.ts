import { type Address } from "viem";
import { type AgenticWallet } from "../wallet/agentic-wallet.js";
import { config } from "../config.js";
import type { X402Challenge, AgentEvent } from "../types.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface X402Response {
  success: boolean;
  result?: unknown;
  txHash?: string;
  error?: string;
}

export type X402EventListener = (event: AgentEvent) => void;

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

export class X402Client {
  private readonly wallet: AgenticWallet;
  private readonly serverBaseUrl: string;
  private listeners: X402EventListener[] = [];

  constructor(wallet: AgenticWallet, serverBaseUrl?: string) {
    this.wallet = wallet;
    this.serverBaseUrl = serverBaseUrl ?? `http://localhost:${config.port}`;
  }

  /**
   * Buy a service via x402 payment flow:
   * 1. POST without X-Payment header
   * 2. If 402 -> parse challenge, sign payment, retry with header
   * 3. Return result
   */
  async buyService(
    serviceId: number,
    action: string,
    params: Record<string, unknown>,
  ): Promise<X402Response> {
    const url = `${this.serverBaseUrl}/api/services/${serviceId}/${action}`;

    this.emitEvent("buy_service", `Requesting service ${serviceId}/${action}`, {
      serviceId,
      action,
    });

    // Step 1: POST without payment header
    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Caller": "0x8Ce01CF638681e12AFfD10e2feb1E7E3C50b7509",
        },
        body: JSON.stringify(params),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.emitEvent("error", `Failed to reach service: ${message}`, { serviceId });
      return { success: false, error: message };
    }

    // Step 2: If 402, parse challenge and sign payment
    if (response.status === 402) {
      const body = (await response.json()) as { challenge: X402Challenge };
      const challenge = body.challenge;

      this.emitEvent("buy_service", `Got 402 challenge: ${challenge.price} ${challenge.currency}`, {
        serviceId,
        price: challenge.price,
        escrowAddress: challenge.escrowAddress,
      });

      // Sign x402 payment
      const paymentData = await this.wallet.signX402Payment(
        challenge.escrowAddress,
        challenge.price,
        config.contracts.usdt,
      );

      if (!paymentData) {
        this.emitEvent("error", "Failed to sign x402 payment", { serviceId });
        return { success: false, error: "Failed to sign x402 payment" };
      }

      const paymentHeader = JSON.stringify({
        signature: paymentData.signature,
        authorization: paymentData.authorization,
        payer: this.wallet.address,
        serviceId: challenge.serviceId,
      });

      // Step 3: Retry with X-Payment header
      try {
        const retryResponse = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Payment": paymentHeader,
          },
          body: JSON.stringify(params),
        });

        if (!retryResponse.ok) {
          const errorBody = (await retryResponse.json()) as { error?: string };
          this.emitEvent("error", `Payment rejected: ${errorBody.error ?? "Unknown"}`, {
            serviceId,
          });
          return { success: false, error: errorBody.error ?? "Payment rejected" };
        }

        const result = (await retryResponse.json()) as Record<string, unknown>;

        this.emitEvent("buy_service", `Service ${serviceId}/${action} purchased successfully`, {
          serviceId,
          action,
          payer: this.wallet.address,
        });

        return {
          success: true,
          result: result.result ?? result,
          txHash: result.txHash as string | undefined,
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        this.emitEvent("error", `Retry failed: ${message}`, { serviceId });
        return { success: false, error: message };
      }
    }

    // Non-402 response (free endpoint or already paid)
    if (!response.ok) {
      const errorBody = (await response.json()) as { error?: string };
      return { success: false, error: errorBody.error ?? `HTTP ${response.status}` };
    }

    const result = (await response.json()) as Record<string, unknown>;
    return {
      success: true,
      result: result.result ?? result,
    };
  }

  onEvent(listener: X402EventListener): void {
    this.listeners.push(listener);
  }

  private emitEvent(
    type: AgentEvent["type"],
    message: string,
    details?: Record<string, unknown>,
  ): void {
    const event: AgentEvent = {
      timestamp: Date.now(),
      agent: `x402-client:${this.wallet.role}`,
      type,
      message,
      details,
    };
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch {
        // Listener errors must not break the client
      }
    }
  }
}
