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

    // Smart money tracker activities
    if (cfg.trackSmartMoney) {
      try {
        const result = await onchainosSignal.activities("smart_money", config.chainId);
        if (result.success && result.data) {
          const trades = (result.data as Record<string, unknown>).trades as Array<Record<string, string>> | undefined;
          if (Array.isArray(trades)) {
            for (const s of trades) {
              const addr = s.tokenContractAddress ?? s.tokenAddress ?? s.token;
              if (addr) add(addr, "tracker_smart_money", s.tokenSymbol);
            }
          }
        }
      } catch { /* */ }
    }

    // Whale signals (wallet-type 3) + Smart money signals (wallet-type 1)
    if (cfg.trackWhales) {
      for (const wt of ["1", "3"]) {
        try {
          const result = await onchainosSignal.list(config.chainId, wt);
          if (result.success && Array.isArray(result.data)) {
            for (const s of result.data as Array<Record<string, unknown>>) {
              const tokenObj = s.token as Record<string, string> | undefined;
              const addr = tokenObj?.tokenAddress ?? (s as Record<string, string>).tokenAddress;
              const sym = tokenObj?.symbol ?? (s as Record<string, string>).tokenSymbol;
              if (addr) add(addr, wt === "3" ? "whale" : "signal_smart_money", sym);
            }
          }
        } catch { /* */ }
      }
    }

    // KOL signals (tracker type kol)
    if (cfg.trackKol) {
      try {
        const result = await onchainosSignal.activities("kol", config.chainId);
        if (result.success && Array.isArray(result.data)) {
          for (const s of result.data as Array<Record<string, string>>) {
            const addr = s.tokenAddress ?? s.token;
            if (addr) add(addr, "kol", s.tokenSymbol);
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
