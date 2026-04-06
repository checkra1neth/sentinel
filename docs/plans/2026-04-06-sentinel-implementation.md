# Sentinel Security Oracle — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pivot Agentra from generic agent marketplace to Sentinel — an autonomous security oracle that monitors X Layer tokens, publishes on-chain verdicts, sells reports via x402, and invests in safe tokens via Uniswap LP.

**Architecture:** Three specialized agents (Scanner, Analyst, Executor) each with an Agentic Wallet operate on a cron loop. Scanner discovers tokens via OnchainOS dex-trenches/signal. Analyst does deep security scan and publishes verdict on-chain via VerdictRegistry contract. Executor invests profits in Uniswap LP on tokens verified as safe. Inter-agent payments via x402. Single-page Threat Feed dashboard with real-time verdicts via WebSocket.

**Tech Stack:** TypeScript (ESM), Express, viem, node-cron, ws, OnchainOS CLI, OKX Web3 API v6, Solidity 0.8.24, Foundry, Next.js 16, wagmi, TailwindCSS v4

**Spec:** `docs/specs/2026-04-06-sentinel-design.md`

**Existing infra reused as-is:** base-agent.ts, agentic-wallet.ts, onchainos.ts, okx-api.ts, uniswap.ts, x402-client.ts, x402-middleware.ts, event-bus.ts, config.ts, ws.ts (web)

---

## File Structure

### Server — Changes

```
server/src/
├── agents/
│   ├── base-agent.ts              # AS-IS
│   ├── scanner-agent.ts           # NEW — token discovery cron
│   ├── analyst-agent.ts           # REWRITE — deep security + verdict
│   ├── executor-agent.ts          # NEW — LP on safe tokens
│   ├── decision-engine.ts         # REWRITE — Sentinel flow
│   └── [DELETE trader-agent.ts, auditor-agent.ts]
├── verdicts/
│   └── verdict-store.ts           # NEW — in-memory verdict store
├── contracts/
│   ├── verdict-registry.ts        # NEW — publish verdict on-chain
│   ├── client.ts                  # AS-IS
│   └── abis.ts                    # MODIFY — add VerdictRegistry ABI
├── router/
│   └── service-router.ts          # REWRITE — verdict endpoints
├── scheduler/
│   ├── cron-loop.ts               # MODIFY — Scanner cycle
│   └── reinvest.ts                # AS-IS
├── types.ts                       # MODIFY — add Verdict types
└── index.ts                       # REWRITE — wire Sentinel
```

### Contracts — New

```
contracts/src/
└── VerdictRegistry.sol            # NEW
contracts/test/
└── VerdictRegistry.t.sol          # NEW
```

### Web — Changes

```
web/src/
├── app/
│   ├── page.tsx                   # REWRITE — Threat Feed
│   ├── marketplace/page.tsx       # DELETE or keep as-is
│   └── dashboard/page.tsx         # DELETE or redirect to /
├── components/
│   ├── verdict-card.tsx           # NEW
│   ├── threat-stats.tsx           # NEW
│   ├── live-feed.tsx              # MODIFY — verdict colors
│   ├── agent-card.tsx             # AS-IS
│   └── connect-button.tsx         # AS-IS
└── lib/
    ├── ws.ts                      # AS-IS
    └── contracts.ts               # MODIFY — add VerdictRegistry
```

### Skill — Rewrite

```
skill/
├── SKILL.md                       # REWRITE — Sentinel concept
├── plugin.json                    # MODIFY
└── skills/
    ├── scan/SKILL.md              # NEW
    ├── feed/SKILL.md              # NEW
    ├── report/SKILL.md            # NEW
    ├── portfolio/SKILL.md         # NEW
    └── status/SKILL.md            # NEW
```

---

## Task 1: VerdictRegistry Contract + Verdict Store

**Files:**
- Create: `contracts/src/VerdictRegistry.sol`
- Create: `contracts/test/VerdictRegistry.t.sol`
- Create: `server/src/verdicts/verdict-store.ts`
- Create: `server/src/contracts/verdict-registry.ts`
- Modify: `server/src/contracts/abis.ts`
- Modify: `server/src/types.ts`

- [ ] **Step 1: Add Verdict types to server/src/types.ts**

Append to the end of the file:

```typescript
// --- Sentinel Verdict Types ---

export interface Verdict {
  token: string;
  tokenName: string;
  tokenSymbol: string;
  riskScore: number;
  verdict: "SAFE" | "CAUTION" | "DANGEROUS";
  isHoneypot: boolean;
  hasRug: boolean;
  hasMint: boolean;
  isProxy: boolean;
  buyTax: number;
  sellTax: number;
  holderConcentration: number;
  risks: string[];
  priceUsd: number;
  marketCap: number;
  liquidityUsd: number;
  timestamp: number;
  txHash?: string;
  lpInvested?: string;
}

export interface VerdictStats {
  totalScanned: number;
  totalSafe: number;
  totalCaution: number;
  totalDangerous: number;
  totalLpInvested: number;
  lpPnl: number;
}
```

- [ ] **Step 2: Create VerdictRegistry.sol**

Create `contracts/src/VerdictRegistry.sol`:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract VerdictRegistry {
    event VerdictPublished(
        address indexed token,
        uint8 riskScore,
        string verdict,
        bool isHoneypot,
        bool hasRug,
        uint256 timestamp
    );

    address public sentinel;
    uint256 public verdictCount;

    modifier onlySentinel() {
        require(msg.sender == sentinel, "Not sentinel");
        _;
    }

    constructor(address _sentinel) {
        sentinel = _sentinel;
    }

    function publishVerdict(
        address token,
        uint8 riskScore,
        string calldata verdict,
        bool isHoneypot,
        bool hasRug
    ) external onlySentinel {
        verdictCount++;
        emit VerdictPublished(token, riskScore, verdict, isHoneypot, hasRug, block.timestamp);
    }

    function updateSentinel(address _sentinel) external onlySentinel {
        sentinel = _sentinel;
    }
}
```

- [ ] **Step 3: Create VerdictRegistry test**

Create `contracts/test/VerdictRegistry.t.sol`:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/VerdictRegistry.sol";

contract VerdictRegistryTest is Test {
    VerdictRegistry registry;
    address sentinel = address(0x1);
    address token = address(0x2);

    function setUp() public {
        registry = new VerdictRegistry(sentinel);
    }

    function test_publishVerdict() public {
        vm.prank(sentinel);
        registry.publishVerdict(token, 15, "SAFE", false, false);
        assertEq(registry.verdictCount(), 1);
    }

    function test_revertNonSentinel() public {
        vm.expectRevert("Not sentinel");
        registry.publishVerdict(token, 85, "DANGEROUS", true, true);
    }

    function test_emitsEvent() public {
        vm.prank(sentinel);
        vm.expectEmit(true, false, false, true);
        emit VerdictRegistry.VerdictPublished(token, 15, "SAFE", false, false, block.timestamp);
        registry.publishVerdict(token, 15, "SAFE", false, false);
    }

    function test_updateSentinel() public {
        address newSentinel = address(0x3);
        vm.prank(sentinel);
        registry.updateSentinel(newSentinel);
        assertEq(registry.sentinel(), newSentinel);
    }
}
```

