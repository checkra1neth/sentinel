import { type Address, createPublicClient, http } from "viem";
import { BaseAgent, type ReinvestConfig } from "./base-agent.js";
import { okxWeb3Get } from "../lib/okx-api.js";

const xlayer = createPublicClient({ transport: http("https://rpc.xlayer.tech") });

const inspectAbi = [
  { name: "owner", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { name: "paused", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "bool" }] },
  { name: "name", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { name: "symbol", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { name: "decimals", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
  { name: "totalSupply", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { name: "proxiableUUID", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "bytes32" }] },
] as const;

async function safeCall<T>(fn: () => Promise<T>): Promise<T | null> {
  try { return await fn(); } catch { return null; }
}

export class AuditorAgent extends BaseAgent {
  constructor(walletAddress: Address, reinvestConfig?: ReinvestConfig) {
    super("auditor", walletAddress, reinvestConfig);
  }

  async execute(action: string, params: Record<string, unknown>): Promise<unknown> {
    if (action !== "quick-scan") throw new Error(`Unknown action: ${action}`);

    const contract = (params.contract as Address) ?? "0x0";
    this.log(`Security scan on ${contract}`);

    // 1. Check bytecode
    const code = await safeCall(() => xlayer.getCode({ address: contract }));
    const isContract = !!code && code !== "0x";
    const bytecodeSize = code ? (code.length - 2) / 2 : 0;

    if (!isContract) {
      return {
        agent: "Auditor Agent",
        chain: "X Layer (196)",
        contract,
        isContract: false,
        verdict: "NOT A CONTRACT",
        detail: "This address is an EOA (externally owned account), not a smart contract.",
        dataSource: "X Layer RPC (live)",
        timestamp: new Date().toISOString(),
      };
    }

    // 2. Probe contract interface
    const [owner, paused, name, symbol, decimals, totalSupply, proxiableUUID] = await Promise.all([
      safeCall(() => xlayer.readContract({ address: contract, abi: inspectAbi, functionName: "owner" })),
      safeCall(() => xlayer.readContract({ address: contract, abi: inspectAbi, functionName: "paused" })),
      safeCall(() => xlayer.readContract({ address: contract, abi: inspectAbi, functionName: "name" })),
      safeCall(() => xlayer.readContract({ address: contract, abi: inspectAbi, functionName: "symbol" })),
      safeCall(() => xlayer.readContract({ address: contract, abi: inspectAbi, functionName: "decimals" })),
      safeCall(() => xlayer.readContract({ address: contract, abi: inspectAbi, functionName: "totalSupply" })),
      safeCall(() => xlayer.readContract({ address: contract, abi: inspectAbi, functionName: "proxiableUUID" })),
    ]);

    const isERC20 = symbol !== null && decimals !== null && totalSupply !== null;
    const isUUPS = proxiableUUID !== null;

    // 3. OKX Security API
    let security: Record<string, unknown> | null = null;
    try {
      const data = await okxWeb3Get(
        `/api/v5/dex/pre-transaction/token-security?chainIndex=196&tokenContractAddress=${contract}`
      ) as { data?: Array<Record<string, unknown>> };
      security = (data.data ?? [])[0] ?? null;
    } catch { /* unavailable */ }

    // 4. Compile issues
    const issues: Array<{ severity: string; title: string; detail: string }> = [];

    if (owner) {
      issues.push({ severity: "MEDIUM", title: "Centralized ownership", detail: `Owner: ${owner}` });
    }
    if (paused === true) {
      issues.push({ severity: "HIGH", title: "Contract is PAUSED", detail: "All operations may be halted" });
    }
    if (isUUPS) {
      issues.push({ severity: "INFO", title: "UUPS Proxy", detail: "Contract is upgradeable — implementation can be changed by owner" });
    }
    if (bytecodeSize > 24576) {
      issues.push({ severity: "LOW", title: "Large bytecode", detail: `${bytecodeSize} bytes — may hit deployment limits on some chains` });
    }

    if (security) {
      if (security.isHoneypot === "1") issues.push({ severity: "CRITICAL", title: "Honeypot", detail: "Cannot sell after buying" });
      if (security.isMintable === "1") issues.push({ severity: "MEDIUM", title: "Mintable", detail: "Supply can be inflated" });
      if (security.buyTax && Number(security.buyTax) > 0) issues.push({ severity: "LOW", title: "Buy tax", detail: `${security.buyTax}%` });
      if (security.sellTax && Number(security.sellTax) > 0) issues.push({ severity: "LOW", title: "Sell tax", detail: `${security.sellTax}%` });
      if (security.isOpenSource === "0") issues.push({ severity: "MEDIUM", title: "Unverified source", detail: "Code not verified on explorer" });
    }

    const riskScore = issues.reduce((s, i) => {
      if (i.severity === "CRITICAL") return s + 40;
      if (i.severity === "HIGH") return s + 25;
      if (i.severity === "MEDIUM") return s + 10;
      if (i.severity === "LOW") return s + 5;
      return s;
    }, 0);

    return {
      agent: "Auditor Agent",
      chain: "X Layer (196)",
      contract,
      isContract: true,
      bytecodeSize,
      contractType: isERC20 ? "ERC-20 Token" : isUUPS ? "UUPS Proxy" : "Smart Contract",
      identity: {
        name: name ?? undefined,
        symbol: symbol ?? undefined,
        decimals: decimals !== null ? Number(decimals) : undefined,
        totalSupply: totalSupply?.toString() ?? undefined,
        owner: owner ?? "none",
        paused: paused ?? undefined,
        upgradeable: isUUPS,
      },
      securityScan: {
        riskScore: Math.min(riskScore, 100),
        issueCount: issues.length,
        issues,
      },
      verdict: riskScore === 0 ? "CLEAN" : riskScore >= 40 ? "DANGEROUS" : riskScore >= 20 ? "CAUTION" : "LOW RISK",
      dataSource: "X Layer RPC + OKX Security API (live)",
      timestamp: new Date().toISOString(),
    };
  }
}
