import { type Address, createPublicClient, http } from "viem";
import { BaseAgent, type ReinvestConfig } from "./base-agent.js";
import { type AgenticWallet } from "../wallet/agentic-wallet.js";
import {
  onchainosToken,
  onchainosSecurity,
  onchainosTrenches,
} from "../lib/onchainos.js";
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
  if (score <= 15) return "SAFE";
  if (score <= 40) return "CAUTION";
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
    const priceResult = onchainosToken.priceInfo(tokenAddress);
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

    // 4. Dev info (rug history)
    const devResult = onchainosTrenches.devInfo(tokenAddress);
    const devData = (devResult.success ? devResult.data : null) as Record<string, unknown> | null;

    // 5. Advanced info (holder concentration)
    const advResult = onchainosToken.advancedInfo(tokenAddress);
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

    // 7. Liquidity check
    const liqResult = onchainosToken.liquidity(tokenAddress);
    const liqData = (liqResult.success ? liqResult.data : null) as Record<string, unknown> | null;
    let liquidityUsd = Number(
      liqData && typeof liqData === "object"
        ? (liqData as Record<string, unknown>).tvlUsd ??
            (liqData as Record<string, unknown>).liquidityUsd ??
            0
        : Array.isArray(liqData)
          ? (liqData as Array<Record<string, unknown>>).reduce(
              (sum, p) => sum + Number(p.tvlUsd ?? 0),
              0,
            )
          : 0,
    );

    // Uniswap v3 pool check
    let hasUniPool = false;
    try {
      const usdt = config.contracts.usdt as Address;
      const poolAddr = await getPool(
        this.publicClient,
        tokenAddress as Address,
        usdt,
        3000,
      );
      if (poolAddr && poolAddr !== ZERO_ADDRESS) {
        hasUniPool = true;
        const poolInfo = await getPoolInfo(this.publicClient, poolAddr);
        const poolLiq = Number(poolInfo.liquidity);
        if (poolLiq > liquidityUsd) liquidityUsd = poolLiq;
      }
    } catch {
      // Uniswap pool not available
    }

    // 8. Risk scoring
    const risks: string[] = [];
    let riskScore = 0;

    const isHoneypot =
      securityScan?.isHoneypot === true ||
      securityScan?.isHoneypot === "1";
    if (isHoneypot) {
      risks.push("honeypot");
      riskScore += 50;
    }

    const hasRug =
      devData?.rugHistory === true ||
      devData?.hasRug === true ||
      (Array.isArray(devData?.rugs) && (devData.rugs as unknown[]).length > 0);
    if (hasRug) {
      risks.push("rug_history");
      riskScore += 40;
    }

    const hasMint =
      securityScan?.isMintable === true ||
      securityScan?.isMintable === "1";
    if (hasMint) {
      risks.push("mint");
      riskScore += 20;
    }

    const isProxy =
      securityScan?.isProxy === true ||
      securityScan?.isProxy === "1" ||
      proxiableUUID !== null;
    if (isProxy) {
      risks.push("proxy");
      riskScore += 15;
    }

    const buyTax = Number(securityScan?.buyTax ?? 0);
    const sellTax = Number(securityScan?.sellTax ?? 0);
    if (buyTax > 5 || sellTax > 5) {
      risks.push("high_tax");
      riskScore += 15;
    }

    const holderConcentration = Number(
      advData?.topHolderPercent ??
        advData?.holderConcentration ??
        0,
    );
    if (holderConcentration > 70) {
      risks.push("concentrated_holders");
      riskScore += 10;
    }

    riskScore = Math.min(riskScore, 100);

    // 9. Classify verdict
    const verdictLabel = classifyVerdict(riskScore);

    const tokenName = String(
      priceData?.name ?? name ?? advData?.name ?? "Unknown",
    );
    const tokenSymbol = String(
      priceData?.symbol ?? symbol ?? advData?.symbol ?? "???",
    );

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
