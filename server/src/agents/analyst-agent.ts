import { type Address, createPublicClient, http } from "viem";
import { BaseAgent, type ReinvestConfig } from "./base-agent.js";
import { type AgenticWallet } from "../wallet/agentic-wallet.js";
import {
  onchainosToken,
  onchainosSecurity,
  onchainosTrenches,
  onchainosDefi,
  onchainosMarket,
} from "../lib/onchainos.js";
import { settings } from "../settings.js";
import { okxTokenSecurity } from "../lib/okx-api.js";
import { getPool, getPoolInfo } from "../lib/uniswap.js";
import { getTokenPairs } from "../lib/dexscreener.js";
import { getPoolApy } from "../lib/defillama.js";
import { getQuote as getUniswapQuote } from "../lib/uniswap-trading.js";
import { config } from "../config.js";
import { verdictStore } from "../verdicts/verdict-store.js";
import { publishVerdictOnChain } from "../contracts/verdict-registry.js";
import type { Verdict } from "../types.js";

// ---------------------------------------------------------------------------
// ABI fragments for bytecode probing
// ---------------------------------------------------------------------------

const inspectAbi = [
  { name: "owner", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { name: "paused", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "bool" }] },
  { name: "name", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { name: "symbol", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { name: "decimals", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
  { name: "totalSupply", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { name: "proxiableUUID", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "bytes32" }] },
] as const;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ZERO_ADDRESS: Address = "0x0000000000000000000000000000000000000000";

// ---------------------------------------------------------------------------
// Multi-chain support
// ---------------------------------------------------------------------------

const CHAIN_RPC: Record<number, string> = {
  1: "https://eth.llamarpc.com",
  56: "https://bsc-dataseed.binance.org",
  137: "https://polygon-rpc.com",
  42161: "https://arb1.arbitrum.io/rpc",
  10: "https://mainnet.optimism.io",
  8453: "https://mainnet.base.org",
  43114: "https://api.avax.network/ext/bc/C/rpc",
  250: "https://rpc.ftm.tools",
  324: "https://mainnet.era.zksync.io",
  59144: "https://rpc.linea.build",
  534352: "https://rpc.scroll.io",
};

const CHAIN_DEXSCREENER: Record<number, string> = {
  1: "ethereum",
  56: "bsc",
  137: "polygon",
  42161: "arbitrum",
  10: "optimism",
  8453: "base",
  43114: "avalanche",
  196: "xlayer",
  250: "fantom",
  324: "zksync",
  59144: "linea",
  534352: "scroll",
};

const CHAIN_DEFILLAMA: Record<number, string> = {
  1: "Ethereum",
  56: "BSC",
  137: "Polygon",
  42161: "Arbitrum",
  10: "Optimism",
  8453: "Base",
  43114: "Avalanche",
  196: "X Layer",
  250: "Fantom",
  324: "zkSync Era",
  59144: "Linea",
  534352: "Scroll",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function safeCall<T>(fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch {
    return null;
  }
}

function classifyVerdict(score: number): Verdict["verdict"] {
  const threshold = settings.get().analyze.riskThreshold;
  if (score <= Math.floor(threshold * 0.375)) return "SAFE";
  if (score <= threshold) return "CAUTION";
  return "DANGEROUS";
}

// ---------------------------------------------------------------------------
// Agent
// ---------------------------------------------------------------------------

export class AnalystAgent extends BaseAgent {
  private readonly publicClient;

  constructor(wallet: AgenticWallet, reinvestConfig?: ReinvestConfig) {
    super("Analyst", wallet, reinvestConfig);
    this.publicClient = createPublicClient({
      transport: http(config.xlayerRpcUrl),
    });
  }

  async execute(
    action: string,
    params: Record<string, unknown> = {},
  ): Promise<unknown> {
    const chainId = Number(params.chainId ?? config.chainId);
    switch (action) {
      case "scan":
        return this.deepScan(params.token as string, chainId);
      case "report": {
        const token = params.token as string;
        const existing = verdictStore.getByToken(token);
        if (existing) return existing;
        return this.deepScan(token, chainId);
      }
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  }

  // -------------------------------------------------------------------------
  // Deep scan
  // -------------------------------------------------------------------------

  async deepScan(tokenAddress: string, chainId: number = config.chainId): Promise<Verdict> {
    this.log(`Deep scan: ${tokenAddress} on chain ${chainId}`);

    // Build RPC client for the target chain
    const rpcUrl = chainId === config.chainId
      ? config.xlayerRpcUrl
      : CHAIN_RPC[chainId];
    const client = rpcUrl
      ? createPublicClient({ transport: http(rpcUrl) })
      : this.publicClient;

    // 1. Price info
    const priceResult = onchainosToken.priceInfo(tokenAddress, chainId);
    const priceData = (priceResult.success ? priceResult.data : null) as Record<string, unknown> | null;

    // 2. Security scan via OnchainOS
    const secResult = onchainosSecurity.tokenScan(tokenAddress, chainId);
    let securityScan = (secResult.success ? secResult.data : null) as Record<string, unknown> | null;

    // 3. Fallback: OKX token security
    if (!securityScan) {
      try {
        securityScan = (await okxTokenSecurity(
          String(chainId),
          tokenAddress,
        )) as Record<string, unknown> | null;
      } catch {
        securityScan = null;
      }
    }

    // 4. Dev info — memepump is X Layer only, skip for other chains
    let devLaunchedInfo: Record<string, unknown> | null = null;
    let devHoldingInfo: Record<string, unknown> | null = null;
    let devTags: Record<string, unknown> | null = null;

    if (chainId === 196) {
      const devResult = onchainosTrenches.tokenDevInfo(tokenAddress, chainId);
      const devData = (devResult.success ? devResult.data : null) as Record<string, unknown> | null;
      devLaunchedInfo = (devData?.devLaunchedInfo ?? null) as Record<string, unknown> | null;
      devHoldingInfo = (devData?.devHoldingInfo ?? null) as Record<string, unknown> | null;

      // 4b. Token details (memepump tags, social, market data)
      const detailsResult = onchainosTrenches.tokenDetails(tokenAddress, chainId);
      const detailsData = (detailsResult.success ? detailsResult.data : null) as Record<string, unknown> | null;
      devTags = (detailsData?.tags ?? null) as Record<string, unknown> | null;
    }

    // 5. Advanced info (holder concentration)
    const advResult = onchainosToken.advancedInfo(tokenAddress, chainId);
    const advData = (advResult.success ? advResult.data : null) as Record<string, unknown> | null;

    // 6. Bytecode probe via viem readContract
    const [owner, _paused, name, symbol, _decimals, _totalSupply, proxiableUUID] =
      await Promise.all([
        safeCall(() =>
          client.readContract({
            address: tokenAddress as Address,
            abi: inspectAbi,
            functionName: "owner",
          }),
        ),
        safeCall(() =>
          client.readContract({
            address: tokenAddress as Address,
            abi: inspectAbi,
            functionName: "paused",
          }),
        ),
        safeCall(() =>
          client.readContract({
            address: tokenAddress as Address,
            abi: inspectAbi,
            functionName: "name",
          }),
        ),
        safeCall(() =>
          client.readContract({
            address: tokenAddress as Address,
            abi: inspectAbi,
            functionName: "symbol",
          }),
        ),
        safeCall(() =>
          client.readContract({
            address: tokenAddress as Address,
            abi: inspectAbi,
            functionName: "decimals",
          }),
        ),
        safeCall(() =>
          client.readContract({
            address: tokenAddress as Address,
            abi: inspectAbi,
            functionName: "totalSupply",
          }),
        ),
        safeCall(() =>
          client.readContract({
            address: tokenAddress as Address,
            abi: inspectAbi,
            functionName: "proxiableUUID",
          }),
        ),
      ]);

    // 7. Liquidity check + Uniswap pool address extraction
    const liqResult = onchainosToken.liquidity(tokenAddress, chainId);
    const liqRaw = liqResult.success ? liqResult.data : null;
    let liquidityUsd = 0;
    let uniswapPoolAddress = "";

    if (Array.isArray(liqRaw)) {
      const pools = liqRaw as Array<Record<string, unknown>>;
      liquidityUsd = pools.reduce(
        (sum, p) => sum + Number(p.liquidityUsd ?? p.tvlUsd ?? 0),
        0,
      );

      // Find best Uniswap pool with a valid address (42 chars = V3 contract, not V4 bytes32)
      const uniPools = pools
        .filter((p) => {
          const proto = String(p.protocolName ?? "").toLowerCase();
          const addr = String(p.poolAddress ?? "");
          return proto.includes("uniswap") && addr.length === 42;
        })
        .sort((a, b) => Number(b.liquidityUsd ?? 0) - Number(a.liquidityUsd ?? 0));

      if (uniPools.length > 0) {
        uniswapPoolAddress = String(uniPools[0].poolAddress);
      }
    } else if (liqRaw && typeof liqRaw === "object") {
      const obj = liqRaw as Record<string, unknown>;
      liquidityUsd = Number(obj.liquidityUsd ?? obj.tvlUsd ?? 0);
    }

    // 8. Risk scoring — multi-source intelligence
    const risks: string[] = [];
    let riskScore = 0;

    // --- Source A: OKX Security Scan (honeypot, tax, risk flag) ---
    const isRiskToken = securityScan?.isRiskToken === true;
    const isHoneypot =
      securityScan?.isHoneypot === true || securityScan?.isHoneypot === "1";
    const buyTax = Number(securityScan?.buyTaxes ?? securityScan?.buyTax ?? 0);
    const sellTax = Number(securityScan?.sellTaxes ?? securityScan?.sellTax ?? 0);

    if (isHoneypot) {
      risks.push("honeypot");
      riskScore += 50;
    }
    if (isRiskToken && !isHoneypot) {
      risks.push("flagged_risk_token");
      riskScore += 25;
    }
    if (buyTax > 10 || sellTax > 10) {
      risks.push(`high_tax(buy:${buyTax}%,sell:${sellTax}%)`);
      riskScore += 25;
    } else if (buyTax > 5 || sellTax > 5) {
      risks.push(`moderate_tax(buy:${buyTax}%,sell:${sellTax}%)`);
      riskScore += 12;
    }

    // --- Source B: OKX Advanced Info (native risk level, LP, holders, tags) ---
    // riskControlLevel: 0=high risk, 1=medium, 2=low
    const okxRiskLevel = Number(advData?.riskControlLevel ?? -1);
    if (okxRiskLevel === 0) {
      risks.push("okx_high_risk");
      riskScore += 30;
    } else if (okxRiskLevel === 1) {
      risks.push("okx_medium_risk");
      riskScore += 10;
    }

    const lpBurnedPercent = Number(advData?.lpBurnedPercent ?? 0);
    const top10Hold = Number(advData?.top10HoldPercent ?? advData?.topHolderPercent ?? 0);
    const devHold = Number(advData?.devHoldingPercent ?? 0);
    const sniperHold = Number(advData?.sniperHoldingPercent ?? 0);
    const bundleHold = Number(advData?.bundleHoldingPercent ?? 0);
    const suspiciousHold = Number(advData?.suspiciousHoldingPercent ?? 0);
    const tokenTags = (Array.isArray(advData?.tokenTags) ? advData.tokenTags : []) as string[];

    // LP not burned = higher risk for small tokens (burned is good)
    // Skip for large-cap tokens where LP burn isn't relevant
    const marketCapForLp = Number(priceData?.marketCap ?? 0);
    if (lpBurnedPercent > 0 && lpBurnedPercent < 50 && marketCapForLp < 1_000_000) {
      risks.push(`lp_partially_burned(${lpBurnedPercent.toFixed(0)}%)`);
      riskScore += 8;
    }

    // Top 10 holder concentration
    if (top10Hold > 50) {
      risks.push(`top10_hold_${top10Hold.toFixed(1)}%`);
      riskScore += 20;
    } else if (top10Hold > 30) {
      risks.push(`top10_hold_${top10Hold.toFixed(1)}%`);
      riskScore += 10;
    } else if (top10Hold > 15) {
      risks.push(`top10_hold_${top10Hold.toFixed(1)}%`);
      riskScore += 5;
    }

    // Dev still holding significant amount
    if (devHold > 10) {
      risks.push(`dev_holds_${devHold.toFixed(1)}%`);
      riskScore += 20;
    } else if (devHold > 3) {
      risks.push(`dev_holds_${devHold.toFixed(1)}%`);
      riskScore += 8;
    }

    // Snipers — bots that bought at launch
    if (sniperHold > 10) {
      risks.push(`snipers_${sniperHold.toFixed(1)}%`);
      riskScore += 15;
    } else if (sniperHold > 3) {
      risks.push(`snipers_${sniperHold.toFixed(1)}%`);
      riskScore += 5;
    }

    // Bundle / wash trading wallets
    if (bundleHold > 5) {
      risks.push(`bundlers_${bundleHold.toFixed(1)}%`);
      riskScore += 12;
    }

    // Suspicious wallets (phishing etc)
    if (suspiciousHold > 1) {
      risks.push(`suspicious_wallets_${suspiciousHold.toFixed(1)}%`);
      riskScore += 15;
    }

    // OKX token tags — semantic risk signals
    for (const tag of tokenTags) {
      if (tag.includes("RugPull") || tag.includes("rugPull")) {
        risks.push("tag:rug_pull");
        riskScore += 40;
      }
      if (tag.includes("volumeSurge") || tag.includes("VolumeSurge")) {
        risks.push("tag:volume_surge");
        riskScore += 3;
      }
      if (tag.includes("devSellAll") || tag.includes("SellAll")) {
        risks.push("tag:dev_sold_all");
        // Not necessarily bad — dev selling = decentralizing
      }
    }

    // --- Source C: Dev/Rug history from token-dev-info ---
    const devRugPullCount = Number(devLaunchedInfo?.rugPullCount ?? advData?.devRugPullTokenCount ?? 0);
    const devTotalTokens = Number(devLaunchedInfo?.totalTokens ?? advData?.devCreateTokenCount ?? 0);
    const devMigratedCount = Number(devLaunchedInfo?.migratedCount ?? 0);
    const hasRug = devRugPullCount > 0;
    if (hasRug) {
      risks.push(`rug_history(${devRugPullCount}/${devTotalTokens} rugs)`);
      riskScore += 40;
    }
    if (devTotalTokens > 10 && devMigratedCount === 0) {
      risks.push(`serial_launcher(${devTotalTokens} tokens, 0 migrated)`);
      riskScore += 15;
    }

    // --- Source D: Bytecode probe (owner, proxy) ---
    const hasMint =
      securityScan?.isMintable === true || securityScan?.isMintable === "1";
    if (hasMint) {
      risks.push("mintable");
      riskScore += 20;
    }

    const isProxy = proxiableUUID !== null ||
      securityScan?.isProxy === true || securityScan?.isProxy === "1";
    if (isProxy) {
      risks.push("upgradeable_proxy");
      riskScore += 15;
    }

    if (owner !== null && !isProxy) {
      risks.push("has_owner");
      riskScore += 8;
    }

    // --- Source E: Liquidity analysis ---
    // Skip liquidity penalty for large-cap tokens (stablecoins, wrapped native etc)
    const marketCap = Number(priceData?.marketCap ?? 0);
    const price = Number(priceData?.price ?? 0);
    const isLargeCap = marketCap > 1_000_000;
    const isStablecoin = price > 0.9 && price < 1.1 && marketCap > 100_000;

    if (!isLargeCap && !isStablecoin) {
      if (liquidityUsd === 0) {
        risks.push("no_liquidity");
        riskScore += 30;
      } else if (liquidityUsd < 1000) {
        risks.push(`dust_liquidity($${liquidityUsd.toFixed(0)})`);
        riskScore += 25;
      } else if (liquidityUsd < 10000) {
        risks.push(`low_liquidity($${liquidityUsd.toFixed(0)})`);
        riskScore += 15;
      } else if (liquidityUsd < 50000) {
        risks.push(`thin_liquidity($${Math.round(liquidityUsd / 1000)}k)`);
        riskScore += 5;
      }
    }

    // --- Source F: Price action (pump & dump signals) ---
    const priceChange1H = Number(priceData?.priceChange1H ?? 0);
    const priceChange24H = Number(priceData?.priceChange24H ?? 0);
    if (Math.abs(priceChange1H) > 50) {
      risks.push(`volatile_1h(${priceChange1H > 0 ? "+" : ""}${priceChange1H.toFixed(0)}%)`);
      riskScore += 10;
    }
    if (priceChange24H < -70) {
      risks.push(`crash_24h(${priceChange24H.toFixed(0)}%)`);
      riskScore += 15;
    }

    // --- Source H: Kline candle analysis (volatility + trend) ---
    if (settings.get().analyze.useKline) {
      try {
        const klineResult = onchainosMarket.kline(tokenAddress, chainId);
        if (klineResult.success && Array.isArray(klineResult.data)) {
          const candles = klineResult.data as Array<{ o: string; h: string; l: string; c: string; vol: string; ts: string }>;
          if (candles.length >= 3) {
            const ranges = candles.slice(0, 12).map((c) => {
              const high = Number(c.h);
              const low = Number(c.l);
              const mid = (high + low) / 2;
              return mid > 0 ? ((high - low) / mid) * 100 : 0;
            });
            const avgVolatility = ranges.reduce((s, r) => s + r, 0) / ranges.length;

            if (avgVolatility > 30) {
              risks.push(`kline_high_volatility(${avgVolatility.toFixed(1)}%)`);
              riskScore += 12;
            } else if (avgVolatility > 15) {
              risks.push(`kline_moderate_volatility(${avgVolatility.toFixed(1)}%)`);
              riskScore += 5;
            }

            let redStreak = 0;
            for (const c of candles.slice(0, 6)) {
              if (Number(c.c) < Number(c.o)) redStreak++;
              else break;
            }
            if (redStreak >= 4) {
              risks.push(`kline_downtrend(${redStreak}_red_candles)`);
              riskScore += 8;
            }

            const recentVol = candles.slice(0, 3).reduce((s, c) => s + Number(c.vol), 0);
            if (recentVol < 100 && !isLargeCap) {
              risks.push("kline_dead_volume");
              riskScore += 8;
            }
          }
        }
      } catch { /* kline unavailable */ }
    }

    // --- Source I: Bundle analysis (suspicious bundled txs) — memepump, X Layer only ---
    if (chainId === 196) {
      try {
        const bundleResult = onchainosTrenches.tokenBundleInfo(tokenAddress);
        if (bundleResult.success && bundleResult.data) {
          const bundle = bundleResult.data as Record<string, string>;
          const totalBundlers = Number(bundle.totalBundlers ?? 0);
          if (totalBundlers > 5) {
            risks.push(`bundled_launch(${totalBundlers}_bundlers)`);
            riskScore += 20;
          } else if (totalBundlers > 0) {
            risks.push(`minor_bundling(${totalBundlers}_bundlers)`);
            riskScore += 5;
          }
        }
      } catch { /* bundle info unavailable */ }
    }

    // --- Source J: DexScreener pool data ---
    let dexScreenerData: Verdict["dexScreener"] | undefined;
    try {
      const dexChain = CHAIN_DEXSCREENER[chainId] ?? "xlayer";
      const dexPairs = await getTokenPairs(dexChain, tokenAddress);
      if (dexPairs.length > 0) {
        const best = dexPairs.sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))[0];
        dexScreenerData = {
          pairAddress: best.pairAddress,
          priceUsd: best.priceUsd,
          volume24h: best.volume?.h24 ?? 0,
          liquidity: best.liquidity?.usd ?? 0,
          fdv: best.fdv ?? 0,
          pairCreatedAt: best.pairCreatedAt ?? 0,
          url: best.url ?? "",
        };

        if (best.pairCreatedAt) {
          const ageMs = Date.now() - best.pairCreatedAt;
          const ageDays = ageMs / (1000 * 60 * 60 * 24);
          if (ageDays < 1) {
            risks.push("very_new_token(<1d)");
            riskScore += 25;
          } else if (ageDays < 7) {
            risks.push(`new_token_risk(${Math.floor(ageDays)}d)`);
            riskScore += 15;
          }
        }

        const vol24 = best.volume?.h24 ?? 0;
        if (vol24 < 1000 && !isLargeCap) {
          risks.push(`dex_low_volume($${Math.floor(vol24)})`);
          riskScore += 10;
        }

        const dexLiq = best.liquidity?.usd ?? 0;
        if (dexLiq < 10000 && !isLargeCap && !isStablecoin) {
          risks.push(`dex_thin_liquidity($${Math.floor(dexLiq)})`);
          riskScore += 12;
        }

        if (best.fdv > 0 && best.fdv < 50000 && !isStablecoin) {
          risks.push(`micro_cap(fdv:$${Math.floor(best.fdv / 1000)}k)`);
          riskScore += 8;
        }

        const dexChange = best.priceChange?.h24 ?? 0;
        if (dexChange < -50) {
          risks.push(`dex_crash(${dexChange.toFixed(0)}%)`);
          riskScore += 10;
        }
      }
    } catch { /* DexScreener unavailable */ }

    // --- Source K: DefiLlama APY data ---
    let defiLlamaApy: number | undefined;
    try {
      const symForLlama = String(priceData?.symbol ?? symbol ?? advData?.symbol ?? "");
      const llamaChain = CHAIN_DEFILLAMA[chainId] ?? "X Layer";
      const llamaPool = await getPoolApy(symForLlama, llamaChain);
      if (llamaPool) {
        defiLlamaApy = llamaPool.apy;
        if (llamaPool.apy > 1000) {
          risks.push(`suspicious_apy(${llamaPool.apy.toFixed(0)}%)`);
          riskScore += 5;
        }
      }
    } catch { /* DefiLlama unavailable */ }

    // --- Source L: Uniswap Trading API route check ---
    let uniswapRoute: string | undefined;
    try {
      const uniQuote = await getUniswapQuote({
        tokenIn: config.contracts.usdt,
        tokenOut: tokenAddress,
        tokenInChainId: chainId,
        tokenOutChainId: chainId,
        amount: "1000000",
        type: "EXACT_INPUT",
        swapper: this.walletAddress,
      });
      if (uniQuote) {
        uniswapRoute = uniQuote.routeString;
      } else if (!isLargeCap && !isStablecoin) {
        risks.push("no_uniswap_route");
        riskScore += 20;
      }
    } catch { /* Trading API unavailable */ }

    // --- Source M: Cluster analysis (rug pull probability) ---
    let clusterData: Record<string, unknown> | null = null;
    try {
      const clusterResult = onchainosToken.clusterOverview(tokenAddress, chainId);
      if (clusterResult.success && clusterResult.data) {
        clusterData = clusterResult.data as Record<string, unknown>;
        const rugPullPercent = Number(clusterData.rugPullPercent ?? 0);
        const newAddressPercent = Number(clusterData.holderNewAddressPercent ?? 0);
        const sameFundPercent = Number(clusterData.holderSameFundSourcePercent ?? 0);

        if (rugPullPercent > 50) {
          risks.push(`cluster_rug_risk(${rugPullPercent.toFixed(0)}%)`);
          riskScore += 25;
        } else if (rugPullPercent > 20) {
          risks.push(`cluster_rug_risk(${rugPullPercent.toFixed(0)}%)`);
          riskScore += 10;
        }
        if (newAddressPercent > 50) {
          risks.push(`cluster_new_addresses(${newAddressPercent.toFixed(0)}%)`);
          riskScore += 10;
        }
        if (sameFundPercent > 30) {
          risks.push(`cluster_same_fund(${sameFundPercent.toFixed(0)}%)`);
          riskScore += 12;
        }
      }
    } catch { /* cluster unavailable */ }

    // --- Source N: Token holders (smart money / whale presence) ---
    let holderInsight: { smartMoneyCount: number; whaleCount: number; kolCount: number } | null = null;
    try {
      const holdersResult = onchainosToken.holders(tokenAddress, chainId);
      if (holdersResult.success && Array.isArray(holdersResult.data)) {
        const holderList = holdersResult.data as Array<Record<string, unknown>>;
        // Count tagged holders from top 100
        let smartMoneyCount = 0;
        let whaleCount = 0;
        let kolCount = 0;
        for (const h of holderList) {
          const tags = h.tags as string[] | undefined;
          if (tags?.includes("3")) smartMoneyCount++;
          if (tags?.includes("4")) whaleCount++;
          if (tags?.includes("1")) kolCount++;
        }
        holderInsight = { smartMoneyCount, whaleCount, kolCount };
      }
    } catch { /* holders unavailable */ }

    // --- Source O: Top traders PnL ---
    let topTraderAvgPnl: number | null = null;
    try {
      const traderResult = onchainosToken.topTrader(tokenAddress, chainId);
      if (traderResult.success && Array.isArray(traderResult.data)) {
        const traders = traderResult.data as Array<Record<string, string>>;
        if (traders.length > 0) {
          const pnls = traders.map((t) => Number(t.totalPnlUsd ?? 0));
          topTraderAvgPnl = pnls.reduce((s, p) => s + p, 0) / pnls.length;
          if (topTraderAvgPnl < -1000) {
            risks.push(`top_traders_losing(avg:$${topTraderAvgPnl.toFixed(0)})`);
            riskScore += 8;
          }
        }
      }
    } catch { /* top traders unavailable */ }

    // --- Source G: Age & activity ---
    const holders = Number(priceData?.holders ?? advData?.totalHolders ?? devTags?.totalHolders ?? 0);
    if (holders > 0 && holders < 10) {
      risks.push(`tiny_community(${holders} holders)`);
      riskScore += 10;
    }

    const holderConcentration = top10Hold;

    riskScore = Math.min(riskScore, 100);

    // 9. Classify verdict
    const verdictLabel = classifyVerdict(riskScore);

    const tokenName = String(
      priceData?.name ?? name ?? advData?.name ?? "Unknown",
    );
    const tokenSymbol = String(
      priceData?.symbol ?? symbol ?? advData?.symbol ?? "???",
    );

    // 10. DeFi pool discovery (for safe tokens — show investment opportunity)
    let defiPool: Verdict["defiPool"] | undefined;
    if (verdictLabel === "SAFE" || verdictLabel === "CAUTION") {
      try {
        const poolSearch = onchainosDefi.search(tokenSymbol, chainId, "DEX_POOL");
        if (poolSearch.success && poolSearch.data) {
          const searchData = poolSearch.data as Record<string, unknown>;
          const list = (searchData.list ?? searchData) as Array<Record<string, unknown>>;
          if (Array.isArray(list) && list.length > 0) {
            const best = [...list].sort(
              (a, b) => Number(b.tvl ?? 0) - Number(a.tvl ?? 0),
            )[0];

            defiPool = {
              name: String(best.name ?? ""),
              platform: String(best.platformName ?? ""),
              apr: String(best.rate ?? "0"),
              tvl: String(best.tvl ?? "0"),
              investmentId: Number(best.investmentId ?? 0),
              poolAddress: uniswapPoolAddress,
            };
          }
        }
      } catch {
        // DeFi search optional
      }
    }

    const verdict: Verdict = {
      token: tokenAddress,
      tokenName,
      tokenSymbol,
      chainId,
      riskScore,
      verdict: verdictLabel,
      isHoneypot,
      hasRug,
      hasMint,
      isProxy,
      buyTax,
      sellTax,
      holderConcentration,
      risks,
      priceUsd: Number(priceData?.priceUsd ?? priceData?.price ?? 0),
      marketCap: Number(priceData?.marketCap ?? advData?.marketCap ?? 0),
      liquidityUsd,
      timestamp: Date.now(),
      holders,
      priceChange24H,
      volume24H: Number(priceData?.volume24H ?? 0),
      defiPool,
      dexScreener: dexScreenerData,
      defiLlamaApy,
      uniswapRoute,
      clusterOverview: clusterData ? {
        clusterConcentration: String(clusterData.clusterConcentration ?? ""),
        rugPullPercent: Number(clusterData.rugPullPercent ?? 0),
        newAddressPercent: Number(clusterData.holderNewAddressPercent ?? 0),
        sameFundPercent: Number(clusterData.holderSameFundSourcePercent ?? 0),
      } : undefined,
      holderInsight: holderInsight ?? undefined,
      topTraderAvgPnl: topTraderAvgPnl ?? undefined,
      devInfo: devLaunchedInfo ? {
        totalTokens: Number(devLaunchedInfo.totalTokens ?? 0),
        rugPullCount: Number(devLaunchedInfo.rugPullCount ?? 0),
        migratedCount: Number(devLaunchedInfo.migratedCount ?? 0),
        goldenGemCount: Number(devLaunchedInfo.goldenGemCount ?? 0),
      } : undefined,
    };

    // 10. Store verdict
    verdictStore.add(verdict);

    // 11. Publish on-chain
    try {
      await publishVerdictOnChain(
        this.wallet,
        tokenAddress as Address,
        riskScore,
        verdictLabel,
        isHoneypot,
        hasRug,
      );
      this.log(`On-chain verdict published for ${tokenAddress}`);
    } catch (err) {
      this.log(
        `Failed to publish on-chain verdict: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    // 12. Emit event
    this.emit({
      timestamp: Date.now(),
      agent: this.name,
      type: "verdict",
      message: `${tokenSymbol}: ${verdictLabel} (risk ${riskScore})`,
      details: {
        token: tokenAddress,
        riskScore,
        verdict: verdictLabel,
        risks,
      },
    });

    return verdict;
  }

  // -------------------------------------------------------------------------
  // Service buying — analyst buys nothing
  // -------------------------------------------------------------------------

  override shouldBuyService(_type: string): boolean {
    return false;
  }
}