- [ ] **Step 4: Run Foundry tests**

Run: `cd ~/Projects/agentra/contracts && forge test --match-contract VerdictRegistryTest -v`
Expected: 4 tests PASS

- [ ] **Step 5: Deploy VerdictRegistry**

Run: `cd ~/Projects/agentra/contracts && forge create src/VerdictRegistry.sol:VerdictRegistry --constructor-args 0x874370bc9352bfa4b39c22fa82b89f4ca952ce03 --rpc-url https://rpc.xlayer.tech --private-key $DEPLOYER_KEY`

Save deployed address to .env as `VERDICT_REGISTRY_ADDRESS`.

- [ ] **Step 6: Add VerdictRegistry ABI to server**

Append to `server/src/contracts/abis.ts`:

```typescript
export const verdictRegistryAbi = [
  {
    name: "publishVerdict",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "token", type: "address" },
      { name: "riskScore", type: "uint8" },
      { name: "verdict", type: "string" },
      { name: "isHoneypot", type: "bool" },
      { name: "hasRug", type: "bool" },
    ],
    outputs: [],
  },
  {
    name: "verdictCount",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "sentinel",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
] as const;
```

- [ ] **Step 7: Create verdict-registry.ts for on-chain publishing**

Create `server/src/contracts/verdict-registry.ts`:

```typescript
import { type Address, encodeFunctionData } from "viem";
import { verdictRegistryAbi } from "./abis.js";
import { publicClient } from "./client.js";
import { AgenticWallet } from "../wallet/agentic-wallet.js";
import { config } from "../config.js";

export async function publishVerdictOnChain(
  wallet: AgenticWallet,
  token: Address,
  riskScore: number,
  verdict: string,
  isHoneypot: boolean,
  hasRug: boolean,
): Promise<string | null> {
  const registryAddress = process.env.VERDICT_REGISTRY_ADDRESS as Address;
  if (!registryAddress) return null;

  const calldata = encodeFunctionData({
    abi: verdictRegistryAbi,
    functionName: "publishVerdict",
    args: [token, riskScore, verdict, isHoneypot, hasRug],
  });

  const success = await wallet.contractCall(registryAddress, calldata);
  return success ? "published" : null;
}

export async function getVerdictCount(): Promise<number> {
  const registryAddress = process.env.VERDICT_REGISTRY_ADDRESS as Address;
  if (!registryAddress) return 0;

  try {
    const count = await publicClient.readContract({
      address: registryAddress,
      abi: verdictRegistryAbi,
      functionName: "verdictCount",
    });
    return Number(count);
  } catch {
    return 0;
  }
}
```

- [ ] **Step 8: Create verdict-store.ts**

Create `server/src/verdicts/verdict-store.ts`:

```typescript
import type { Verdict, VerdictStats } from "../types.js";

class VerdictStore {
  private verdicts: Verdict[] = [];
  private scannedTokens = new Set<string>();
  private readonly maxVerdicts = 1000;

  add(verdict: Verdict): void {
    this.verdicts.unshift(verdict);
    this.scannedTokens.add(verdict.token.toLowerCase());
    if (this.verdicts.length > this.maxVerdicts) {
      this.verdicts = this.verdicts.slice(0, this.maxVerdicts);
    }
  }

  isScanned(token: string): boolean {
    return this.scannedTokens.has(token.toLowerCase());
  }

  getRecent(limit = 50): Verdict[] {
    return this.verdicts.slice(0, limit);
  }

  getByToken(token: string): Verdict | undefined {
    return this.verdicts.find(
      (v) => v.token.toLowerCase() === token.toLowerCase(),
    );
  }

  getStats(): VerdictStats {
    let totalLpInvested = 0;
    let safe = 0;
    let caution = 0;
    let dangerous = 0;

    for (const v of this.verdicts) {
      if (v.verdict === "SAFE") safe++;
      else if (v.verdict === "CAUTION") caution++;
      else dangerous++;
      if (v.lpInvested) totalLpInvested += Number(v.lpInvested);
    }

    return {
      totalScanned: this.verdicts.length,
      totalSafe: safe,
      totalCaution: caution,
      totalDangerous: dangerous,
      totalLpInvested: totalLpInvested,
      lpPnl: 0, // TODO: calculate from Executor LP positions
    };
  }
}

export const verdictStore = new VerdictStore();
```

- [ ] **Step 9: Commit**

```bash
cd ~/Projects/agentra
git add contracts/src/VerdictRegistry.sol contracts/test/VerdictRegistry.t.sol \
  server/src/verdicts/ server/src/contracts/verdict-registry.ts \
  server/src/contracts/abis.ts server/src/types.ts
git commit -m "feat: VerdictRegistry contract + verdict store + on-chain publishing"
```

---

## Task 2: Scanner Agent

**Files:**
- Create: `server/src/agents/scanner-agent.ts`
- Test: `server/__tests__/scanner-agent.test.ts`

- [ ] **Step 1: Create scanner-agent.ts**

Create `server/src/agents/scanner-agent.ts`:

```typescript
import type { Address } from "viem";
import { BaseAgent } from "./base-agent.js";
import type { AgenticWallet } from "../wallet/agentic-wallet.js";
import type { ReinvestConfig } from "./base-agent.js";
import { onchainosTrenches, onchainosSignal, onchainosToken } from "../lib/onchainos.js";
import { verdictStore } from "../verdicts/verdict-store.js";
import { config } from "../config.js";

interface TokenCandidate {
  address: string;
  source: string;
  name?: string;
}

export class ScannerAgent extends BaseAgent {
  constructor(wallet: AgenticWallet, reinvestConfig?: ReinvestConfig) {
    super("Scanner", wallet, reinvestConfig);
  }

  async execute(action: string, params: Record<string, unknown>): Promise<unknown> {
    switch (action) {
      case "discover":
        return this.discoverTokens();
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  }

  override async autonomousLoop(): Promise<void> {
    this.log("Starting discovery cycle");
    this.emit({ timestamp: Date.now(), agent: this.name, type: "scan", message: "Discovery cycle started" });

    const candidates = await this.discoverTokens();
    const newTokens = candidates.filter((c) => !verdictStore.isScanned(c.address));

    this.log(`Found ${candidates.length} tokens, ${newTokens.length} new`);
    this.emit({
      timestamp: Date.now(),
      agent: this.name,
      type: "scan",
      message: `Found ${newTokens.length} new tokens to scan`,
      details: { total: candidates.length, new: newTokens.length },
    });

    // Return new tokens for decision engine to process
    return newTokens as unknown as void;
  }

  override shouldBuyService(type: string): boolean {
    return type === "analyst";
  }

  async discoverTokens(): Promise<TokenCandidate[]> {
    const candidates: TokenCandidate[] = [];

    // 1. New launches on X Layer via dex-trenches
    const newTokens = onchainosTrenches.tokens(config.chainId, "NEW");
    if (newTokens.success && Array.isArray(newTokens.data)) {
      for (const t of newTokens.data as Record<string, string>[]) {
        if (t.tokenAddress || t.address) {
          candidates.push({
            address: t.tokenAddress || t.address,
            source: "new_launch",
            name: t.name || t.symbol,
          });
        }
      }
    }

    // 2. Recently migrated tokens
    const migrated = onchainosTrenches.tokens(config.chainId, "MIGRATED");
    if (migrated.success && Array.isArray(migrated.data)) {
      for (const t of migrated.data as Record<string, string>[]) {
        if (t.tokenAddress || t.address) {
          candidates.push({
            address: t.tokenAddress || t.address,
            source: "migrated",
            name: t.name || t.symbol,
          });
        }
      }
    }

    // 3. Smart money activity
    const signals = onchainosSignal.activities("smart_money", config.chainId);
    if (signals.success && Array.isArray(signals.data)) {
      for (const s of signals.data as Record<string, string>[]) {
        if (s.tokenAddress || s.address) {
          candidates.push({
            address: s.tokenAddress || s.address,
            source: "smart_money",
            name: s.name || s.symbol,
          });
        }
      }
    }

    // 4. Trending/hot tokens
    const hot = onchainosToken.hotTokens();
    if (hot.success && Array.isArray(hot.data)) {
      for (const t of hot.data as Record<string, string>[]) {
        if (t.tokenAddress || t.address) {
          candidates.push({
            address: t.tokenAddress || t.address,
            source: "trending",
            name: t.name || t.symbol,
          });
        }
      }
    }

    // Deduplicate by address
    const seen = new Set<string>();
    return candidates.filter((c) => {
      const addr = c.address.toLowerCase();
      if (seen.has(addr)) return false;
      seen.add(addr);
      return true;
    });
  }
}
```

