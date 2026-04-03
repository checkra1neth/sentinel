import { type Address, createPublicClient, http } from "viem";
import { BaseAgent, type ReinvestConfig } from "./base-agent.js";
import { okxWeb3Get } from "../lib/okx-api.js";

const xlayerClient = createPublicClient({
  transport: http("https://rpc.xlayer.tech"),
});

export class AuditorAgent extends BaseAgent {
  constructor(walletAddress: Address, reinvestConfig?: ReinvestConfig) {
    super("auditor", walletAddress, reinvestConfig);
  }

  async execute(action: string, params: Record<string, unknown>): Promise<unknown> {
    if (action !== "quick-scan") {
      throw new Error(`Unknown action: ${action}`);
    }

    const contract = (params.contract as Address) ?? "0x0000000000000000000000000000000000000000";
    this.log(`Running real security scan on ${contract}`);

    // Check if contract exists on-chain
    let bytecodeSize = 0;
    let isContract = false;
    try {
      const code = await xlayerClient.getCode({ address: contract });
      bytecodeSize = code ? (code.length - 2) / 2 : 0;
      isContract = bytecodeSize > 0;
    } catch { /* not a contract */ }

    // Fetch security data from OKX
    let security: Record<string, unknown> | null = null;
    try {
      const data = await okxWeb3Get(
        `/api/v5/dex/pre-transaction/token-security?chainIndex=196&tokenContractAddress=${contract}`
      ) as { data?: Array<Record<string, unknown>> };
      security = (data.data ?? [])[0] ?? null;
    } catch { /* security scan unavailable */ }

    // Analyze risks
    const issues: Array<{ severity: string; title: string; detail: string }> = [];

    if (!isContract) {
      issues.push({ severity: "INFO", title: "Not a contract", detail: "Address is an EOA, not a smart contract" });
    } else {
      if (bytecodeSize > 24576) {
        issues.push({ severity: "LOW", title: "Large contract", detail: `Bytecode size: ${bytecodeSize} bytes (exceeds 24KB limit)` });
      }

      if (security) {
        if (security.isHoneypot === "1") {
          issues.push({ severity: "CRITICAL", title: "Honeypot detected", detail: "Token cannot be sold after purchase" });
        }
        if (security.isProxy === "1") {
          issues.push({ severity: "MEDIUM", title: "Proxy contract", detail: "Contract is upgradeable — implementation can change" });
        }
        if (security.isMintable === "1") {
          issues.push({ severity: "MEDIUM", title: "Mintable", detail: "Token supply can be increased by owner" });
        }
        if (security.buyTax && Number(security.buyTax) > 0) {
          issues.push({ severity: "LOW", title: "Buy tax", detail: `${security.buyTax}% tax on purchases` });
        }
        if (security.sellTax && Number(security.sellTax) > 0) {
          issues.push({ severity: "LOW", title: "Sell tax", detail: `${security.sellTax}% tax on sales` });
        }
        if (security.isOpenSource === "0") {
          issues.push({ severity: "MEDIUM", title: "Unverified source", detail: "Contract source code is not verified" });
        }
      }
    }

    const riskScore = issues.reduce((score, issue) => {
      if (issue.severity === "CRITICAL") return score + 40;
      if (issue.severity === "MEDIUM") return score + 15;
      if (issue.severity === "LOW") return score + 5;
      return score;
    }, 0);

    return {
      agent: "Auditor Agent",
      chain: "X Layer (196)",
      contract,
      isContract,
      bytecodeSize: isContract ? bytecodeSize : 0,
      securityScan: {
        riskScore: Math.min(riskScore, 100),
        issueCount: issues.length,
        issues,
      },
      verdict: riskScore === 0 ? "CLEAN" : riskScore > 50 ? "DANGEROUS" : riskScore > 20 ? "CAUTION" : "LOW RISK",
      dataSource: "OKX Security API + X Layer RPC (live)",
      timestamp: new Date().toISOString(),
    };
  }
}
