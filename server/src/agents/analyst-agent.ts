import { type Address } from "viem";
import { BaseAgent, type ReinvestConfig } from "./base-agent.js";
import { okxWeb3Get } from "../lib/okx-api.js";

export class AnalystAgent extends BaseAgent {
  constructor(walletAddress: Address, reinvestConfig?: ReinvestConfig) {
    super("analyst", walletAddress, reinvestConfig);
  }

  async execute(action: string, params: Record<string, unknown>): Promise<unknown> {
    if (action !== "token-report") {
      throw new Error(`Unknown action: ${action}`);
    }

    const token = (params.token as string) ?? "";
    this.log(`Generating real token report for ${token}`);

    // Fetch real token data from OKX DEX API
    const [tokenData, securityData] = await Promise.allSettled([
      okxWeb3Get(`/api/v5/dex/aggregator/all-tokens?chainIndex=196`),
      okxWeb3Get(`/api/v5/dex/pre-transaction/token-security?chainIndex=196&tokenContractAddress=${token}`),
    ]);

    // Parse token list to find our token
    let tokenInfo: Record<string, unknown> | null = null;
    if (tokenData.status === "fulfilled") {
      const data = tokenData.value as { data?: Array<{ tokenContractAddress?: string; tokenSymbol?: string; decimals?: string }> };
      const tokens = data.data ?? [];
      tokenInfo = tokens.find(
        (t) => t.tokenContractAddress?.toLowerCase() === token.toLowerCase()
      ) as Record<string, unknown> | undefined ?? null;
    }

    // Parse security data
    let security: Record<string, unknown> | null = null;
    if (securityData.status === "fulfilled") {
      const data = securityData.value as { data?: Array<Record<string, unknown>> };
      security = (data.data ?? [])[0] ?? null;
    }

    // Fetch price from market API
    let price: string | null = null;
    try {
      const priceData = await okxWeb3Get(
        `/api/v5/dex/aggregator/quote?chainIndex=196&fromTokenAddress=${token}&toTokenAddress=0x1E4a5963aBFD975d8c9021ce480b42188849D41d&amount=1000000000000000000&slippagePercentage=0.01`
      ) as { data?: Array<{ toTokenAmount?: string }> };
      if (priceData.data?.[0]?.toTokenAmount) {
        price = (Number(priceData.data[0].toTokenAmount) / 1e6).toFixed(4) + " USDT";
      }
    } catch { /* price unavailable */ }

    // Determine risk score based on security data
    let riskScore = 0;
    const risks: string[] = [];
    if (security) {
      if (security.isAirdropScam === "1") { riskScore += 30; risks.push("Airdrop scam detected"); }
      if (security.isProxy === "1") { riskScore += 10; risks.push("Proxy contract"); }
      if (security.isMintable === "1") { riskScore += 15; risks.push("Mintable token"); }
      if (security.isHoneypot === "1") { riskScore += 50; risks.push("Honeypot detected"); }
      if (security.buyTax && Number(security.buyTax) > 5) { riskScore += 20; risks.push(`High buy tax: ${security.buyTax}%`); }
      if (security.sellTax && Number(security.sellTax) > 5) { riskScore += 20; risks.push(`High sell tax: ${security.sellTax}%`); }
    }

    return {
      agent: "Analyst Agent",
      chain: "X Layer (196)",
      token,
      symbol: tokenInfo?.tokenSymbol ?? "Unknown",
      decimals: tokenInfo?.decimals ?? "Unknown",
      price,
      securityScan: {
        riskScore: Math.min(riskScore, 100),
        risks: risks.length > 0 ? risks : ["No risks detected"],
        isProxy: security?.isProxy ?? "unknown",
        isMintable: security?.isMintable ?? "unknown",
        isHoneypot: security?.isHoneypot ?? "unknown",
      },
      recommendation: riskScore > 50 ? "AVOID" : riskScore > 20 ? "CAUTION" : "LOW RISK",
      dataSource: "OKX Onchain OS API (live)",
      timestamp: new Date().toISOString(),
    };
  }

  override shouldBuyService(type: string): boolean {
    return type === "auditor";
  }
}
