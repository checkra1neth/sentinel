/**
 * ERC-8004 Agent Registration Script
 *
 * Registers 3 Sentinel agents (Sentinel, Guardian, Operator) on the
 * ERC-8004 Identity Registry deployed on X Layer (chain 196).
 *
 * Usage: npx tsx src/erc8004/register-agents.ts
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { encodeFunctionData, type Address } from "viem";
import { AgenticWallet } from "../wallet/agentic-wallet.js";
import { onchainosWallet } from "../lib/onchainos.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const IDENTITY_REGISTRY: Address = "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432";

const REGISTER_ABI = [
  {
    name: "register",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "agentURI", type: "string" },
      { name: "agentWallet", type: "address" },
    ],
    outputs: [{ name: "agentId", type: "uint256" }],
  },
] as const;

// ---------------------------------------------------------------------------
// Agent definitions
// ---------------------------------------------------------------------------

interface AgentDef {
  role: string;
  accountId: string;
  address: Address;
  metadataFile: string;
}

const AGENTS: AgentDef[] = [
  {
    role: "sentinel",
    accountId: "54fd24b8-2ad8-438a-8e56-64100a62a05a",
    address: "0x874370bc9352bfa4b39c22fa82b89f4ca952ce03",
    metadataFile: "sentinel.json",
  },
  {
    role: "guardian",
    accountId: "b4473b86-ce53-423b-9744-0d58762e9026",
    address: "0x38c7b7651b42cd5d0e9fe1909f52b6fd8e044db2",
    metadataFile: "guardian.json",
  },
  {
    role: "operator",
    accountId: "8ff99bf5-4b4a-48d3-8957-7c6d9fa9debf",
    address: "0x7500350249e155fdacb27dc0a12f5198b158ee00",
    metadataFile: "operator.json",
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadMetadataAsDataUri(filename: string): string {
  const filePath = resolve(__dirname, "agent-metadata", filename);
  const raw = readFileSync(filePath, "utf-8");
  // Validate JSON
  JSON.parse(raw);
  const base64 = Buffer.from(raw).toString("base64");
  return `data:application/json;base64,${base64}`;
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

async function registerAgent(agent: AgentDef): Promise<void> {
  console.log(`\n--- Registering ${agent.role} (${agent.address}) ---`);

  // 1. Load metadata and encode as data URI
  const dataUri = loadMetadataAsDataUri(agent.metadataFile);
  console.log(`  Metadata URI: ${dataUri.slice(0, 60)}...`);

  // 2. Encode the register() calldata
  const calldata = encodeFunctionData({
    abi: REGISTER_ABI,
    functionName: "register",
    args: [dataUri, agent.address],
  });
  console.log(`  Calldata: ${calldata.slice(0, 20)}...${calldata.slice(-8)}`);

  // 3. Switch to the agent's wallet and execute
  const wallet = new AgenticWallet(agent.accountId, agent.address, agent.role);
  const success = await wallet.contractCall(IDENTITY_REGISTRY, calldata);

  if (success) {
    console.log(`  SUCCESS: ${agent.role} registered on ERC-8004 Identity Registry`);
  } else {
    console.error(`  FAILED: ${agent.role} registration failed`);
  }
}

async function main(): Promise<void> {
  console.log("ERC-8004 Agent Registration");
  console.log(`Identity Registry: ${IDENTITY_REGISTRY}`);
  console.log(`Chain: X Layer (196)`);
  console.log(`Agents to register: ${AGENTS.length}`);

  // Verify CLI connectivity
  const status = onchainosWallet.status();
  if (!status.success) {
    console.error("ERROR: onchainos CLI not reachable. Ensure it is installed and configured.");
    process.exit(1);
  }
  console.log("onchainos CLI: connected");

  const results: Array<{ role: string; success: boolean }> = [];

  for (const agent of AGENTS) {
    try {
      await registerAgent(agent);
      results.push({ role: agent.role, success: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`  ERROR: ${agent.role} — ${message}`);
      results.push({ role: agent.role, success: false });
    }
  }

  // Summary
  console.log("\n=== Registration Summary ===");
  for (const r of results) {
    console.log(`  ${r.role}: ${r.success ? "OK" : "FAILED"}`);
  }

  const allOk = results.every((r) => r.success);
  process.exit(allOk ? 0 : 1);
}

main();