- [ ] **Step 2: Write test**

Create `server/__tests__/scanner-agent.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("node:child_process", () => ({
  execSync: vi.fn(() =>
    JSON.stringify([
      { tokenAddress: "0xAAA", name: "TokenA", source: "new" },
      { tokenAddress: "0xBBB", name: "TokenB", source: "migrated" },
    ]),
  ),
}));

vi.mock("../src/config.js", () => ({
  config: { chainId: 196, contracts: { usdt: "0x1E4a" } },
}));

vi.mock("../src/verdicts/verdict-store.js", () => ({
  verdictStore: {
    isScanned: vi.fn(() => false),
  },
}));

import { ScannerAgent } from "../src/agents/scanner-agent.js";
import { AgenticWallet } from "../src/wallet/agentic-wallet.js";

describe("ScannerAgent", () => {
  let agent: ScannerAgent;

  beforeEach(() => {
    const wallet = new AgenticWallet("test", "0x38c7b765" as any, "scanner");
    agent = new ScannerAgent(wallet);
  });

  it("discovers tokens from multiple sources", async () => {
    const result = (await agent.execute("discover", {})) as any[];
    expect(Array.isArray(result)).toBe(true);
  });

  it("throws on unknown action", async () => {
    await expect(agent.execute("unknown", {})).rejects.toThrow("Unknown action");
  });

  it("shouldBuyService returns true for analyst", () => {
    expect(agent.shouldBuyService("analyst")).toBe(true);
    expect(agent.shouldBuyService("executor")).toBe(false);
  });

  it("emits events during autonomous loop", async () => {
    const events: any[] = [];
    agent.onEvent((e) => events.push(e));
    await agent.autonomousLoop();
    expect(events.length).toBeGreaterThan(0);
    expect(events[0].type).toBe("scan");
  });
});
```

- [ ] **Step 3: Run test, commit**

Run: `cd ~/Projects/agentra/server && npx vitest run __tests__/scanner-agent.test.ts`

```bash
git add server/src/agents/scanner-agent.ts server/__tests__/scanner-agent.test.ts
git commit -m "feat(scanner): add Scanner agent for token discovery"
```

---

## Task 3: Analyst Agent Rewrite (Security Focus)

**Files:**
- Modify: `server/src/agents/analyst-agent.ts` (full rewrite)
- Test: `server/__tests__/analyst-agent.test.ts`

- [ ] **Step 1: Rewrite analyst-agent.ts**

Replace `server/src/agents/analyst-agent.ts` entirely:

