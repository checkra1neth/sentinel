import { BaseAgent, type ReinvestConfig } from "./base-agent.js";
import { type AgenticWallet } from "../wallet/agentic-wallet.js";
import {
  onchainosTrenches,
  onchainosSignal,
  onchainosToken,
} from "../lib/onchainos.js";
import { getTrendingTokens } from "../lib/dexscreener.js";
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
  symbol?: string;
  priceUsd?: number;
  marketCap?: number;
  liquidityUsd?: number;
  volume24h?: number;
  priceChange24h?: number;
  holders?: number;
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
    const byAddr = new Map<string, TokenCandidate>();

    const add = (c: TokenCandidate): void => {
      const normalized = c.address.toLowerCase();
      const existing = byAddr.get(normalized);
      if (existing) {
        // Merge: fill in missing fields from new data
        if (c.priceUsd && !existing.priceUsd) existing.priceUsd = c.priceUsd;
        if (c.marketCap && !existing.marketCap) existing.marketCap = c.marketCap;
        if (c.liquidityUsd && !existing.liquidityUsd) existing.liquidityUsd = c.liquidityUsd;
        if (c.volume24h && !existing.volume24h) existing.volume24h = c.volume24h;
        if (c.priceChange24h != null && existing.priceChange24h == null) existing.priceChange24h = c.priceChange24h;
        if (c.holders && !existing.holders) existing.holders = c.holders;
        if (c.symbol && !existing.symbol) existing.symbol = c.symbol;
        if (c.name && !existing.name) existing.name = c.name;
        return;
      }
      byAddr.set(normalized, { ...c, address: normalized });
    };

    // Trenches — all configured stages (memepump tokens have nested market data)
    for (const stage of cfg.sources) {
      try {
        const result = await onchainosTrenches.tokens(stage, config.chainId);
        if (result.success && Array.isArray(result.data)) {
          for (const t of result.data as Array<Record<string, unknown>>) {
            const addr = String(t.tokenAddress ?? t.address ?? t.token ?? "");
            if (!addr) continue;
            const market = t.market as Record<string, string> | undefined;
            const tags = t.tags as Record<string, string> | undefined;
            add({
              address: addr,
              source: `trenches_${stage.toLowerCase()}`,
              name: String(t.name ?? t.tokenSymbol ?? t.symbol ?? ""),
              symbol: String(t.symbol ?? t.tokenSymbol ?? ""),
              marketCap: Number(market?.marketCapUsd ?? 0) || undefined,
              volume24h: Number(market?.volumeUsd1h ?? 0) || undefined,
              holders: Number(tags?.totalHolders ?? 0) || undefined,
            });
          }
        }
      } catch { /* source unavailable */ }
    }

    // Smart money tracker activities
    if (cfg.trackSmartMoney) {
      try {
        const result = await onchainosSignal.activities("smart_money", config.chainId);
        if (result.success && result.data) {
          const raw = result.data as Record<string, unknown>;
          const trades = (Array.isArray(raw) ? raw : (raw.trades as Array<Record<string, string>> | undefined)) ?? [];
          if (Array.isArray(trades)) {
            for (const s of trades) {
              const addr = s.tokenContractAddress ?? s.tokenAddress ?? s.token;
              if (!addr) continue;
              add({
                address: addr,
                source: "tracker_smart_money",
                symbol: s.tokenSymbol,
                priceUsd: Number(s.tokenPrice ?? 0) || undefined,
                marketCap: Number(s.marketCap ?? 0) || undefined,
              });
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
              if (!addr) continue;
              add({
                address: addr,
                source: wt === "3" ? "whale" : "signal_smart_money",
                symbol: sym,
                priceUsd: Number(tokenObj?.price ?? 0) || undefined,
                marketCap: Number(tokenObj?.marketCapUsd ?? 0) || undefined,
              });
            }
          }
        } catch { /* */ }
      }
    }

    // KOL signals (tracker type kol)
    if (cfg.trackKol) {
      try {
        const result = await onchainosSignal.activities("kol", config.chainId);
        if (result.success && result.data) {
          const raw = result.data as Record<string, unknown>;
          const trades = (Array.isArray(raw) ? raw : (raw.trades as Array<Record<string, string>> | undefined)) ?? [];
          if (Array.isArray(trades)) {
            for (const s of trades) {
              const addr = s.tokenAddress ?? s.tokenContractAddress ?? s.token;
              if (!addr) continue;
              add({
                address: addr,
                source: "kol",
                symbol: s.tokenSymbol,
                priceUsd: Number(s.tokenPrice ?? 0) || undefined,
                marketCap: Number(s.marketCap ?? 0) || undefined,
              });
            }
          }
        }
      } catch { /* */ }
    }

    // Hot tokens — richest data source (price, mcap, liquidity, volume, change)
    try {
      const result = await onchainosToken.hotTokens();
      if (result.success && Array.isArray(result.data)) {
        for (const t of result.data as Array<Record<string, string>>) {
          const addr = t.tokenContractAddress ?? t.address ?? t.token;
          if (!addr) continue;
          add({
            address: addr,
            source: "hot_token",
            symbol: t.tokenSymbol ?? t.symbol,
            priceUsd: Number(t.price ?? 0) || undefined,
            marketCap: Number(t.marketCap ?? 0) || undefined,
            liquidityUsd: Number(t.liquidity ?? 0) || undefined,
            volume24h: Number(t.volume ?? 0) || undefined,
            priceChange24h: Number(t.change ?? 0) || undefined,
            holders: Number(t.holders ?? 0) || undefined,
          });
        }
      }
    } catch { /* */ }

    // DexScreener trending/promoted tokens
    try {
      const trending = await getTrendingTokens();
      const xlayerTrending = trending.filter((t) =>
        String(t.chainId) === "196" || String(t.chainId).toLowerCase() === "xlayer"
      );
      for (const t of xlayerTrending) {
        if (t.tokenAddress) add({ address: t.tokenAddress, source: "dexscreener_trending" });
      }
    } catch { /* DexScreener unavailable */ }

    const candidates = Array.from(byAddr.values());
    this.log(`Discovered ${candidates.length} unique tokens from ${cfg.sources.length} trenches stages + signals`);
    return candidates;
  }
}
