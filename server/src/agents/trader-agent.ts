import { type Address } from "viem";
import { BaseAgent, type ReinvestConfig } from "./base-agent.js";
import { type SwapResult } from "../types.js";

export class TraderAgent extends BaseAgent {
  constructor(
    walletAddress: Address,
    reinvestConfig?: ReinvestConfig,
  ) {
    super("trader", walletAddress, reinvestConfig);
  }

  async execute(
    action: string,
    params: Record<string, unknown>,
  ): Promise<SwapResult> {
    if (action !== "swap") {
      throw new Error(`Unknown action: ${action}`);
    }

    const fromToken = (params.fromToken as string) ?? "USDT";
    const toToken = (params.toToken as string) ?? "OKB";
    const fromAmount = (params.fromAmount as string) ?? "100";

    this.log(`Swapping ${fromAmount} ${fromToken} -> ${toToken}`);

    const rate = 0.95 + Math.random() * 0.1;
    const toAmount = (parseFloat(fromAmount) * rate).toFixed(6);

    return {
      fromToken,
      toToken,
      fromAmount,
      toAmount,
      txHash: `0x${Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join("")}`,
    };
  }

  override shouldBuyService(type: string): boolean {
    return type === "analyst";
  }
}
