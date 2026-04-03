import { type Address } from "viem";
import { type AgenticWallet } from "../wallet/agentic-wallet.js";

export interface ReinvestConfig {
  threshold: number;
  percent: number;
}

export interface AgentServices {
  id: number;
  serviceType: string;
  endpoint: string;
  priceUsdt: bigint;
  active: boolean;
}

export interface AgentEvent {
  timestamp: number;
  agent: string;
  type: string;
  message: string;
  details?: Record<string, unknown>;
}

export type EventListener = (event: AgentEvent) => void;

export abstract class BaseAgent {
  readonly name: string;
  readonly wallet: AgenticWallet;
  readonly walletAddress: Address;
  readonly reinvestConfig: ReinvestConfig;
  readonly registeredServices: AgentServices[] = [];

  private eventListeners: EventListener[] = [];

  constructor(
    name: string,
    wallet: AgenticWallet,
    reinvestConfig: ReinvestConfig = { threshold: 100, percent: 50 },
  ) {
    this.name = name;
    this.wallet = wallet;
    this.walletAddress = wallet.address;
    this.reinvestConfig = reinvestConfig;
  }

  abstract execute(
    action: string,
    params: Record<string, unknown>,
  ): Promise<unknown>;

  /** Register a listener for agent events. */
  onEvent(listener: EventListener): void {
    this.eventListeners.push(listener);
  }

  /** Broadcast an event to all registered listeners. */
  protected emit(event: AgentEvent): void {
    for (const listener of this.eventListeners) {
      try {
        listener(event);
      } catch {
        // Listener errors must not break the agent
      }
    }
  }

  /** Override in subclasses (e.g. Analyst) to run periodic logic. */
  async autonomousLoop(): Promise<void> {
    // No-op by default; overridden by agents that need a cron loop
  }

  shouldBuyService(_type: string): boolean {
    return false;
  }

  log(message: string): void {
    console.log(`[${this.name}] ${message}`);
    this.emit({
      timestamp: Date.now(),
      agent: this.name,
      type: "log",
      message,
    });
  }
}
