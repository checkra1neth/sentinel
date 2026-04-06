import { BaseAgent, type ReinvestConfig } from "./base-agent.js";
import { type AgenticWallet } from "../wallet/agentic-wallet.js";
import {
  onchainosTrenches,
  onchainosSignal,
  onchainosToken,
} from "../lib/onchainos.js";
import { config } from "../config.js";
import { verdictStore } from "../verdicts/verdict-store.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TokenCandidate {
  address: string;
  source: string;
  name?: string;
}

// ---------------------------------------------------------------------------
// Agent
// ---------------------------------------------------------------------------

export class ScannerAgent extends BaseAgent {
  constructor(wallet: AgenticWallet, reinvestConfig?: ReinvestConfig) {
    super("Scanner", wallet, reinvestConfig);
  }

  async execute(
    action: string,
    _params: Record<string, unknown> = {},
  ): Promise<unknown> {
    switch (action) {
      case "discover":
        return this.discoverTokens();
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  }

  // -------------------------------------------------------------------------
  // Autonomous loop
  // -------------------------------------------------------------------------

  override async autonomousLoop(): Promise<TokenCandidate[]> {
    this.log("Autonomous loop: discovering new tokens");

    const candidates = await this.discoverTokens();

    const newTokens = candidates.filter(
      (c) => !verdictStore.isScanned(c.address),
    );

    for (const token of newTokens) {
      this.emit({
        timestamp: Date.now(),
        agent: this.name,
        type: "new-token",
        message: `Discovered new token: ${token.name ?? token.address} (${token.source})`,
        details: { address: token.address, source: token.source },
      });
    }

    this.log(`Discovered ${candidates.length} tokens, ${newTokens.length} new`);
    return newTokens;
  }

  // -------------------------------------------------------------------------
  // Service buying
  // -------------------------------------------------------------------------

  override shouldBuyService(type: string): boolean {
    return type === "analyst";
  }

  // -------------------------------------------------------------------------
  // Token discovery
  // -------------------------------------------------------------------------

  async discoverTokens(): Promise<TokenCandidate[]> {
    const seen = new Set<string>();
    const candidates: TokenCandidate[] = [];

    const addCandidate = (
      address: string | undefined,
      source: string,
      name?: string,
    ): void => {
      if (!address) return;
      const normalized = address.toLowerCase();
      if (seen.has(normalized)) return;
      seen.add(normalized);
      candidates.push({ address: normalized, source, name });
    };

    // 1. New trenches tokens
    const newResult = onchainosTrenches.tokens("NEW");
    if (newResult.success && newResult.data) {
      const items = Array.isArray(newResult.data)
        ? newResult.data
        : [newResult.data];
      for (const item of items as Array<Record<string, unknown>>) {
        const addr = String(
          item.tokenAddress ?? item.address ?? item.token ?? "",
        );
        addCandidate(addr, "trenches_new", item.name as string | undefined);
      }
    }

    // 2. Migrated trenches tokens
    const migratedResult = onchainosTrenches.tokens("MIGRATED");
    if (migratedResult.success && migratedResult.data) {
      const items = Array.isArray(migratedResult.data)
        ? migratedResult.data
        : [migratedResult.data];
      for (const item of items as Array<Record<string, unknown>>) {
        const addr = String(
          item.tokenAddress ?? item.address ?? item.token ?? "",
        );
        addCandidate(
          addr,
          "trenches_migrated",
          item.name as string | undefined,
        );
      }
    }

    // 3. Smart money signals
    const signalResult = onchainosSignal.activities("smart_money");
    if (signalResult.success && signalResult.data) {
      const items = Array.isArray(signalResult.data)
        ? signalResult.data
        : [signalResult.data];
      for (const item of items as Array<Record<string, unknown>>) {
        const addr = String(
          item.tokenAddress ?? item.token ?? item.address ?? "",
        );
        addCandidate(addr, "smart_money", item.name as string | undefined);
      }
    }

    // 4. Hot tokens
    const hotResult = onchainosToken.hotTokens();
    if (hotResult.success && hotResult.data) {
      const items = Array.isArray(hotResult.data)
        ? hotResult.data
        : [hotResult.data];
      for (const item of items as Array<Record<string, unknown>>) {
        const addr = String(
          item.address ?? item.tokenAddress ?? item.token ?? "",
        );
        addCandidate(addr, "hot_tokens", item.name as string | undefined);
      }
    }

    return candidates;
  }
}
