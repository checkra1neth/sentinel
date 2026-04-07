import { BaseAgent, type ReinvestConfig } from "./base-agent.js";
import { type AgenticWallet } from "../wallet/agentic-wallet.js";
import {
  onchainosTrenches,
  onchainosSignal,
  onchainosToken,
} from "../lib/onchainos.js";
import { config } from "../config.js";
import { settings } from "../settings.js";
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
    const cfg = settings.get().discover;
    const candidates: TokenCandidate[] = [];
    const seen = new Set<string>();

    const add = (address: string, source: string, name?: string): void => {
      const normalized = address.toLowerCase();
      if (seen.has(normalized)) return;
      seen.add(normalized);
      candidates.push({ address: normalized, source, name });
    };

    // Trenches — all configured stages
    for (const stage of cfg.sources) {
      try {
        const result = await onchainosTrenches.tokens(stage, config.chainId);
        if (result.success && Array.isArray(result.data)) {
          for (const t of result.data as Array<Record<string, string>>) {
            const addr = t.tokenAddress ?? t.address ?? t.token;
            if (addr) add(addr, `trenches_${stage.toLowerCase()}`, t.tokenSymbol ?? t.symbol);
          }
        }
      } catch { /* source unavailable */ }
    }

    // Smart money signals
    if (cfg.trackSmartMoney) {
      try {
        const result = await onchainosSignal.activities("smart_money", config.chainId);
        if (result.success && Array.isArray(result.data)) {
          for (const s of result.data as Array<Record<string, string>>) {
            const addr = s.tokenAddress ?? s.token;
            if (addr) add(addr, "smart_money", s.tokenSymbol);
          }
        }
      } catch { /* */ }
    }

    // Whale signals
    if (cfg.trackWhales) {
      try {
        const result = await onchainosSignal.activities("whale", config.chainId);
        if (result.success && Array.isArray(result.data)) {
          for (const s of result.data as Array<Record<string, string>>) {
            const addr = s.tokenAddress ?? s.token;
            if (addr) add(addr, "whale", s.tokenSymbol);
          }
        }
      } catch { /* */ }
    }

    // Degen signals
    if (cfg.trackDegen) {
      try {
        const result = await onchainosSignal.activities("degen", config.chainId);
        if (result.success && Array.isArray(result.data)) {
          for (const s of result.data as Array<Record<string, string>>) {
            const addr = s.tokenAddress ?? s.token;
            if (addr) add(addr, "degen", s.tokenSymbol);
          }
        }
      } catch { /* */ }
    }

    // Hot tokens
    try {
      const result = await onchainosToken.hotTokens();
      if (result.success && Array.isArray(result.data)) {
        for (const t of result.data as Array<Record<string, string>>) {
          const addr = t.tokenContractAddress ?? t.address ?? t.token;
          if (addr) add(addr, "hot_token", t.tokenSymbol ?? t.symbol);
        }
      }
    } catch { /* */ }

    this.log(`Discovered ${candidates.length} unique tokens from ${cfg.sources.length} trenches stages + signals`);
    return candidates;
  }
}
