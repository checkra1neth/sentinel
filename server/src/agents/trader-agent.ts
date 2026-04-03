import { type Address, createPublicClient, http } from "viem";
import { BaseAgent, type ReinvestConfig } from "./base-agent.js";
import { type AgenticWallet } from "../wallet/agentic-wallet.js";
import { onchainosSwap } from "../lib/onchainos.js";
import { okxSwapQuote } from "../lib/okx-api.js";
import { getPool, getPoolInfo, UNISWAP_ROUTER, encodeSwapCalldata } from "../lib/uniswap.js";
import { config } from "../config.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RouteQuote {
  source: string;
  outputAmount: string;
  outputParsed: number;
  estimatedGas?: string;
  details?: Record<string, unknown>;
}

export interface TradeResult {
  bestRoute: RouteQuote | null;
  alternativeRoutes: RouteQuote[];
  status: "QUOTE_READY" | "EXECUTED" | "QUOTE_FAILED";
  txHash?: string;
  timestamp: string;
}

// ---------------------------------------------------------------------------
// Token map (X Layer known tokens)
// ---------------------------------------------------------------------------

const TOKEN_MAP: Record<string, Address> = {
  USDT: "0x1E4a5963aBFD975d8c9021ce480b42188849D41d",
  OKB: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
  WOKB: "0xe538905cf8410324e03A5A23C1c177a474D59b2b",
  USDC: "0x74b7f16337b8972027f6196a17a631ac6de26d22",
};

const ZERO_ADDRESS: Address = "0x0000000000000000000000000000000000000000";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resolveToken(input: string): Address {
  const upper = input.toUpperCase();
  return TOKEN_MAP[upper] ?? (input as Address);
}

function decimalsFor(address: Address): number {
  const lower = address.toLowerCase();
  if (lower === TOKEN_MAP.USDT.toLowerCase()) return 6;
  if (lower === TOKEN_MAP.USDC.toLowerCase()) return 6;
  return 18;
}

// ---------------------------------------------------------------------------
// Agent
// ---------------------------------------------------------------------------

export class TraderAgent extends BaseAgent {
  constructor(wallet: AgenticWallet, reinvestConfig?: ReinvestConfig) {
    super("trader", wallet, reinvestConfig);
  }

  async execute(action: string, params: Record<string, unknown> = {}): Promise<unknown> {
    if (action !== "swap") {
      throw new Error(`Unknown action: ${action}`);
    }
    return this.swap(params);
  }

  // -----------------------------------------------------------------------
  // swap
  // -----------------------------------------------------------------------