```typescript
import type { Address } from "viem";
import { createPublicClient, http } from "viem";
import { BaseAgent } from "./base-agent.js";
import type { AgenticWallet } from "../wallet/agentic-wallet.js";
import type { ReinvestConfig } from "./base-agent.js";
import {
  onchainosSecurity,
  onchainosToken,
  onchainosTrenches,
  onchainosMarket,
} from "../lib/onchainos.js";
import { okxTokenSecurity } from "../lib/okx-api.js";
import { getPool, getPoolInfo } from "../lib/uniswap.js";
import { publishVerdictOnChain } from "../contracts/verdict-registry.js";
import { verdictStore } from "../verdicts/verdict-store.js";
import type { Verdict } from "../types.js";
import { config } from "../config.js";

const PROBE_ABI = [
  { name: "owner", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { name: "paused", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "bool" }] },
  { name: "name", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { name: "symbol", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { name: "decimals", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
  { name: "totalSupply", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { name: "proxiableUUID", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "bytes32" }] },
] as const;

export class AnalystAgent extends BaseAgent {
  private readonly client;

  constructor(wallet: AgenticWallet, reinvestConfig?: ReinvestConfig) {
    super("Analyst", wallet, reinvestConfig);
    this.client = createPublicClient({ transport: http(config.xlayerRpcUrl) });
  }

  async execute(action: string, params: Record<string, unknown>): Promise<unknown> {
    switch (action) {
      case "scan":
        return this.deepScan(params.token as string);
      case "report":
        return this.getReport(params.token as string);
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  }

  async deepScan(tokenAddress: string): Promise<Verdict> {
    const token = tokenAddress as Address;
    this.log(`Deep security scan: ${token}`);
    this.emit({ timestamp: Date.now(), agent: this.name, type: "scan", message: `Scanning ${token}` });

    // 1. Token metadata
    const tokenInfo = onchainosToken.priceInfo(token);
    const info = tokenInfo.success ? (tokenInfo.data as Record<string, unknown>) : {};

    // 2. Security scan (OnchainOS + OKX fallback)
    const secResult = onchainosSecurity.tokenScan(token, config.chainId);
    const sec = secResult.success ? (secResult.data as Record<string, unknown>) : {};
    const okxSec = await okxTokenSecurity(config.chainId, token);
    const security = { ...((okxSec as Record<string, unknown>) || {}), ...sec };

    // 3. Dev reputation
    const devResult = onchainosTrenches.devInfo(token);
    const dev = devResult.success ? (devResult.data as Record<string, unknown>) : {};

    // 4. Advanced info (holder concentration)
    const advResult = onchainosToken.advancedInfo(token);
    const adv = advResult.success ? (advResult.data as Record<string, unknown>) : {};

    // 5. Bytecode probe
    const probes = await this.probeContract(token);

    // 6. Liquidity check
    let liquidityUsd = 0;
    const liqResult = onchainosToken.liquidity(token);
    if (liqResult.success && Array.isArray(liqResult.data)) {
      for (const pool of liqResult.data as Record<string, unknown>[]) {
        liquidityUsd += Number(pool.tvlUsd || pool.liquidity || 0);
      }
    }

    // Also check Uniswap direct
    for (const fee of [3000, 500, 10000]) {
      const poolAddr = await getPool(token, config.contracts.usdt, fee);
      if (poolAddr) {
        const poolInfo = await getPoolInfo(poolAddr);
        if (poolInfo && poolInfo.liquidity > 0n) {
          liquidityUsd += Number(poolInfo.liquidity) / 1e18;
        }
      }
    }

    // 7. Calculate risk
    const risks: string[] = [];
    let riskScore = 0;

    const isHoneypot = Boolean(security.isHoneypot || security.action === "block");
    if (isHoneypot) { riskScore += 50; risks.push("HONEYPOT detected"); }

    const hasRug = Boolean(dev.rugCount && Number(dev.rugCount) > 0);
    if (hasRug) { riskScore += 40; risks.push(`Dev rugged ${dev.rugCount}x before`); }

    const hasMint = Boolean(security.isMintable || probes.mint);
    if (hasMint) { riskScore += 20; risks.push("Mint function present"); }

    const isProxy = Boolean(security.isProxy || probes.proxiableUUID);
    if (isProxy) { riskScore += 15; risks.push("Upgradeable proxy"); }

    const buyTax = Number(security.buyTax || 0);
    const sellTax = Number(security.sellTax || 0);
    if (buyTax > 5 || sellTax > 5) { riskScore += 15; risks.push(`High tax: buy=${buyTax}% sell=${sellTax}%`); }

    const holderConcentration = Number(adv.top10HolderPercent || 0);
    if (holderConcentration > 70) { riskScore += 10; risks.push(`Top 10 holders own ${holderConcentration}%`); }

    if (probes.owner) { risks.push(`Centralized owner: ${probes.owner}`); }

    riskScore = Math.min(riskScore, 100);

    let verdictLabel: Verdict["verdict"];
    if (riskScore <= 15) verdictLabel = "SAFE";
    else if (riskScore <= 40) verdictLabel = "CAUTION";
    else verdictLabel = "DANGEROUS";

    // 8. Build verdict
    const verdict: Verdict = {
      token: tokenAddress,
      tokenName: String(info.name || probes.name || "Unknown"),
      tokenSymbol: String(info.symbol || probes.symbol || "???"),
      riskScore,
      verdict: verdictLabel,
      isHoneypot,
      hasRug,
      hasMint,
      isProxy,
      buyTax,
      sellTax,
      holderConcentration,
      risks,
      priceUsd: Number(info.priceUsd || 0),
      marketCap: Number(info.marketCap || 0),
      liquidityUsd,
      timestamp: Date.now(),
    };

    // 9. Store verdict
    verdictStore.add(verdict);

    // 10. Publish on-chain
    const txResult = await publishVerdictOnChain(
      this.wallet,
      token,
      riskScore,
      verdictLabel,
      isHoneypot,
      hasRug,
    );
    if (txResult) verdict.txHash = txResult;

    this.emit({
      timestamp: Date.now(),
      agent: this.name,
      type: "verdict",
      message: `${verdictLabel} — ${verdict.tokenSymbol} (risk=${riskScore})`,
      details: { token: tokenAddress, riskScore, verdict: verdictLabel, risks },
    });

    this.log(`Verdict: ${verdictLabel} for ${verdict.tokenSymbol} (risk=${riskScore})`);
    return verdict;
  }

  async getReport(tokenAddress: string): Promise<Verdict | null> {
    const existing = verdictStore.getByToken(tokenAddress);
    if (existing) return existing;
    return this.deepScan(tokenAddress);
  }

  private async probeContract(contract: Address): Promise<Record<string, unknown>> {
    const results: Record<string, unknown> = {};
    for (const item of PROBE_ABI) {
      try {
        const value = await this.client.readContract({
          address: contract,
          abi: [item],
          functionName: item.name,
        });
        results[item.name] = value;
      } catch {
        // Function not available
      }
    }
    return results;
  }
}
```

- [ ] **Step 2: Write test**

Create `server/__tests__/analyst-agent.test.ts` (replace old one):

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("node:child_process", () => ({
  execSync: vi.fn(() => JSON.stringify({ action: null, isHoneypot: false, isProxy: false })),
}));
vi.mock("../src/lib/okx-api.js", () => ({ okxTokenSecurity: vi.fn().mockResolvedValue(null) }));
vi.mock("../src/lib/uniswap.js", () => ({ getPool: vi.fn().mockResolvedValue(null), getPoolInfo: vi.fn().mockResolvedValue(null) }));
vi.mock("../src/contracts/verdict-registry.js", () => ({ publishVerdictOnChain: vi.fn().mockResolvedValue("published") }));
vi.mock("../src/verdicts/verdict-store.js", () => ({
  verdictStore: { add: vi.fn(), getByToken: vi.fn().mockReturnValue(null), isScanned: vi.fn(() => false) },
}));
vi.mock("../src/config.js", () => ({
  config: { chainId: 196, xlayerRpcUrl: "https://rpc.xlayer.tech", contracts: { usdt: "0x1E4a" } },
}));
vi.mock("viem", async () => {
  const actual = await vi.importActual("viem");
  return {
    ...actual,
    createPublicClient: () => ({
      getCode: vi.fn().mockResolvedValue("0x6080"),
      readContract: vi.fn().mockRejectedValue(new Error("n/a")),
    }),
  };
});

import { AnalystAgent } from "../src/agents/analyst-agent.js";
import { AgenticWallet } from "../src/wallet/agentic-wallet.js";

describe("AnalystAgent (Sentinel)", () => {
  let agent: AnalystAgent;

  beforeEach(() => {
    const wallet = new AgenticWallet("test", "0x874370bc" as any, "analyst");
    agent = new AnalystAgent(wallet);
  });

  it("deep scan returns Verdict with riskScore and verdict label", async () => {
    const result = (await agent.execute("scan", { token: "0xAAA" })) as any;
    expect(result).toHaveProperty("riskScore");
    expect(result).toHaveProperty("verdict");
    expect(["SAFE", "CAUTION", "DANGEROUS"]).toContain(result.verdict);
    expect(result).toHaveProperty("risks");
    expect(result).toHaveProperty("isHoneypot");
  });

  it("throws on unknown action", async () => {
    await expect(agent.execute("unknown", {})).rejects.toThrow();
  });

  it("emits verdict event", async () => {
    const events: any[] = [];
    agent.onEvent((e) => events.push(e));
    await agent.execute("scan", { token: "0xBBB" });
    const verdictEvent = events.find((e) => e.type === "verdict");
    expect(verdictEvent).toBeDefined();
  });
});
```

- [ ] **Step 3: Run test, commit**

Run: `cd ~/Projects/agentra/server && npx vitest run __tests__/analyst-agent.test.ts`

```bash
git add server/src/agents/analyst-agent.ts server/__tests__/analyst-agent.test.ts
git commit -m "feat(analyst): rewrite for deep security scanning + on-chain verdict publishing"
```

---

## Task 4: Executor Agent

**Files:**
- Create: `server/src/agents/executor-agent.ts`
- Test: `server/__tests__/executor-agent.test.ts`
- Delete: `server/src/agents/trader-agent.ts`

- [ ] **Step 1: Create executor-agent.ts**

Create `server/src/agents/executor-agent.ts`:

```typescript
import type { Address } from "viem";
import { formatUnits, parseUnits } from "viem";
import { BaseAgent } from "./base-agent.js";
import type { AgenticWallet } from "../wallet/agentic-wallet.js";
import type { ReinvestConfig } from "./base-agent.js";
import { onchainosSwap, onchainosToken, onchainosDefi } from "../lib/onchainos.js";
import { okxSwapQuote } from "../lib/okx-api.js";
import { getPool, getPoolInfo } from "../lib/uniswap.js";
import { config } from "../config.js";

