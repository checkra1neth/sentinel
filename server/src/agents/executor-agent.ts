import { type Address, createPublicClient, http } from "viem";
import { BaseAgent, type ReinvestConfig } from "./base-agent.js";
import { type AgenticWallet } from "../wallet/agentic-wallet.js";
import {
  onchainosToken,
  onchainosDefi,
  onchainosSwap,
} from "../lib/onchainos.js";
import { getPool } from "../lib/uniswap.js";
import { config } from "../config.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LpPosition {
  token: string;
  tokenSymbol: string;
  poolAddress: string;
  amountInvested: string;
  timestamp: number;
}

export interface InvestResult {
  success: boolean;
  method: "defi_lp" | "swap";
  token: string;
  amount: string;
  poolAddress?: string;
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

const ZERO_ADDRESS: Address = "0x0000000000000000000000000000000000000000";
const DEFAULT_INVEST_AMOUNT = "10"; // 10 USDT

// ---------------------------------------------------------------------------
// Agent
// ---------------------------------------------------------------------------

export class ExecutorAgent extends BaseAgent {
  readonly lpPositions: LpPosition[] = [];
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
          params.amount as string | undefined,
        );
      case "portfolio":
        return this.getPortfolio();
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  }

  // -------------------------------------------------------------------------
  // Investment flow
  // -------------------------------------------------------------------------

  private async invest(
    token: string,
    amount?: string,
  ): Promise<InvestResult> {
    const investAmount = amount ?? DEFAULT_INVEST_AMOUNT;
    this.log(`Investing ${investAmount} USDT into ${token}`);

    // 1. Check liquidity
    const liqResult = onchainosToken.liquidity(token, config.chainId);
    const hasLiquidity = liqResult.success && liqResult.data;

    // 2. Check for Uniswap pool
    let uniPoolAddress: string | undefined;
    try {
      const usdt = config.contracts.usdt as Address;
      const poolAddr = await getPool(
        this.publicClient,
        token as Address,
        usdt,
        3000,
      );
      if (poolAddr && poolAddr !== ZERO_ADDRESS) {
        uniPoolAddress = poolAddr;
      }
    } catch {
      // No Uniswap pool
    }

    // 3. Try DeFi LP investment if pool exists
    if (uniPoolAddress || hasLiquidity) {
      try {
        const searchResult = onchainosDefi.search(token, config.chainId);
        if (searchResult.success && searchResult.data) {
          const opportunities = Array.isArray(searchResult.data)
            ? searchResult.data
            : [searchResult.data];
          const lpOpp = (opportunities as Array<Record<string, unknown>>).find(
            (o) =>
              o.type === "lp" ||
              o.type === "liquidity" ||
              o.protocol?.toString().includes("uniswap"),
          );

          if (lpOpp) {
            const protocolId = String(lpOpp.id ?? lpOpp.protocol ?? "");
            const investResult = onchainosDefi.invest(
              protocolId,
              investAmount,
              config.contracts.usdt,
            );

            if (investResult.success) {
              const data = investResult.data as Record<string, unknown>;
              const txHash = String(data.txHash ?? data.hash ?? "");
              const poolAddr = String(
                lpOpp.poolAddress ?? uniPoolAddress ?? "",
              );

              const position: LpPosition = {
                token,
                tokenSymbol: String(lpOpp.symbol ?? lpOpp.tokenSymbol ?? token),
                poolAddress: poolAddr,
                amountInvested: investAmount,
                timestamp: Date.now(),
              };
              this.lpPositions.push(position);

              this.emit({
                timestamp: Date.now(),
                agent: this.name,
                type: "invest",
                message: `LP invested ${investAmount} USDT into ${token}`,
                details: {
                  token,
                  amount: investAmount,
                  method: "defi_lp",
                  pool: poolAddr,
                },
              });

              return {
                success: true,
                method: "defi_lp",
                token,
                amount: investAmount,
                poolAddress: poolAddr,
                txHash,
              };
            }
          }
        }
      } catch (err) {
        this.log(
          `DeFi LP failed, falling back to swap: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    // 4. Fallback: simple swap USDT -> token
    try {
      const swapResult = onchainosSwap.execute(
        config.contracts.usdt,
        token,
        investAmount,
        config.chainId,
      );

      if (swapResult.success) {
        const data = swapResult.data as Record<string, unknown>;
        const txHash = String(data.txHash ?? data.hash ?? "");

        const position: LpPosition = {
          token,
          tokenSymbol: token,
          poolAddress: "",
          amountInvested: investAmount,
          timestamp: Date.now(),
        };
        this.lpPositions.push(position);

        this.emit({
          timestamp: Date.now(),
          agent: this.name,
          type: "invest",
          message: `Swap invested ${investAmount} USDT -> ${token}`,
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
        error: "Swap execution returned failure",
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
  // Portfolio
  // -------------------------------------------------------------------------

  private getPortfolio(): PortfolioResult {
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
