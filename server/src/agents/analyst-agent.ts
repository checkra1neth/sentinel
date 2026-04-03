import { type Address, createPublicClient, http, formatUnits } from "viem";
import { BaseAgent, type ReinvestConfig } from "./base-agent.js";
import { okxWeb3Get } from "../lib/okx-api.js";

const xlayer = createPublicClient({ transport: http("https://rpc.xlayer.tech") });

const erc20Abi = [
  { name: "name", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { name: "symbol", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { name: "decimals", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
  { name: "totalSupply", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { name: "owner", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { name: "balanceOf", type: "function", stateMutability: "view", inputs: [{ name: "account", type: "address" }], outputs: [{ type: "uint256" }] },
] as const;

async function safeCall<T>(fn: () => Promise<T>): Promise<T | null> {
  try { return await fn(); } catch { return null; }
}

export class AnalystAgent extends BaseAgent {
  constructor(walletAddress: Address, reinvestConfig?: ReinvestConfig) {
    super("analyst", walletAddress, reinvestConfig);
  }

  async execute(action: string, params: Record<string, unknown>): Promise<unknown> {
    if (action !== "token-report") throw new Error(`Unknown action: ${action}`);

    const token = (params.token as Address) ?? "0x0";
    this.log(`Generating report for ${token}`);

    // 1. Read on-chain data directly from X Layer RPC
    const [name, symbol, decimals, totalSupply, owner, code] = await Promise.all([
      safeCall(() => xlayer.readContract({ address: token, abi: erc20Abi, functionName: "name" })),
      safeCall(() => xlayer.readContract({ address: token, abi: erc20Abi, functionName: "symbol" })),
      safeCall(() => xlayer.readContract({ address: token, abi: erc20Abi, functionName: "decimals" })),
      safeCall(() => xlayer.readContract({ address: token, abi: erc20Abi, functionName: "totalSupply" })),
      safeCall(() => xlayer.readContract({ address: token, abi: erc20Abi, functionName: "owner" })),
      safeCall(() => xlayer.getCode({ address: token })),
    ]);

    const isContract = !!code && code !== "0x";
    const bytecodeSize = code ? (code.length - 2) / 2 : 0;

    // 2. Try OKX security scan
    let security: Record<string, unknown> | null = null;
    try {
      const data = await okxWeb3Get(
        `/api/v5/dex/pre-transaction/token-security?chainIndex=196&tokenContractAddress=${token}`
      ) as { data?: Array<Record<string, unknown>> };
      security = (data.data ?? [])[0] ?? null;
    } catch { /* unavailable */ }

    // 3. Try OKX swap quote for price
    let priceUsdt: string | null = null;
    if (decimals !== null) {
      try {
        const amount = BigInt(10 ** Number(decimals));
        const data = await okxWeb3Get(
          `/api/v5/dex/aggregator/quote?chainIndex=196&fromTokenAddress=${token}&toTokenAddress=0x1E4a5963aBFD975d8c9021ce480b42188849D41d&amount=${amount}&slippagePercentage=1`
        ) as { data?: Array<{ toTokenAmount?: string }> };
        if (data.data?.[0]?.toTokenAmount) {
          priceUsdt = "$" + (Number(data.data[0].toTokenAmount) / 1e6).toFixed(6);
        }
      } catch { /* no liquidity */ }
    }

    // 4. Risk assessment
    const risks: string[] = [];
    if (!isContract) risks.push("Not a contract (EOA address)");
    if (owner) risks.push(`Has owner: ${owner} (centralization risk)`);
    if (security?.isHoneypot === "1") risks.push("HONEYPOT DETECTED");
    if (security?.isMintable === "1") risks.push("Mintable — supply can be inflated");
    if (security?.isProxy === "1") risks.push("Proxy — implementation can change");
    if (security?.buyTax && Number(security.buyTax) > 0) risks.push(`Buy tax: ${security.buyTax}%`);
    if (security?.sellTax && Number(security.sellTax) > 0) risks.push(`Sell tax: ${security.sellTax}%`);
    if (security?.isOpenSource === "0") risks.push("Source code not verified");

    const riskScore = risks.filter(r => r.includes("HONEYPOT")).length * 50
      + risks.filter(r => r.includes("owner") || r.includes("Mintable") || r.includes("Proxy")).length * 15
      + risks.filter(r => r.includes("tax")).length * 10;

    return {
      agent: "Analyst Agent",
      chain: "X Layer (196)",
      token,
      onChainData: {
        name: name ?? "N/A",
        symbol: symbol ?? "N/A",
        decimals: decimals !== null ? Number(decimals) : "N/A",
        totalSupply: totalSupply !== null && decimals !== null
          ? formatUnits(totalSupply, Number(decimals))
          : "N/A",
        owner: owner ?? "none (renounced or no owner function)",
        isContract,
        bytecodeSize,
      },
      price: priceUsdt ?? "No DEX liquidity found",
      securityScan: {
        riskScore: Math.min(riskScore, 100),
        risks: risks.length > 0 ? risks : ["No risks detected"],
      },
      recommendation: riskScore > 50 ? "AVOID" : riskScore > 20 ? "CAUTION" : "LOW RISK",
      dataSource: "X Layer RPC + OKX Onchain OS API (live)",
      timestamp: new Date().toISOString(),
    };
  }

  override shouldBuyService(type: string): boolean {
    return type === "auditor";
  }
}
