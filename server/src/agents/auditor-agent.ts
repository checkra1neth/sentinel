import { type Address } from "viem";
import { BaseAgent, type ReinvestConfig } from "./base-agent.js";
import { type ScanResult } from "../types.js";

export class AuditorAgent extends BaseAgent {
  constructor(
    walletAddress: Address,
    reinvestConfig?: ReinvestConfig,
  ) {
    super("auditor", walletAddress, reinvestConfig);
  }

  async execute(
    action: string,
    params: Record<string, unknown>,
  ): Promise<ScanResult> {
    if (action !== "quick-scan") {
      throw new Error(`Unknown action: ${action}`);
    }

    const contract = (params.contract as Address) ?? "0x0000000000000000000000000000000000000000";

    this.log(`Running quick scan on ${contract}`);

    const possibleIssues = [
      "reentrancy risk in withdraw()",
      "unchecked external call",
      "missing access control",
      "integer overflow potential",
    ];

    const issues = possibleIssues.filter(() => Math.random() > 0.6);

    return {
      contract,
      riskScore: issues.length * 25,
      issues,
      verified: issues.length === 0,
    };
  }
}