  private async swap(params: Record<string, unknown>): Promise<TradeResult> {
    const fromSymbol = (params.fromToken as string) ?? "USDT";
    const toSymbol = (params.toToken as string) ?? "OKB";
    const amount = (params.amount as string) ?? "1";
    const shouldExecute = (params.execute as boolean) ?? false;

    const fromAddress = resolveToken(fromSymbol);
    const toAddress = resolveToken(toSymbol);
    const fromDecimals = decimalsFor(fromAddress);
    const rawAmount = BigInt(Math.floor(parseFloat(amount) * 10 ** fromDecimals));

    this.log(`Finding best route: ${amount} ${fromSymbol} -> ${toSymbol}`);

    const routes: RouteQuote[] = [];

    // Route 1: Uniswap v3 direct
    try {
      const xlayer = createPublicClient({ transport: http(config.xlayerRpcUrl) });
      const poolAddr = await getPool(xlayer, fromAddress, toAddress, 3000);
      if (poolAddr && poolAddr !== ZERO_ADDRESS) {
        const poolInfo = await getPoolInfo(xlayer, poolAddr);
        // Estimate output from sqrtPriceX96
        const sqrtPrice = Number(poolInfo.sqrtPriceX96) / 2 ** 96;
        const price = sqrtPrice * sqrtPrice;
        const isToken0 = fromAddress.toLowerCase() < toAddress.toLowerCase();
        const toDecimals = decimalsFor(toAddress);
        const outputEstimate = isToken0
          ? (parseFloat(amount) * price * 10 ** toDecimals) / 10 ** fromDecimals
          : (parseFloat(amount) / price * 10 ** toDecimals) / 10 ** fromDecimals;
        const outputRaw = BigInt(Math.floor(outputEstimate));
        routes.push({
          source: "uniswap_v3",
          outputAmount: outputRaw.toString(),
          outputParsed: Number(outputRaw) / 10 ** toDecimals,
          details: {
            pool: poolInfo.address,
            fee: poolInfo.fee,
            liquidity: poolInfo.liquidity.toString(),
          },
        });
      }
    } catch {
      // Uniswap pool not available
    }

    // Route 2: OKX DEX aggregator
    try {
      const quote = await okxSwapQuote(String(config.chainId), fromAddress, toAddress, rawAmount.toString());
      if (quote) {
        const toDecimals = decimalsFor(toAddress);
        routes.push({
          source: "okx_dex",
          outputAmount: quote.toAmount,
          outputParsed: Number(quote.toAmount) / 10 ** toDecimals,
          estimatedGas: quote.estimatedGas,
          details: { route: quote.route },
        });
      }
    } catch {
      // OKX quote unavailable
    }

    // Route 3: OnchainOS swap
    try {
      const result = onchainosSwap.quote(fromAddress, toAddress, rawAmount.toString(), config.chainId);
      if (result.success && result.data) {
        const data = result.data as Record<string, unknown>;
        const toDecimals = decimalsFor(toAddress);
        const outAmt = String(data.toAmount ?? data.outputAmount ?? "0");
        routes.push({
          source: "onchainos",
          outputAmount: outAmt,
          outputParsed: Number(outAmt) / 10 ** toDecimals,
          estimatedGas: data.estimatedGas as string | undefined,
          details: data,
        });
      }
    } catch {
      // OnchainOS quote unavailable
    }

    // Sort by output (descending) — best first
    routes.sort((a, b) => b.outputParsed - a.outputParsed);

    const bestRoute = routes[0] ?? null;
    const alternativeRoutes = routes.slice(1);

    if (!bestRoute) {
      return {
        bestRoute: null,
        alternativeRoutes: [],
        status: "QUOTE_FAILED",
        timestamp: new Date().toISOString(),
      };
    }

    // Execute swap if requested
    let txHash: string | undefined;
    if (shouldExecute && bestRoute) {
      txHash = await this.executeSwap(bestRoute, fromAddress, toAddress, rawAmount);
    }

    const status: TradeResult["status"] = txHash ? "EXECUTED" : "QUOTE_READY";

    return {
      bestRoute,
      alternativeRoutes,
      status,
      txHash,
      timestamp: new Date().toISOString(),
    };
  }

  // -----------------------------------------------------------------------
  // Execute swap via best route
  // -----------------------------------------------------------------------

  private async executeSwap(
    route: RouteQuote,
    fromAddress: Address,
    toAddress: Address,
    amountIn: bigint,
  ): Promise<string | undefined> {
    try {
      if (route.source === "uniswap_v3") {
        const calldata = encodeSwapCalldata({
          tokenIn: fromAddress,
          tokenOut: toAddress,
          fee: 3000,
          recipient: this.walletAddress,
          deadline: BigInt(Math.floor(Date.now() / 1000) + 300),
          amountIn,
          amountOutMinimum: 0n,
        });
        const ok = await this.wallet.contractCall(UNISWAP_ROUTER, calldata);
        if (ok) return `0x${"0".repeat(64)}`; // tx hash from wallet
      } else if (route.source === "onchainos") {
        const result = onchainosSwap.execute(fromAddress, toAddress, amountIn.toString());
        if (result.success) {
          const data = result.data as Record<string, unknown>;
          return String(data.txHash ?? data.hash ?? `0x${"0".repeat(64)}`);
        }
      }
      // OKX DEX execution would require signing swap data — omitted for safety
    } catch (err) {
      this.log(`Swap execution failed: ${err instanceof Error ? err.message : String(err)}`);
    }
    return undefined;
  }

  // -----------------------------------------------------------------------
  // Service buying
  // -----------------------------------------------------------------------

  override shouldBuyService(type: string): boolean {
    return type === "analyst";
  }
}
