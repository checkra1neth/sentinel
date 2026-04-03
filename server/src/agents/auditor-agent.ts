import { type Address, createPublicClient, http } from "viem";
import { BaseAgent, type ReinvestConfig } from "./base-agent.js";
import { type AgenticWallet } from "../wallet/agentic-wallet.js";
import { onchainosSecurity } from "../lib/onchainos.js";
import { okxTokenSecurity } from "../lib/okx-api.js";
import { config } from "../config.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AuditIssue {
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";
  title: string;
  detail: string;
}

export interface AuditResult {
  contract: string;
  contractType: string;
  bytecodeSize: number;
  riskScore: number;
  verdict: "CLEAN" | "LOW_RISK" | "CAUTION" | "DANGEROUS";
  issues: AuditIssue[];
  securityScan: Record<string, unknown> | null;
  timestamp: string;
}

// ---------------------------------------------------------------------------
// ABI fragments for probing
// ---------------------------------------------------------------------------

const inspectAbi = [
  { name: "owner", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { name: "paused", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "bool" }] },
  { name: "name", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { name: "symbol", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { name: "decimals", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
  { name: "totalSupply", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { name: "proxiableUUID", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "bytes32" }] },
] as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function safeCall<T>(fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch {
    return null;
  }
}

const SEVERITY_SCORE: Record<string, number> = {
  CRITICAL: 40,
  HIGH: 25,
  MEDIUM: 10,
  LOW: 5,
  INFO: 0,
};

function computeRiskScore(issues: AuditIssue[]): number {
  const raw = issues.reduce((sum, i) => sum + (SEVERITY_SCORE[i.severity] ?? 0), 0);
  return Math.min(raw, 100);
}

function verdict(score: number): AuditResult["verdict"] {
  if (score === 0) return "CLEAN";
  if (score < 20) return "LOW_RISK";
  if (score < 40) return "CAUTION";
  return "DANGEROUS";
}

// ---------------------------------------------------------------------------
// Agent
// ---------------------------------------------------------------------------

export class AuditorAgent extends BaseAgent {
  constructor(wallet: AgenticWallet, reinvestConfig?: ReinvestConfig) {
    super("auditor", wallet, reinvestConfig);
  }

  async execute(action: string, params: Record<string, unknown> = {}): Promise<unknown> {
    if (action !== "quick-scan") {
      throw new Error(`Unknown action: ${action}`);
    }
    return this.quickScan(params);
  }

  // -----------------------------------------------------------------------
  // quick-scan
  // -----------------------------------------------------------------------

  private async quickScan(params: Record<string, unknown>): Promise<AuditResult> {
    const contract = (params.contract as string) ?? "0x0";
    this.log(`Security scan on ${contract}`);

    this.emit({
      timestamp: Date.now(),
      agent: this.name,
      type: "scan-start",
      message: `Starting quick-scan of ${contract}`,
      details: { contract },
    });

    const xlayer = createPublicClient({ transport: http(config.xlayerRpcUrl) });

    // 1. Bytecode check
    const code = await safeCall(() => xlayer.getCode({ address: contract as Address }));
    const isContract = !!code && code !== "0x";
    const bytecodeSize = code ? (code.length - 2) / 2 : 0;

    if (!isContract) {
      const result: AuditResult = {
        contract,
        contractType: "EOA",
        bytecodeSize: 0,
        riskScore: 0,
        verdict: "CLEAN",
        issues: [{ severity: "INFO", title: "Not a contract", detail: "Address is an EOA" }],
        securityScan: null,
        timestamp: new Date().toISOString(),
      };
      this.emitScanComplete(contract, result);
      return result;
    }

    // 2. Probe contract interface
    const [owner, paused, name, symbol, decimals, totalSupply, proxiableUUID] =
      await Promise.all([
        safeCall(() => xlayer.readContract({ address: contract as Address, abi: inspectAbi, functionName: "owner" })),
        safeCall(() => xlayer.readContract({ address: contract as Address, abi: inspectAbi, functionName: "paused" })),
        safeCall(() => xlayer.readContract({ address: contract as Address, abi: inspectAbi, functionName: "name" })),
        safeCall(() => xlayer.readContract({ address: contract as Address, abi: inspectAbi, functionName: "symbol" })),
        safeCall(() => xlayer.readContract({ address: contract as Address, abi: inspectAbi, functionName: "decimals" })),
        safeCall(() => xlayer.readContract({ address: contract as Address, abi: inspectAbi, functionName: "totalSupply" })),
        safeCall(() => xlayer.readContract({ address: contract as Address, abi: inspectAbi, functionName: "proxiableUUID" })),
      ]);

    const isERC20 = symbol !== null && decimals !== null && totalSupply !== null;
    const isUUPS = proxiableUUID !== null;

    // 3. Security scan via OnchainOS
    const secResult = onchainosSecurity.tokenScan(contract, config.chainId);
    let securityScan = (secResult.success ? secResult.data : null) as Record<string, unknown> | null;

    // Fallback to OKX direct API
    if (!securityScan) {
      try {
        securityScan = await okxTokenSecurity(String(config.chainId), contract) as Record<string, unknown> | null;
      } catch {
        securityScan = null;
      }
    }

    // 4. Compile issues
    const issues: AuditIssue[] = [];

    if (owner) {
      issues.push({ severity: "MEDIUM", title: "Centralized ownership", detail: `Owner: ${owner}` });
    }
    if (paused === true) {
      issues.push({ severity: "HIGH", title: "Contract is PAUSED", detail: "All operations may be halted" });
    }
    if (isUUPS) {
      issues.push({ severity: "MEDIUM", title: "UUPS Proxy", detail: "Implementation can be changed by owner" });
    }
    if (bytecodeSize > 24576) {
      issues.push({ severity: "LOW", title: "Large bytecode", detail: `${bytecodeSize} bytes` });
    }

    if (securityScan) {
      if (securityScan.isHoneypot === true || securityScan.isHoneypot === "1") {
        issues.push({ severity: "CRITICAL", title: "Honeypot", detail: "Cannot sell after buying" });
      }
      if (securityScan.isMintable === true || securityScan.isMintable === "1") {
        issues.push({ severity: "MEDIUM", title: "Mintable", detail: "Supply can be inflated" });
      }
      const buyTax = Number(securityScan.buyTax ?? 0);
      const sellTax = Number(securityScan.sellTax ?? 0);
      if (buyTax > 0) {
        issues.push({ severity: "LOW", title: "Buy tax", detail: `${buyTax}%` });
      }
      if (sellTax > 0) {
        issues.push({ severity: "LOW", title: "Sell tax", detail: `${sellTax}%` });
      }
      if (securityScan.isOpenSource === false || securityScan.isOpenSource === "0") {
        issues.push({ severity: "MEDIUM", title: "Unverified source", detail: "Code not verified" });
      }
    }

    const riskScore = computeRiskScore(issues);
    const contractType = isERC20 ? "ERC-20" : isUUPS ? "UUPS Proxy" : "Smart Contract";

    const result: AuditResult = {
      contract,
      contractType,
      bytecodeSize,
      riskScore,
      verdict: verdict(riskScore),
      issues,
      securityScan,
      timestamp: new Date().toISOString(),
    };

    this.emitScanComplete(contract, result);
    return result;
  }

  // -----------------------------------------------------------------------
  // Event helpers
  // -----------------------------------------------------------------------

  private emitScanComplete(contract: string, result: AuditResult): void {
    this.emit({
      timestamp: Date.now(),
      agent: this.name,
      type: "scan-complete",
      message: `Scan of ${contract}: ${result.verdict} (risk ${result.riskScore})`,
      details: { contract, verdict: result.verdict, riskScore: result.riskScore },
    });
  }

  // -----------------------------------------------------------------------
  // Auditor never buys other services
  // -----------------------------------------------------------------------

  override shouldBuyService(_type: string): boolean {
    return false;
  }
}