interface LpPosition {
  token: string;
  tokenSymbol: string;
  poolAddress: string;
  amountInvested: string;
  timestamp: number;
}

export class ExecutorAgent extends BaseAgent {
  readonly lpPositions: LpPosition[] = [];

  constructor(wallet: AgenticWallet, reinvestConfig?: ReinvestConfig) {
    super("Executor", wallet, reinvestConfig);
  }

  async execute(action: string, params: Record<string, unknown>): Promise<unknown> {
    switch (action) {
      case "invest":
        return this.investInSafeToken(params.token as string, params.amount as string);
      case "portfolio":
        return this.getPortfolio();
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  }

  async investInSafeToken(tokenAddress: string, amount?: string): Promise<{ success: boolean; details: string }> {
    const token = tokenAddress as Address;
    const investAmount = amount || "10";

    this.log(`Investing ${investAmount} USDT in safe token ${token}`);
    this.emit({
      timestamp: Date.now(),
      agent: this.name,
      type: "invest",
      message: `Investing ${investAmount} USDT in ${token}`,
    });

    // 1. Check liquidity
    const liqResult = onchainosToken.liquidity(token);
    let hasLiquidity = false;

    if (liqResult.success && Array.isArray(liqResult.data) && (liqResult.data as unknown[]).length > 0) {
      hasLiquidity = true;
    }

    // Also check Uniswap direct
    for (const fee of [3000, 500, 10000]) {
      const poolAddr = await getPool(token, config.contracts.usdt, fee);
      if (poolAddr) {
        const poolInfo = await getPoolInfo(poolAddr);
        if (poolInfo && poolInfo.liquidity > 0n) {
          hasLiquidity = true;

          // Try to add LP via OnchainOS defi-invest
          const defiSearch = onchainosDefi.search(token, config.chainId, "DEX_POOL");
          if (defiSearch.success) {
            const pools = defiSearch.data as Record<string, string>[];
            if (pools.length > 0 && pools[0].investmentId) {
              const halfAmount = (Number(investAmount) / 2).toFixed(6);
              const halfWei = parseUnits(halfAmount, 6).toString();

              onchainosDefi.invest(
                pools[0].investmentId,
                this.wallet.address,
                "USDT",
                halfWei,
                config.chainId,
              );

              this.lpPositions.push({
                token: tokenAddress,
                tokenSymbol: "LP",
                poolAddress: poolAddr,
                amountInvested: investAmount,
                timestamp: Date.now(),
              });

              this.emit({
                timestamp: Date.now(),
                agent: this.name,
                type: "invest",
                message: `LP position opened: ${investAmount} USDT in ${token} pool`,
                details: { token: tokenAddress, amount: investAmount, pool: poolAddr },
              });

              return { success: true, details: `LP position: ${investAmount} USDT in pool ${poolAddr}` };
            }
          }
        }
      }
    }

    // Fallback: simple swap USDT → token
    if (hasLiquidity) {
      const swapResult = onchainosSwap.execute(
        config.contracts.usdt,
        token,
        investAmount,
        config.chainId,
        this.wallet.address,
      );

      if (swapResult.success) {
        this.lpPositions.push({
          token: tokenAddress,
          tokenSymbol: "SPOT",
          poolAddress: "",
          amountInvested: investAmount,
          timestamp: Date.now(),
        });

        this.emit({
          timestamp: Date.now(),
          agent: this.name,
          type: "invest",
          message: `Bought ${investAmount} USDT worth of ${token} (spot)`,
        });

        return { success: true, details: `Spot buy: ${investAmount} USDT → ${token}` };
      }
    }

    this.emit({
      timestamp: Date.now(),
      agent: this.name,
      type: "error",
      message: `Cannot invest in ${token}: no liquidity`,
    });

    return { success: false, details: "No sufficient liquidity" };
  }

  getPortfolio(): { positions: LpPosition[]; totalInvested: number } {
    let total = 0;
    for (const p of this.lpPositions) {
      total += Number(p.amountInvested);
    }
    return { positions: this.lpPositions, totalInvested: total };
  }
}
```

- [ ] **Step 2: Write test, run, commit**

```bash
git add server/src/agents/executor-agent.ts server/__tests__/executor-agent.test.ts
git rm server/src/agents/trader-agent.ts server/src/agents/auditor-agent.ts
git commit -m "feat(executor): add Executor agent for LP investment in safe tokens"
```

---

## Task 5: Decision Engine + Cron + Index Rewiring

**Files:**
- Modify: `server/src/agents/decision-engine.ts` (rewrite)
- Modify: `server/src/scheduler/cron-loop.ts` (update)
- Modify: `server/src/router/service-router.ts` (rewrite)
- Modify: `server/src/index.ts` (rewrite)

- [ ] **Step 1: Rewrite decision-engine.ts for Sentinel flow**

Replace `server/src/agents/decision-engine.ts`:

```typescript
import type { BaseAgent } from "./base-agent.js";
import type { ScannerAgent } from "./scanner-agent.js";
import type { AnalystAgent } from "./analyst-agent.js";
import type { ExecutorAgent } from "./executor-agent.js";
import { X402Client } from "../payments/x402-client.js";
import type { AgentEvent, Verdict } from "../types.js";

interface SentinelServices {
  scanner: { agent: ScannerAgent; serviceId: number; x402: X402Client };
  analyst: { agent: AnalystAgent; serviceId: number; x402: X402Client };
  executor: { agent: ExecutorAgent; serviceId: number; x402: X402Client };
}

export class DecisionEngine {
  private services: SentinelServices;
  private eventListeners: Array<(event: AgentEvent) => void> = [];

  constructor(services: SentinelServices) {
    this.services = services;
  }

  onEvent(listener: (event: AgentEvent) => void): void {
    this.eventListeners.push(listener);
  }

