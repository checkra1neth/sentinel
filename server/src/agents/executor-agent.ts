import { type Address, createPublicClient, http } from "viem";
import { BaseAgent, type ReinvestConfig } from "./base-agent.js";
import { type AgenticWallet } from "../wallet/agentic-wallet.js";
import {
  onchainosDefi,
  onchainosSwap,
} from "../lib/onchainos.js";
import { config } from "../config.js";
import { settings } from "../settings.js";
import { getQuote as getUniswapQuote } from "../lib/uniswap-trading.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LpPosition {
  token: string;
  tokenSymbol: string;
  poolName: string;
  platformName: string;
  investmentId: number;
  amountInvested: string;
  apr: string;
  tvl: string;
  range: number;
  timestamp: number;
  entryPrice?: number;
}

export interface InvestResult {
  success: boolean;
  method: "defi_lp" | "swap";
  token: string;
  amount: string;
  investmentId?: number;
  poolName?: string;
  apr?: string;
  txHash?: string;
  error?: string;
}

export interface PortfolioResult {
  positions: LpPosition[];
  totalInvested: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_INVEST_AMOUNT = "10"; // 10 USDT

// Risk score → LP range percentage (lower risk = wider range = more LP exposure)
function riskScoreToRange(riskScore: number): number {
  if (riskScore <= 5) return 20;   // Very safe → wide ±20% range
  if (riskScore <= 10) return 10;  // Safe → ±10% range
  if (riskScore <= 15) return 5;   // Borderline → tight ±5% range
  return 3;                        // Anything above → very tight ±3%
}

// ---------------------------------------------------------------------------
// Agent
// ---------------------------------------------------------------------------

export class ExecutorAgent extends BaseAgent {
  lpPositions: LpPosition[] = [];
  private readonly publicClient;

  constructor(wallet: AgenticWallet, reinvestConfig?: ReinvestConfig) {
    super("Executor", wallet, reinvestConfig);
    this.publicClient = createPublicClient({
      transport: http(config.xlayerRpcUrl),
    });
  }

