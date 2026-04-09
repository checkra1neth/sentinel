// ---------------------------------------------------------------------------
// ERC-8004 Reputation Signals
//
// After each completed job (security scan, swap, deposit, etc.), submits a
// reputation signal to the ERC-8004 Reputation Registry on X Layer.
// This builds on-chain track records for Guardian and Operator agents.
//
// Non-critical: all errors are logged but never thrown. Reputation should
// never break the main application flow.
// ---------------------------------------------------------------------------

import { encodeFunctionData, type Address } from "viem";
import { AgenticWallet } from "../wallet/agentic-wallet.js";
import { config } from "../config.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const REPUTATION_REGISTRY: Address = "0x8004BAa17C55a88189AE136b182e5fdA19dE9b63";

const SUBMIT_FEEDBACK_ABI = [
  {
    name: "submitFeedback",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "agentId", type: "uint256" },
      { name: "feedbackURI", type: "string" },
    ],
    outputs: [],
  },
] as const;

// Sentinel wallet (auditor role) submits reputation on behalf of the platform
const SENTINEL_ACCOUNT_ID = "54fd24b8-2ad8-438a-8e56-64100a62a05a";
const SENTINEL_ADDRESS: Address = "0x874370bc9352bfa4b39c22fa82b89f4ca952ce03";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FeedbackPayload {
  type: "job_completion";
  jobId: string;
  jobType: string;
  success: boolean;
  score: number;
  details: string;
  timestamp: number;
}

interface ReputationSignalParams {
  agentId: number;
  jobId: string;
  jobType: string;
  success: boolean;
  score: number;
  details: string;
}

// ---------------------------------------------------------------------------
// Core function
// ---------------------------------------------------------------------------

/**
 * Submit a reputation signal to the ERC-8004 Reputation Registry.
 *
 * 1. Builds feedback JSON
 * 2. Encodes as data URI (base64)
 * 3. Encodes submitFeedback(agentId, feedbackURI) calldata using viem
 * 4. Executes via Sentinel's AgenticWallet.contractCall()
 * 5. Returns true/false based on success
 *
 * Never throws -- reputation is non-critical.
 */
export async function submitReputationSignal(params: ReputationSignalParams): Promise<boolean> {
  try {
    // 1. Build feedback JSON
    const feedback: FeedbackPayload = {
      type: "job_completion",
      jobId: params.jobId,
      jobType: params.jobType,
      success: params.success,
      score: params.score,
      details: params.details,
      timestamp: Math.floor(Date.now() / 1000),
    };

    // 2. Encode as data URI
    const json = JSON.stringify(feedback);
    const base64 = Buffer.from(json).toString("base64");
    const feedbackURI = `data:application/json;base64,${base64}`;

    // 3. Encode calldata
    const calldata = encodeFunctionData({
      abi: SUBMIT_FEEDBACK_ABI,
      functionName: "submitFeedback",
      args: [BigInt(params.agentId), feedbackURI],
    });

    // 4. Execute via Sentinel wallet
    const sentinelWallet = new AgenticWallet(
      SENTINEL_ACCOUNT_ID,
      SENTINEL_ADDRESS,
      "sentinel",
    );

    const success = await sentinelWallet.contractCall(REPUTATION_REGISTRY, calldata);

    if (success) {
      console.log(
        `[reputation] Signal submitted for agent ${params.agentId} | job ${params.jobId} | ${params.jobType} | score=${params.score}`,
      );
    } else {
      console.warn(
        `[reputation] TX failed for agent ${params.agentId} | job ${params.jobId}`,
      );
    }

    return success;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[reputation] Error submitting signal: ${message}`);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Helper: resolve agent ID from env vars
// ---------------------------------------------------------------------------

/**
 * Get the ERC-8004 agentId for a given role from environment variables.
 * Returns undefined if not set (registration not yet done).
 */
export function getAgentId(role: "sentinel" | "guardian" | "operator"): number | undefined {
  const envMap: Record<string, string> = {
    sentinel: "SENTINEL_AGENT_ID",
    guardian: "GUARDIAN_AGENT_ID",
    operator: "OPERATOR_AGENT_ID",
  };

  const raw = process.env[envMap[role]];
  if (!raw) return undefined;

  const parsed = parseInt(raw, 10);
  return isNaN(parsed) ? undefined : parsed;
}
