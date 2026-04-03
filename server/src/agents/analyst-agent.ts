import { type Address, createPublicClient, http } from "viem";
import { BaseAgent, type ReinvestConfig } from "./base-agent.js";
import { type AgenticWallet } from "../wallet/agentic-wallet.js";
import { onchainosToken, onchainosSecurity, onchainosSignal } from "../lib/onchainos.js";
import { okxTokenSecurity } from "../lib/okx-api.js";
import { getPool, getPoolInfo, FACTORY } from "../lib/uniswap.js";
import { config } from "../config.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AnalysisResult {
  token: string;
  name: string;
  symbol: string;
  priceUsd: number;
  marketCap: number;
  volume24h: number;
  riskScore: number;
  risks: string[];
  recommendation: "AVOID" | "CAUTION" | "LOW_RISK" | "OPPORTUNITY";
  securityScan: Record<string, unknown> | null;
  liquidityPools: Array<Record<string, unknown>>;
  timestamp: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ZERO_ADDRESS: Address = "0x0000000000000000000000000000000000000000";

function computeRiskScore(risks: string[]): number {
  let score = 0;
  for (const r of risks) {
    if (r.includes("honeypot")) score += 50;
    else if (r.includes("proxy")) score += 15;
    else if (r.includes("mint")) score += 20;
    else if (r.includes("high_tax")) score += 15;
  }
  return Math.min(score, 100);
}

function classify(riskScore: number): AnalysisResult["recommendation"] {
  if (riskScore >= 50) return "AVOID";
  if (riskScore >= 25) return "CAUTION";
  if (riskScore >= 10) return "LOW_RISK";
  return "OPPORTUNITY";
}

// ---------------------------------------------------------------------------
// Agent
// ---------------------------------------------------------------------------

export class AnalystAgent extends BaseAgent {
  constructor(wallet: AgenticWallet, reinvestConfig?: ReinvestConfig) {
    super("analyst", wallet, reinvestConfig);
  }

  async execute(action: string, params: Record<string, unknown> = {}): Promise<unknown> {
    switch (action) {
      case "token-report":
        return this.tokenReport(params);
      case "trending":
        return this.getTrending();
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  }

  // -----------------------------------------------------------------------
  // token-report
  // -----------------------------------------------------------------------

  private async tokenReport(params: Record<string, unknown>): Promise<AnalysisResult> {
    const token = (params.token as string) ?? "0x0";
    this.log(`Generating token report for ${token}`);

    // 1. Price info
    const priceResult = onchainosToken.priceInfo(token);
    const priceData = (priceResult.success ? priceResult.data : null) as Record<string, unknown> | null;

    // 2. Security scan via OnchainOS
    const secResult = onchainosSecurity.tokenScan(token, config.chainId);
    let securityScan = (secResult.success ? secResult.data : null) as Record<string, unknown> | null;

    // Fallback to OKX token security
    if (!securityScan) {
      try {
        securityScan = await okxTokenSecurity(String(config.chainId), token) as Record<string, unknown> | null;
      } catch {
        securityScan = null;
      }
    }

    // 3. Advanced info (dev stats)
    const advResult = onchainosToken.advancedInfo(token);
    const advData = (advResult.success ? advResult.data : null) as Record<string, unknown> | null;

    // 4. Liquidity pools from OnchainOS
    const liqResult = onchainosToken.liquidity(token);
    const liqData = (liqResult.success ? liqResult.data : null) as Record<string, unknown> | null;
    const liquidityPools: Array<Record<string, unknown>> = Array.isArray(liqData) ? liqData : [];

    // 5. Uniswap v3 pool check
    try {
      const xlayer = createPublicClient({ transport: http(config.xlayerRpcUrl) });
      const usdt = config.contracts.usdt as Address;
      const poolAddr = await getPool(xlayer, token as Address, usdt, 3000);
      if (poolAddr && poolAddr !== ZERO_ADDRESS) {
        const poolInfo = await getPoolInfo(xlayer, poolAddr);
        liquidityPools.push({
          source: "uniswap_v3",
          address: poolInfo.address,
          token0: poolInfo.token0,
          token1: poolInfo.token1,
          fee: poolInfo.fee,
          liquidity: poolInfo.liquidity.toString(),
        });
      }
    } catch {
      // Uniswap pool not available
    }

    // 6. Risk analysis
    const risks: string[] = [];
    if (securityScan) {
      if (securityScan.isHoneypot === true || securityScan.isHoneypot === "1") risks.push("honeypot");
      if (securityScan.isProxy === true || securityScan.isProxy === "1") risks.push("proxy");
      if (securityScan.isMintable === true || securityScan.isMintable === "1") risks.push("mint");
      const buyTax = Number(securityScan.buyTax ?? 0);
      const sellTax = Number(securityScan.sellTax ?? 0);
      if (buyTax > 5 || sellTax > 5) risks.push("high_tax");
    }

    const riskScore = computeRiskScore(risks);
    const recommendation = classify(riskScore);

    const result: AnalysisResult = {
      token,
      name: String(priceData?.name ?? advData?.name ?? "Unknown"),
      symbol: String(priceData?.symbol ?? advData?.symbol ?? "???"),
      priceUsd: Number(priceData?.priceUsd ?? priceData?.price ?? 0),
      marketCap: Number(priceData?.marketCap ?? advData?.marketCap ?? 0),
      volume24h: Number(priceData?.volume24h ?? advData?.volume24h ?? 0),
      riskScore,
      risks,
      recommendation,
      securityScan,
      liquidityPools,
      timestamp: new Date().toISOString(),
    };

    this.emit({
      timestamp: Date.now(),
      agent: this.name,
      type: "token-report",
      message: `Report for ${token}: ${recommendation} (risk ${riskScore})`,
      details: { token, riskScore, recommendation },
    });

    return result;
  }

  // -----------------------------------------------------------------------
  // trending
  // -----------------------------------------------------------------------

  private getTrending(): Record<string, unknown> {
    const activitiesResult = onchainosSignal.activities("smart_money");
    const hotResult = onchainosToken.hotTokens();

    return {
      smartMoney: activitiesResult.success ? activitiesResult.data : [],
      hotTokens: hotResult.success ? hotResult.data : [],
      timestamp: new Date().toISOString(),
    };
  }

  // -----------------------------------------------------------------------
  // Autonomous loop
  // -----------------------------------------------------------------------

  override async autonomousLoop(): Promise<void> {
    this.log("Autonomous loop: fetching trending tokens");

    const trending = this.getTrending();
    const hotTokens = trending.hotTokens as Array<Record<string, unknown>> | undefined;
    const tokens = (hotTokens ?? []).slice(0, 3);

    for (const t of tokens) {
      const address = String(t.address ?? t.token ?? t.contractAddress ?? "");
      if (!address) continue;
      try {
        await this.tokenReport({ token: address });
      } catch (err) {
        this.log(`Failed to analyze ${address}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    this.emit({
      timestamp: Date.now(),
      agent: this.name,
      type: "autonomous-cycle",
      message: `Analyzed ${tokens.length} trending tokens`,
    });
  }

  // -----------------------------------------------------------------------
  // Service buying
  // -----------------------------------------------------------------------

  override shouldBuyService(type: string): boolean {
    return type === "auditor" || type === "trader";
  }
}
