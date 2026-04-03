import { type Address } from "viem";
import { BaseAgent, type ReinvestConfig } from "./base-agent.js";
import { okxWeb3Get } from "../lib/okx-api.js";

// Known tokens on X Layer
const TOKEN_MAP: Record<string, string> = {
  USDT: "0x1E4a5963aBFD975d8c9021ce480b42188849D41d",
  OKB: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
  WOKB: "0xe538905cf8410324e03A5A23C1c177a474D59b2b",
  USDC: "0x74b7f16337b8972027f6196a17a631ac6de26d22",
};

export class TraderAgent extends BaseAgent {
  constructor(walletAddress: Address, reinvestConfig?: ReinvestConfig) {
    super("trader", walletAddress, reinvestConfig);
  }

  async execute(action: string, params: Record<string, unknown>): Promise<unknown> {
    if (action !== "swap") {
      throw new Error(`Unknown action: ${action}`);
    }

    const fromToken = (params.fromToken as string) ?? "USDT";
    const toToken = (params.toToken as string) ?? "OKB";
    const amount = (params.amount as string) ?? "1";

    this.log(`Getting real swap quote: ${amount} ${fromToken} → ${toToken}`);

    const fromAddress = TOKEN_MAP[fromToken.toUpperCase()] ?? fromToken;
    const toAddress = TOKEN_MAP[toToken.toUpperCase()] ?? toToken;

    // Calculate amount in smallest unit (USDT = 6 decimals, OKB = 18 decimals)
    const isFromUsdt = fromAddress.toLowerCase() === TOKEN_MAP.USDT.toLowerCase();
    const decimals = isFromUsdt ? 6 : 18;
    const rawAmount = BigInt(Math.floor(parseFloat(amount) * (10 ** decimals)));

    // Get real swap quote from OKX DEX aggregator
    let quote: Record<string, unknown> | null = null;
    try {
      const data = await okxWeb3Get(
        `/api/v5/dex/aggregator/quote?chainIndex=196&fromTokenAddress=${fromAddress}&toTokenAddress=${toAddress}&amount=${rawAmount}&slippagePercentage=0.5`
      ) as { data?: Array<Record<string, unknown>> };
      quote = (data.data ?? [])[0] ?? null;
    } catch { /* quote unavailable */ }

    if (!quote) {
      return {
        agent: "Trader Agent",
        chain: "X Layer (196)",
        status: "QUOTE_FAILED",
        fromToken,
        toToken,
        amount,
        error: "Unable to get swap quote. Pair may not have liquidity on X Layer.",
        dataSource: "OKX DEX Aggregator (live)",
        timestamp: new Date().toISOString(),
      };
    }

    // Parse quote response
    const routeInfo = ((quote.dexRouterList ?? quote.route) as Array<Record<string, unknown>> | undefined)?.[0];
    const toTokenInfo = (routeInfo?.toToken ?? quote.toToken) as Record<string, unknown> | undefined;
    const toDecimals = Number(toTokenInfo?.decimal ?? toTokenInfo?.decimals ?? 18);
    const rawToAmount = quote.toTokenAmount as string ?? "0";
    const toAmount = Number(rawToAmount) / (10 ** toDecimals);
    const estimatedGas = quote.estimateGasFee as string ?? "0";

    return {
      agent: "Trader Agent",
      chain: "X Layer (196)",
      status: "QUOTE_READY",
      swap: {
        from: {
          token: fromToken,
          amount,
          address: fromAddress,
        },
        to: {
          token: (quote.toToken as Record<string, unknown>)?.tokenSymbol ?? toToken,
          amount: toAmount.toFixed(6),
          address: toAddress,
        },
        route: quote.dexRouterList ?? [],
        priceImpact: quote.priceImpactPercentage ?? "0",
        estimatedGas,
        slippage: "0.5%",
      },
      note: "Quote only — execute via Agentic Wallet to complete swap",
      dataSource: "OKX DEX Aggregator (live)",
      timestamp: new Date().toISOString(),
    };
  }

  override shouldBuyService(type: string): boolean {
    return type === "analyst";
  }
}
