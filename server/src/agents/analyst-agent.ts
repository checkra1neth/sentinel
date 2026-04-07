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
    switch (action) {
      case "scan":
        return this.deepScan(params.token as string);
      case "report": {
        const token = params.token as string;
        const existing = verdictStore.getByToken(token);
        if (existing) return existing;
        return this.deepScan(token);
      }
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  }

  // -------------------------------------------------------------------------
  // Deep scan
  // -------------------------------------------------------------------------

  async deepScan(tokenAddress: string): Promise<Verdict> {
    this.log(`Deep scan: ${tokenAddress}`);

    // 1. Price info
    const priceResult = onchainosToken.priceInfo(tokenAddress, config.chainId);
    const priceData = (priceResult.success ? priceResult.data : null) as Record<string, unknown> | null;

    // 2. Security scan via OnchainOS
    const secResult = onchainosSecurity.tokenScan(tokenAddress, config.chainId);
    let securityScan = (secResult.success ? secResult.data : null) as Record<string, unknown> | null;

    // 3. Fallback: OKX token security
    if (!securityScan) {
      try {
        securityScan = (await okxTokenSecurity(
          String(config.chainId),
          tokenAddress,
        )) as Record<string, unknown> | null;
      } catch {
        securityScan = null;
      }
    }

    // 4. Dev info (rug history + memepump tags)
    const devResult = onchainosTrenches.devInfo(tokenAddress, config.chainId);
    const devData = (devResult.success ? devResult.data : null) as Record<string, unknown> | null;
    const devTags = (devData?.tags ?? null) as Record<string, unknown> | null;

    // 5. Advanced info (holder concentration)
    const advResult = onchainosToken.advancedInfo(tokenAddress, config.chainId);
    const advData = (advResult.success ? advResult.data : null) as Record<string, unknown> | null;

    // 6. Bytecode probe via viem readContract
    const [owner, _paused, name, symbol, _decimals, _totalSupply, proxiableUUID] =
      await Promise.all([
        safeCall(() =>
          this.publicClient.readContract({
            address: tokenAddress as Address,
            abi: inspectAbi,
            functionName: "owner",
          }),
        ),
        safeCall(() =>
          this.publicClient.readContract({
            address: tokenAddress as Address,
            abi: inspectAbi,
            functionName: "paused",
          }),
        ),
        safeCall(() =>
          this.publicClient.readContract({
            address: tokenAddress as Address,
            abi: inspectAbi,
            functionName: "name",
          }),
        ),
        safeCall(() =>
          this.publicClient.readContract({
            address: tokenAddress as Address,
            abi: inspectAbi,
            functionName: "symbol",
          }),
        ),
        safeCall(() =>
          this.publicClient.readContract({
            address: tokenAddress as Address,
            abi: inspectAbi,
            functionName: "decimals",
          }),
        ),
        safeCall(() =>
          this.publicClient.readContract({
            address: tokenAddress as Address,
            abi: inspectAbi,
            functionName: "totalSupply",
          }),
        ),
        safeCall(() =>
          this.publicClient.readContract({
            address: tokenAddress as Address,
            abi: inspectAbi,
            functionName: "proxiableUUID",
          }),
        ),
      ]);

    // 7. Liquidity check + Uniswap pool address extraction
    const liqResult = onchainosToken.liquidity(tokenAddress, config.chainId);
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

    // --- Source C: Dev/Rug history from memepump ---
    const devRugPullCount = Number(advData?.devRugPullTokenCount ?? 0);
    const hasRug =
      devRugPullCount > 0 ||
      devData?.rugHistory === true ||
      devData?.hasRug === true;
    if (hasRug) {
      risks.push(`rug_history(${devRugPullCount} rugs)`);
      riskScore += 40;
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
        const klineResult = onchainosMarket.kline(tokenAddress, config.chainId);
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

    // --- Source I: Bundle analysis (suspicious bundled txs) ---
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

    // --- Source G: Age & activity ---
    const holders = Number(priceData?.holders ?? advData?.totalHolders ?? 0);
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
        const poolSearch = onchainosDefi.search(tokenSymbol, config.chainId, "DEX_POOL");
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
