import { type Address } from "viem";
import { BaseAgent, type ReinvestConfig } from "./base-agent.js";
import { type TokenReport } from "../types.js";

export class AnalystAgent extends BaseAgent {
  constructor(
    walletAddress: Address,
    reinvestConfig?: ReinvestConfig,
  ) {
    super("analyst", walletAddress, reinvestConfig);
  }

  async execute(
    action: string,
    params: Record<string, unknown>,
  ): Promise<TokenReport> {
    if (action !== "token-report") {
      throw new Error(`Unknown action: ${action}`);
    }

    const token = (params.token as string) ?? "UNKNOWN";

    this.log(`Generating token report for ${token}`);

    return {
      token,
      riskScore: Math.round(Math.random() * 100),
      marketCap: Math.round(Math.random() * 1_000_000_000),
      volume24h: Math.round(Math.random() * 50_000_000),
      recommendation: Math.random() > 0.5 ? "BUY" : "HOLD",
    };
  }

  override shouldBuyService(type: string): boolean {
    return type === "auditor";
  }
}