  async onTokensDiscovered(tokens: Array<{ address: string; source: string }>): Promise<void> {
    for (const token of tokens.slice(0, 5)) {
      this.emit("scan", `Scanner found ${token.address} (${token.source}) — buying Analyst scan`);

      // Scanner pays Analyst via x402
      const scanResult = await this.services.analyst.x402.buyService(
        this.services.analyst.serviceId,
        "scan",
        { token: token.address },
      );

      if (!scanResult.success) {
        this.emit("error", `Analyst scan failed for ${token.address}: ${scanResult.error}`);
        continue;
      }

      const verdict = scanResult.result as Verdict;
      if (!verdict) continue;

      this.emit("verdict", `${verdict.verdict}: ${verdict.tokenSymbol} (risk=${verdict.riskScore})`);

      // If SAFE → pay Executor to invest
      if (verdict.verdict === "SAFE") {
        this.emit("invest", `SAFE token found — buying Executor investment for ${verdict.tokenSymbol}`);

        const investResult = await this.services.executor.x402.buyService(
          this.services.executor.serviceId,
          "invest",
          { token: token.address, amount: "10" },
        );

        if (investResult.success) {
          this.emit("invest", `Executor invested in ${verdict.tokenSymbol} — skin in the game`);
        }
      }
    }
  }