  async execute(
    action: string,
    params: Record<string, unknown> = {},
  ): Promise<unknown> {
    switch (action) {
      case "invest":
        return this.invest(
          params.token as string,
          params.tokenSymbol as string | undefined,
          params.riskScore as number | undefined,
          params.amount as string | undefined,
        );
      case "portfolio":
        return this.getPortfolio();
      case "preview":
        return this.previewInvestment(
          params.token as string,
          params.amount as string | undefined,
        );
      case "exit":
        return this.exitPosition(
          params.investmentId as number,
          params.ratio as string | undefined,
        );
      case "collect":
        return this.collectFees();
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  }

  // -------------------------------------------------------------------------
  // Investment flow — DeFi LP first, swap fallback
  // -------------------------------------------------------------------------

  private async invest(
    token: string,
    tokenSymbol?: string,
    riskScore?: number,
    amount?: string,
  ): Promise<InvestResult> {
    const investAmount = amount ?? DEFAULT_INVEST_AMOUNT;
    const range = riskScoreToRange(riskScore ?? 10);
    const sym = tokenSymbol ?? token.slice(0, 8);

    this.log(`Investing ${investAmount} USDT into ${sym} (risk ${riskScore ?? "?"}, range ±${range}%)`);

    // 1. Search for DEX pool via OKX DeFi
    try {
      const searchResult = onchainosDefi.search(sym, config.chainId, "DEX_POOL");
      if (searchResult.success && searchResult.data) {
        const searchData = searchResult.data as Record<string, unknown>;
        const list = (searchData.list ?? searchData) as Array<Record<string, unknown>>;

        if (Array.isArray(list) && list.length > 0) {
          // Pick the best pool — highest TVL
          const sorted = [...list].sort(
            (a, b) => Number(b.tvl ?? 0) - Number(a.tvl ?? 0),
          );
          const pool = sorted[0];
          const investmentId = Number(pool.investmentId);
          const poolName = String(pool.name ?? "");
          const platformName = String(pool.platformName ?? "");
          const apr = String(pool.rate ?? "0");
          const tvl = String(pool.tvl ?? "0");

          this.log(`Found pool: ${poolName} on ${platformName} (APR ${(Number(apr) * 100).toFixed(1)}%, TVL $${Number(tvl).toLocaleString()})`);

          // 2. Get pool preparation info (accepted tokens, ticks)
          const prepResult = onchainosDefi.prepare(investmentId);
          const prepData = prepResult.success ? prepResult.data as Record<string, unknown> : null;

          // Build user-input JSON from pool's investWithTokenList
          const tokenList = (prepData?.investWithTokenList ?? []) as Array<Record<string, string>>;
          const inputToken = tokenList.find((t) => t.tokenAddress?.toLowerCase() === config.contracts.usdt.toLowerCase()) ?? tokenList[0];
          const tokenPrecision = inputToken?.tokenPrecision ?? "6";
          const coinAmount = String(Math.floor(Number(investAmount) * Math.pow(10, Number(tokenPrecision))));

          const userInput = JSON.stringify([{
            tokenAddress: inputToken?.tokenAddress ?? config.contracts.usdt,
            chainIndex: String(config.chainId),
            coinAmount,
            tokenPrecision,
          }]);

          // Calculate tick range based on risk
          const currentTick = Number(prepData?.currentTick ?? 0);
          const tickSpacing = Number(prepData?.tickSpacing ?? 60);
          const tickRange = Math.max(Math.round((range / 100) * 10000 / tickSpacing) * tickSpacing, tickSpacing);
          const tickLower = currentTick - tickRange;
          const tickUpper = currentTick + tickRange;

          // 3. Deposit via DeFi skill
          const investResult = onchainosDefi.deposit(
            investmentId,
            this.walletAddress,
            userInput,
            "0.01",
            tickLower,
            tickUpper,
          );

          if (investResult.success) {
            const data = investResult.data as Record<string, unknown> | null;
            const txHash = String(data?.txHash ?? data?.hash ?? "");

            const position: LpPosition = {
              token,
              tokenSymbol: sym,
              poolName,
              platformName,
              investmentId,
              amountInvested: investAmount,
              apr,
              tvl,
              range,
              timestamp: Date.now(),
            };
            this.lpPositions.push(position);

            this.emit({
              timestamp: Date.now(),
              agent: this.name,
              type: "invest",
              message: `LP ${poolName} on ${platformName}: ${investAmount} USDT (±${range}% range, APR ${(Number(apr) * 100).toFixed(1)}%)`,
              details: {
                token,
                amount: investAmount,
                method: "defi_lp",
                pool: poolName,
                platform: platformName,
                apr,
                range,
                investmentId,
              },
            });

            return {
              success: true,
              method: "defi_lp",
              token,
              amount: investAmount,
              investmentId,
              poolName,
              apr,
              txHash,
            };
          }

          this.log(`DeFi invest failed, falling back to swap`);
        }
      }
    } catch (err) {
      this.log(
        `DeFi search/invest failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    // 3. Fallback: simple swap USDT → token via OKX DEX aggregator
    try {
      const swapResult = onchainosSwap.execute(
        config.contracts.usdt,
        token,
        investAmount,
        this.walletAddress,
        config.chainId,
      );

      if (swapResult.success) {
        const data = swapResult.data as Record<string, unknown> | null;
        const txHash = String(data?.txHash ?? data?.hash ?? "");

        const position: LpPosition = {
          token,
          tokenSymbol: sym,
          poolName: `USDT→${sym}`,
          platformName: "OKX DEX",
          investmentId: 0,
          amountInvested: investAmount,
          apr: "0",
          tvl: "0",
          range: 0,
          timestamp: Date.now(),
        };
        this.lpPositions.push(position);

        this.emit({
          timestamp: Date.now(),
          agent: this.name,
          type: "invest",
          message: `Swap ${investAmount} USDT → ${sym} via OKX DEX`,
          details: {
            token,
            amount: investAmount,
            method: "swap",
          },
        });

        return {
          success: true,
          method: "swap",
          token,
          amount: investAmount,
          txHash,
        };
      }

      return {
        success: false,
        method: "swap",
        token,
        amount: investAmount,
        error: "Swap returned failure",
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.log(`Swap failed: ${errorMsg}`);
      return {
        success: false,
        method: "swap",
        token,
        amount: investAmount,
        error: errorMsg,
      };
    }
  }

  // -------------------------------------------------------------------------
  // Preview — dry-run investment analysis
  // -------------------------------------------------------------------------

  async previewInvestment(
    tokenSymbol: string,
    amount?: string,
  ): Promise<Record<string, unknown>> {
    const cfg = settings.get().invest;
    const investAmount = amount ?? String(cfg.maxPerPosition);

    const poolSearch = onchainosDefi.search(tokenSymbol, config.chainId, "DEX_POOL");
    const pools: Array<Record<string, unknown>> = [];

    if (poolSearch.success && poolSearch.data) {
      const searchData = poolSearch.data as Record<string, unknown>;
      const list = (searchData.list ?? searchData) as Array<Record<string, unknown>>;
      if (Array.isArray(list)) {
        for (const p of list) {
          pools.push({
            investmentId: p.investmentId,
            name: p.name,
            platform: p.platformName,
            apr: p.rate,
            tvl: p.tvl,
          });
        }
      }
    }

    pools.sort((a, b) => Number(b.tvl ?? 0) - Number(a.tvl ?? 0));

    let swapQuote: Record<string, unknown> | null = null;
    try {
      const quoteResult = onchainosSwap.quote(
        config.contracts.usdt,
        tokenSymbol,
        investAmount,
        config.chainId,
      );
      if (quoteResult.success && quoteResult.data) {
        swapQuote = quoteResult.data as Record<string, unknown>;
      }
    } catch { /* quote unavailable */ }

    let uniswapQuote: Record<string, unknown> | null = null;
    try {
      const uniResult = await getUniswapQuote({
        tokenIn: config.contracts.usdt,
        tokenOut: tokenSymbol,
        tokenInChainId: config.chainId,
        tokenOutChainId: config.chainId,
        amount: String(Number(investAmount) * 1e6),
        type: "EXACT_INPUT",
        swapper: this.walletAddress,
      });
      if (uniResult) {
        uniswapQuote = {
          amountOut: uniResult.amountDecimals,
          route: uniResult.routeString,
          gasPriceWei: uniResult.gasPriceWei,
        };
      }
    } catch { /* Uniswap Trading API unavailable */ }

    return {
      token: tokenSymbol,
      amount: investAmount,
      strategy: cfg.strategy,
      pools,
      bestPool: pools[0] ?? null,
      swapQuote,
      uniswapQuote,
    };
  }

  // -------------------------------------------------------------------------
  // Exit — withdraw from LP position
  // -------------------------------------------------------------------------

  async exitPosition(
    investmentId: number,
    ratio: string = "1",
  ): Promise<Record<string, unknown>> {
    this.log(`Exiting position ${investmentId} (ratio: ${ratio})`);

    const result = onchainosDefi.redeem(investmentId, this.walletAddress, ratio, config.chainId);

    if (result.success) {
      if (ratio === "1") {
        this.lpPositions = this.lpPositions.filter(
          (p) => p.investmentId !== investmentId,
        );
      }

      this.emit({
        timestamp: Date.now(),
        agent: this.name,
        type: "invest",
        message: `Exited position ${investmentId} (${Number(ratio) * 100}%)`,
        details: { investmentId, ratio, data: result.data },
      });

      return { success: true, investmentId, ratio, data: result.data };
    }

    return { success: false, investmentId, error: "Withdraw failed" };
  }

  // -------------------------------------------------------------------------
  // Collect — harvest LP fees and rewards
  // -------------------------------------------------------------------------

  async collectFees(): Promise<Record<string, unknown>> {
    this.log("Collecting LP fees");

    const results: Array<Record<string, unknown>> = [];

    const collectResult = onchainosDefi.claim(this.walletAddress, "V3_FEE", config.chainId);
    if (collectResult.success) {
      results.push({ type: "V3_FEE", success: true, data: collectResult.data });
    }

    const rewardResult = onchainosDefi.claim(this.walletAddress, "REWARD_PLATFORM", config.chainId);
    if (rewardResult.success) {
      results.push({ type: "REWARD_PLATFORM", success: true, data: rewardResult.data });
    }

    this.emit({
      timestamp: Date.now(),
      agent: this.name,
      type: "invest",
      message: `Collected fees: ${results.length} reward types`,
      details: { results },
    });

    return { success: true, collected: results };
  }

  // -------------------------------------------------------------------------
  // Portfolio — local positions + on-chain DeFi positions
  // -------------------------------------------------------------------------

  private getPortfolio(): PortfolioResult {
    // Also check on-chain DeFi positions
    try {
      const posResult = onchainosDefi.positions(this.walletAddress);
      if (posResult.success && posResult.data) {
        this.log(`On-chain positions: ${JSON.stringify(posResult.data).slice(0, 200)}`);
      }
    } catch {
      // ignore
    }

    const totalInvested = this.lpPositions.reduce(
      (sum, p) => sum + Number(p.amountInvested),
      0,
    );

    return {
      positions: [...this.lpPositions],
      totalInvested,
    };
  }

  // -------------------------------------------------------------------------
  // Service buying — executor does not buy services
  // -------------------------------------------------------------------------

  override shouldBuyService(_type: string): boolean {
    return false;
  }
}
