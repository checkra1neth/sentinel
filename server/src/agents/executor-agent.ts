import { type Address, createPublicClient, http } from "viem";
import { BaseAgent, type ReinvestConfig } from "./base-agent.js";
import { type AgenticWallet } from "../wallet/agentic-wallet.js";
import {
  onchainosDefi,
  onchainosSwap,
} from "../lib/onchainos.js";
import { config } from "../config.js";
import { settings } from "../settings.js";

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

          // 2. Invest via DeFi skill with risk-based range
          const investResult = onchainosDefi.invest(
            investmentId,
            this.walletAddress,
            config.contracts.usdt,
            investAmount,
            config.chainId,
            range,
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

    return {
      token: tokenSymbol,
      amount: investAmount,
      strategy: cfg.strategy,
      pools,
      bestPool: pools[0] ?? null,
      swapQuote,
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

    const result = onchainosDefi.withdraw(investmentId, this.walletAddress, config.chainId, ratio);

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

    const collectResult = onchainosDefi.collect(this.walletAddress, config.chainId, "V3_FEE");
    if (collectResult.success) {
      results.push({ type: "V3_FEE", success: true, data: collectResult.data });
    }

    const rewardResult = onchainosDefi.collect(this.walletAddress, config.chainId, "REWARD_PLATFORM");
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