  private emit(type: string, message: string): void {
    const event: AgentEvent = { timestamp: Date.now(), agent: "Sentinel", type, message };
    for (const listener of this.eventListeners) {
      listener(event);
    }
  }
}
```

- [ ] **Step 2: Update cron-loop.ts**

Replace `server/src/scheduler/cron-loop.ts`:

```typescript
import cron from "node-cron";
import type { ScannerAgent } from "../agents/scanner-agent.js";
import type { DecisionEngine } from "../agents/decision-engine.js";
import type { AgentEvent } from "../types.js";

export function startSentinelLoop(
  scanner: ScannerAgent,
  decisionEngine: DecisionEngine,
  cronInterval: string,
  onEvent?: (event: AgentEvent) => void,
): { task: cron.ScheduledTask; stop: () => void } {
  const task = cron.schedule(cronInterval, async () => {
    onEvent?.({ timestamp: Date.now(), agent: "Cron", type: "scan", message: "Sentinel cycle triggered" });

    try {
      // Scanner discovers tokens
      const newTokens = (await scanner.autonomousLoop()) as unknown as Array<{ address: string; source: string }>;

      if (Array.isArray(newTokens) && newTokens.length > 0) {
        // Decision engine processes discovered tokens
        await decisionEngine.onTokensDiscovered(newTokens);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      onEvent?.({ timestamp: Date.now(), agent: "Cron", type: "error", message: `Sentinel loop error: ${msg}` });
    }
  });

  console.log(`[cron] Sentinel scanning at: ${cronInterval}`);
  return { task, stop: () => task.stop() };
}
```

- [ ] **Step 3: Rewrite service-router.ts with verdict endpoints**

Replace `server/src/router/service-router.ts`:

```typescript
import { Router, type Request, type Response } from "express";
import { x402Middleware } from "./x402-middleware.js";
import type { BaseAgent } from "../agents/base-agent.js";
import type { ExecutorAgent } from "../agents/executor-agent.js";
import { verdictStore } from "../verdicts/verdict-store.js";
import { eventBus } from "../events/event-bus.js";

export function createServiceRouter(
  agents: Record<string, BaseAgent>,
): Router {
  const router = Router();

  // Health
  router.get("/health", (_req: Request, res: Response): void => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Public verdict feed (free)
  router.get("/verdicts", (_req: Request, res: Response): void => {
    const limit = Number(_req.query.limit ?? 50);
    res.json({ verdicts: verdictStore.getRecent(limit) });
  });

  // Detailed report (x402 paywall)
  router.get(
    "/verdicts/:token",
    x402Middleware(2, "0.50"),
    async (req: Request, res: Response): Promise<void> => {
      const { token } = req.params;
      const analyst = agents["2"];
      if (!analyst) { res.status(500).json({ error: "Analyst not available" }); return; }

      try {
        const report = await analyst.execute("report", { token });
        res.json({ report, paymentVerified: req.paymentVerified });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Scan failed";
        res.status(500).json({ error: msg });
      }
    },
  );

  // Manual scan request (x402 paywall)
  router.post(
    "/scan/:token",
    x402Middleware(2, "0.10"),
    async (req: Request, res: Response): Promise<void> => {
      const { token } = req.params;
      const analyst = agents["2"];
      if (!analyst) { res.status(500).json({ error: "Analyst not available" }); return; }

      try {
        const verdict = await analyst.execute("scan", { token });
        res.json({ verdict, paymentVerified: req.paymentVerified });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Scan failed";
        res.status(500).json({ error: msg });
      }
    },
  );

  // Agent overview
  router.get("/agents", async (_req: Request, res: Response): Promise<void> => {
    const agentList = await Promise.all(
      Object.entries(agents).map(async ([id, agent]) => {
        let balance = "0";
        try { balance = await agent.wallet.getUsdtBalance(); } catch {}
        return { id, name: agent.name, wallet: agent.walletAddress, balance };
      }),
    );
    res.json({ agents: agentList });
  });

  // Executor portfolio
  router.get("/portfolio", (_req: Request, res: Response): void => {
    const executor = agents["3"] as ExecutorAgent | undefined;
    if (!executor) { res.json({ positions: [], totalInvested: 0 }); return; }
    res.json(executor.getPortfolio());
  });

  // Stats
  router.get("/stats", (_req: Request, res: Response): void => {
    const verdictStats = verdictStore.getStats();
    const eventStats = eventBus.getStats();
    res.json({ ...verdictStats, events: eventStats });
  });

  // Event history
  router.get("/events/history", (req: Request, res: Response): void => {
    const limit = Number(req.query.limit ?? 100);
    res.json({ events: eventBus.getHistory(limit) });
  });

  // x402 service execution (generic, for inter-agent payments)
  router.post(
    "/services/:serviceId/:action",
    x402Middleware(1, "0.10"),
    async (req: Request, res: Response): Promise<void> => {
      const { serviceId, action } = req.params;
      const agent = agents[serviceId];
      if (!agent) { res.status(404).json({ error: `No agent for service ${serviceId}` }); return; }

      try {
        const result = await agent.execute(action, req.body ?? {});
        res.json({ serviceId: Number(serviceId), action, paymentVerified: req.paymentVerified, result });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Execution failed";
        res.status(500).json({ error: msg });
      }
    },
  );

  return router;
}
```

- [ ] **Step 4: Rewrite index.ts for Sentinel**

Replace `server/src/index.ts`:

```typescript
import express from "express";
import http from "http";
import { config } from "./config.js";
import { createServiceRouter } from "./router/service-router.js";
import { startSentinelLoop } from "./scheduler/cron-loop.js";
import { startReinvestScheduler } from "./scheduler/reinvest.js";
import { ScannerAgent } from "./agents/scanner-agent.js";
import { AnalystAgent } from "./agents/analyst-agent.js";
import { ExecutorAgent } from "./agents/executor-agent.js";
import { DecisionEngine } from "./agents/decision-engine.js";
import { X402Client } from "./payments/x402-client.js";
import { eventBus } from "./events/event-bus.js";
import { createAgentWallets } from "./wallet/agentic-wallet.js";
import type { BaseAgent } from "./agents/base-agent.js";

const app = express();
const server = http.createServer(app);

// CORS + JSON
app.use((_req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Content-Type, X-Payment");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  if (_req.method === "OPTIONS") { res.sendStatus(200); return; }
  next();
});
app.use(express.json());

// Agentic Wallets
const wallets = createAgentWallets();

// Sentinel Agents
const scanner = new ScannerAgent(wallets.analyst);   // Wallet A
const analyst = new AnalystAgent(wallets.auditor);   // Wallet B
const executor = new ExecutorAgent(wallets.trader);  // Wallet C

const agents: Record<string, BaseAgent> = {
  "1": scanner,
  "2": analyst,
  "3": executor,
};

// Wire events
for (const agent of Object.values(agents)) {
  agent.onEvent((event) => eventBus.emit(event));
}

// x402 clients for inter-agent payments
const baseUrl = `http://localhost:${config.port}`;
const scannerX402 = new X402Client(wallets.analyst, baseUrl);
const analystX402 = new X402Client(wallets.analyst, baseUrl);
const executorX402 = new X402Client(wallets.auditor, baseUrl);

for (const client of [scannerX402, analystX402, executorX402]) {
  client.onEvent((event) => eventBus.emit(event));
}

// Decision Engine — Sentinel flow
const decisionEngine = new DecisionEngine({
  scanner: { agent: scanner, serviceId: 1, x402: scannerX402 },
  analyst: { agent: analyst, serviceId: 2, x402: analystX402 },
  executor: { agent: executor, serviceId: 3, x402: executorX402 },
});
decisionEngine.onEvent((event) => eventBus.emit(event));

// Routes
app.use("/api", createServiceRouter(agents));

// WebSocket
eventBus.attachToServer(server);

// Cron — Sentinel scan loop
const sentinelLoop = startSentinelLoop(
  scanner,
  decisionEngine,
  config.cron.analystInterval,
  (event) => eventBus.emit(event),
);

// Reinvest scheduler
const reinvestTask = startReinvestScheduler(
  Object.values(agents),
  config.cron.reinvestInterval,
  (event) => eventBus.emit(event),
);

// Start
server.listen(config.port, () => {
  console.log(`\n  🛡️  Sentinel Security Oracle`);
  console.log(`  Server:    http://localhost:${config.port}`);
  console.log(`  WebSocket: ws://localhost:${config.port}/api/events`);
  console.log(`  Scanner:   ${wallets.analyst.address}`);
  console.log(`  Analyst:   ${wallets.auditor.address}`);
  console.log(`  Executor:  ${wallets.trader.address}`);
  console.log(`  Cron:      ${config.cron.analystInterval}\n`);
});

export { app, server, agents, decisionEngine, eventBus };
```

- [ ] **Step 5: Delete old agent files, run tests, commit**

```bash
cd ~/Projects/agentra/server
rm -f __tests__/agents.test.ts  # will rewrite in Task 9
git add server/src/
git commit -m "feat(sentinel): decision engine, cron loop, API, and index rewired for Sentinel"
```

---

## Task 6: Web Threat Feed Dashboard

**Files:**
- Create: `web/src/components/verdict-card.tsx`
- Create: `web/src/components/threat-stats.tsx`
- Modify: `web/src/components/live-feed.tsx`
- Modify: `web/src/app/page.tsx` (rewrite)
- Modify: `web/src/app/layout.tsx` (update nav)

- [ ] **Step 1: Create verdict-card.tsx**

Create `web/src/components/verdict-card.tsx`:

```tsx
"use client";

interface VerdictCardProps {
  token: string;
  tokenName: string;
  tokenSymbol: string;
  riskScore: number;
  verdict: "SAFE" | "CAUTION" | "DANGEROUS";
  risks: string[];
  priceUsd: number;
  liquidityUsd: number;
  lpInvested?: string;
  timestamp: number;
  txHash?: string;
}

const VERDICT_STYLES = {
  SAFE: { bg: "bg-emerald-500/10", border: "border-emerald-500/30", badge: "bg-emerald-500/20 text-emerald-400", icon: "🟢" },
  CAUTION: { bg: "bg-yellow-500/10", border: "border-yellow-500/30", badge: "bg-yellow-500/20 text-yellow-400", icon: "🟡" },
  DANGEROUS: { bg: "bg-red-500/10", border: "border-red-500/30", badge: "bg-red-500/20 text-red-400", icon: "🔴" },
};

export function VerdictCard(props: VerdictCardProps) {
  const style = VERDICT_STYLES[props.verdict];
  const timeAgo = getTimeAgo(props.timestamp);

  return (
    <div className={`rounded-xl border ${style.border} ${style.bg} p-4`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span>{style.icon}</span>
          <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${style.badge}`}>
            {props.verdict}
          </span>
          <span className="font-semibold text-white">{props.tokenSymbol}</span>
          <span className="text-gray-500 text-xs">{props.tokenName}</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span>Risk: {props.riskScore}</span>
          <span>{timeAgo}</span>
        </div>
      </div>
      <div className="text-xs text-gray-400 font-mono mb-2">
        {props.token.slice(0, 10)}...{props.token.slice(-6)}
      </div>
      <div className="flex flex-wrap gap-1 mb-2">
        {props.risks.map((risk, i) => (
          <span key={i} className="rounded bg-gray-800 px-2 py-0.5 text-xs text-gray-300">
            {risk}
          </span>
        ))}
        {props.risks.length === 0 && (
          <span className="text-xs text-gray-500">No issues found</span>
        )}
      </div>
      <div className="flex items-center justify-between text-xs text-gray-500">
        <div className="flex gap-3">
          {props.priceUsd > 0 && <span>Price: ${props.priceUsd.toFixed(4)}</span>}
          {props.liquidityUsd > 0 && <span>Liq: ${Math.round(props.liquidityUsd).toLocaleString()}</span>}
        </div>
        <div className="flex gap-2">
          {props.lpInvested && (
            <span className="text-emerald-400">LP: {props.lpInvested} USDT</span>
          )}
          {props.txHash && (
            <a
              href={`https://www.okx.com/web3/explorer/xlayer/tx/${props.txHash}`}
              target="_blank"
              rel="noopener"
              className="text-emerald-500 hover:underline"
            >
              on-chain ↗
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function getTimeAgo(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}
```

- [ ] **Step 2: Create threat-stats.tsx**

Create `web/src/components/threat-stats.tsx`:

```tsx
"use client";

interface ThreatStatsProps {
  totalScanned: number;
  totalDangerous: number;
  totalLpInvested: number;
  agentsActive: number;
}

export function ThreatStats({ totalScanned, totalDangerous, totalLpInvested, agentsActive }: ThreatStatsProps) {
  return (
    <div className="grid grid-cols-4 gap-4">
      {[
        { label: "Scanned", value: totalScanned, icon: "🔍" },
        { label: "Threats", value: totalDangerous, icon: "⚠️" },
        { label: "LP P&L", value: `$${totalLpInvested.toFixed(2)}`, icon: "💰" },
        { label: "Agents", value: `${agentsActive} active`, icon: "🤖" },
      ].map((stat) => (
        <div key={stat.label} className="rounded-xl border border-gray-800 bg-gray-900/50 p-4">
          <div className="flex items-center gap-2 mb-1">
            <span>{stat.icon}</span>
            <span className="text-xs text-gray-500">{stat.label}</span>
          </div>
          <p className="text-2xl font-bold text-white">{stat.value}</p>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Rewrite page.tsx as Threat Feed**

Replace `web/src/app/page.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { VerdictCard } from "../components/verdict-card";
import { ThreatStats } from "../components/threat-stats";
import { LiveFeed } from "../components/live-feed";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002";

interface Verdict {
  token: string;
  tokenName: string;
  tokenSymbol: string;
  riskScore: number;
  verdict: "SAFE" | "CAUTION" | "DANGEROUS";
  risks: string[];
  priceUsd: number;
  liquidityUsd: number;
  lpInvested?: string;
  timestamp: number;
  txHash?: string;
}

interface Stats {
  totalScanned: number;
  totalSafe: number;
  totalCaution: number;
  totalDangerous: number;
  totalLpInvested: number;
}

export default function SentinelPage() {
  const [verdicts, setVerdicts] = useState<Verdict[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    const fetchData = () => {
      fetch(`${API_URL}/api/verdicts?limit=30`).then((r) => r.json()).then((d) => setVerdicts(d.verdicts || [])).catch(() => {});
      fetch(`${API_URL}/api/stats`).then((r) => r.json()).then(setStats).catch(() => {});
    };
    fetchData();
    const interval = setInterval(fetchData, 10_000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-white">
          🛡️ Sentinel
        </h1>
        <p className="mt-2 text-gray-400">
          Autonomous security oracle on X Layer — skin in the game
        </p>
      </div>

      {stats && (
        <ThreatStats
          totalScanned={stats.totalScanned}
          totalDangerous={stats.totalDangerous}
          totalLpInvested={stats.totalLpInvested}
          agentsActive={3}
        />
      )}

      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-white">Threat Feed</h2>
        {verdicts.length === 0 && (
          <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-8 text-center text-gray-500">
            Sentinel is scanning... verdicts will appear here in real-time.
          </div>
        )}
        {verdicts.map((v, i) => (
          <VerdictCard key={`${v.token}-${i}`} {...v} />
        ))}
      </div>

      <LiveFeed />
    </div>
  );
}
```

- [ ] **Step 4: Update layout.tsx nav**

In `web/src/app/layout.tsx`, change navigation links from Marketplace/Dashboard to just the single page. Update title to "Sentinel — Security Oracle on X Layer".

- [ ] **Step 5: Update live-feed.tsx colors for Sentinel agents**

Update `AGENT_COLORS` in `web/src/components/live-feed.tsx`:

```typescript
const AGENT_COLORS: Record<string, string> = {
  Scanner: "text-blue-400",
  Analyst: "text-purple-400",
  Executor: "text-emerald-400",
  Sentinel: "text-yellow-400",
  Cron: "text-gray-400",
};
```

Add verdict icon: `verdict: "🛡️"` and `invest: "💰"`.

- [ ] **Step 6: Build and commit**

Run: `cd ~/Projects/agentra/web && npm run build`

```bash
cd ~/Projects/agentra
git add web/src/
git commit -m "feat(web): Sentinel Threat Feed dashboard with verdict cards and stats"
```

---

## Task 7: Claude Code Skill (5 commands)

**Files:**
- Modify: `skill/SKILL.md` (rewrite)
- Modify: `skill/plugin.json`
- Create: `skill/skills/scan/SKILL.md`
- Create: `skill/skills/feed/SKILL.md`
- Create: `skill/skills/report/SKILL.md`
- Create: `skill/skills/portfolio/SKILL.md`
- Create: `skill/skills/status/SKILL.md`
- Delete: old skill files (register, buy, analyze, swap, pools, invest, dashboard, autopilot)

- [ ] **Step 1: Update plugin.json**

```json
{
  "name": "sentinel",
  "version": "1.0.0",
  "description": "Autonomous security oracle on X Layer — monitors tokens, publishes on-chain verdicts, invests in safe tokens via Uniswap LP. Skin in the game.",
  "author": "sentinel",
  "license": "MIT",
  "skills": [
    "skills/scan",
    "skills/feed",
    "skills/report",
    "skills/portfolio",
    "skills/status"
  ],
  "dependencies": [
    "okx/onchainos-skills",
    "Uniswap/uniswap-ai"
  ]
}
```

- [ ] **Step 2: Rewrite SKILL.md and create all 5 skill files**

Each skill file should include description, parameters, step-by-step OnchainOS commands, and example output. Reference the API endpoints and contract addresses.

- [ ] **Step 3: Delete old skill files, commit**

```bash
cd ~/Projects/agentra
rm -rf skill/skills/register skill/skills/buy skill/skills/analyze skill/skills/swap skill/skills/pools skill/skills/invest skill/skills/dashboard skill/skills/autopilot
git add skill/
git commit -m "feat(skill): Sentinel skill with 5 security-focused commands"
```

---

## Task 8: README + AGENTS.md Update

**Files:**
- Modify: `README.md` (rewrite for Sentinel concept)
- Modify: `AGENTS.md` (update for Scanner/Analyst/Executor)

- [ ] **Step 1: Rewrite README.md**

Replace with Sentinel concept: security oracle, skin in the game narrative, architecture diagram, deployed contracts, OnchainOS skills list, Uniswap integration, 5 skill commands, setup instructions.

- [ ] **Step 2: Update AGENTS.md**

Replace agent descriptions: Scanner (discovery), Analyst (security + verdicts), Executor (LP investment).

- [ ] **Step 3: Commit and push**

```bash
git add README.md AGENTS.md
git commit -m "docs: rewrite for Sentinel security oracle concept"
git push
```

---

## Task 9: Tests

**Files:**
- Update: `server/__tests__/` — ensure all tests pass with new agents

- [ ] **Step 1: Create combined test file**

Create `server/__tests__/sentinel.test.ts` testing:
- Scanner: discovers tokens, deduplicates, emits events
- Analyst: deep scan returns Verdict, publishes on-chain, stores verdict
- Executor: invests in safe token, tracks portfolio
- VerdictStore: add, getRecent, getByToken, isScanned, getStats
- API: /verdicts returns list, /stats returns counts

- [ ] **Step 2: Run all tests**

Run: `cd ~/Projects/agentra/server && npx vitest run`

- [ ] **Step 3: Commit**

```bash
git add server/__tests__/
git commit -m "test: Sentinel agent tests and verdict store tests"
```

---

## Dependency Graph

```
Task 1 (VerdictRegistry + store)
  ├── Task 2 (Scanner) — parallel
  ├── Task 3 (Analyst) — needs Task 1
  └── Task 4 (Executor) — parallel with 2-3
        └── Task 5 (Decision Engine + Cron + Index) — needs 2,3,4
              ├── Task 6 (Web Dashboard) — needs 5
              └── Task 7 (Skill) — parallel with 6
                    └── Task 8 (README) — needs 6,7
                          └── Task 9 (Tests) — needs all
```
