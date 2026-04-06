import { type Address, encodeFunctionData } from "viem";
import { publicClient } from "./client.js";
import { verdictRegistryAbi } from "./abis.js";
import type { AgenticWallet } from "../wallet/agentic-wallet.js";

const VERDICT_REGISTRY_ADDRESS = (process.env.VERDICT_REGISTRY_ADDRESS ?? "") as Address;

/**
 * Publish a verdict on-chain via the sentinel wallet.
 */
export async function publishVerdictOnChain(
  wallet: AgenticWallet,
  token: Address,
  riskScore: number,
  verdict: string,
  isHoneypot: boolean,
  hasRug: boolean,
): Promise<boolean> {
  const calldata = encodeFunctionData({
    abi: verdictRegistryAbi,
    functionName: "publishVerdict",
    args: [token, riskScore, verdict, isHoneypot, hasRug],
  });

  return wallet.contractCall(VERDICT_REGISTRY_ADDRESS, calldata);
}

/**
 * Read the total number of verdicts published on-chain.
 */
export async function getVerdictCount(): Promise<bigint> {
  return publicClient.readContract({
    address: VERDICT_REGISTRY_ADDRESS,
    abi: verdictRegistryAbi,
    functionName: "verdictCount",
  });
}
