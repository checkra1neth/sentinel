import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock config — must be before agent imports
// ---------------------------------------------------------------------------

vi.mock("../src/config.js", () => ({
  config: {
    xlayerRpcUrl: "https://rpc.xlayer.tech",
    chainId: 196,
    contracts: {
      registry: "0x0000000000000000000000000000000000000001",
      escrow: "0x0000000000000000000000000000000000000002",
      treasury: "0x0000000000000000000000000000000000000003",
      usdt: "0x1E4a5963aBFD975d8c9021ce480b42188849D41d",
    },
    okx: {
      apiKey: "test-key",
      secretKey: "test-secret",
      passphrase: "test-pass",
    },
    wallets: {
      analyst: { accountId: "0", address: "0x0000000000000000000000000000000000000010" },
      auditor: { accountId: "1", address: "0x0000000000000000000000000000000000000020" },
      trader: { accountId: "2", address: "0x0000000000000000000000000000000000000030" },
    },
    cron: { analystInterval: "*/30 * * * *", reinvestInterval: "0 */6 * * *" },
    port: 3000,
  },
}));

// ---------------------------------------------------------------------------
// Mock child_process (onchainos CLI calls)
// ---------------------------------------------------------------------------

vi.mock("child_process", () => ({
  execSync: vi.fn((_cmd: string) => {
    const cmd = _cmd as string;

    // Scanner sources
    if (cmd.includes("trenches tokens") && cmd.includes("NEW")) {
      return JSON.stringify([
        { tokenAddress: "0xaaa111", name: "NewToken1" },
        { tokenAddress: "0xbbb222", name: "NewToken2" },
      ]);
    }

    if (cmd.includes("trenches tokens") && cmd.includes("MIGRATED")) {
      return JSON.stringify([
        { tokenAddress: "0xccc333", name: "MigratedToken" },
        { tokenAddress: "0xaaa111", name: "NewToken1-dup" }, // duplicate
      ]);
    }

    if (cmd.includes("signal activities")) {
      return JSON.stringify([
        { token: "0xddd444", name: "SmartMoneyPick" },
      ]);
    }

    if (cmd.includes("token hot-tokens")) {
      return JSON.stringify([
        { address: "0xeee555", name: "HotToken" },
        { address: "0xbbb222", name: "HotDup" }, // duplicate
      ]);
    }

    // Analyst price info
    if (cmd.includes("token price-info")) {
      return JSON.stringify({
        name: "TestToken",
        symbol: "TST",
        priceUsd: 1.23,
        price: 1.23,
        marketCap: 1000000,
        volume24h: 50000,
      });
    }

    // Analyst security scan — honeypot token
    if (cmd.includes("security token-scan")) {
      return JSON.stringify({
        isHoneypot: true,
        isProxy: false,
        isMintable: true,
        buyTax: "0",
        sellTax: "0",
        isOpenSource: true,
        riskLevel: "high",
      });
    }

    // Analyst dev info — rug history
    if (cmd.includes("trenches dev-info")) {
      return JSON.stringify({
        rugHistory: true,
        hasRug: true,
        rugs: [{ date: "2025-01-01" }],
      });
    }

    // Analyst advanced info
    if (cmd.includes("token advanced-info")) {
      return JSON.stringify({
        name: "TestToken",
        symbol: "TST",
        topHolderPercent: 80,
        holderConcentration: 80,
      });
    }

    // Liquidity
    if (cmd.includes("token liquidity")) {
      return JSON.stringify([
        { poolAddress: "0xpool1", tvlUsd: 100000 },
      ]);
    }

    // DeFi search
    if (cmd.includes("defi search")) {
      return JSON.stringify([
        { id: "uniswap-v3-pool-1", type: "lp", protocol: "uniswap", symbol: "TST/USDT", poolAddress: "0xpool1" },
      ]);
    }

    // DeFi invest
    if (cmd.includes("defi invest")) {
      return JSON.stringify({ txHash: "0x" + "b".repeat(64), success: true });
    }

    // Swap execute
    if (cmd.includes("swap execute")) {
      return JSON.stringify({ txHash: "0x" + "c".repeat(64) });
    }

    // Wallet switch
    if (cmd.includes("wallet switch-account")) {
      return JSON.stringify({ success: true });
    }

    // Default
    return "{}";
  }),
}));

// ---------------------------------------------------------------------------
// Mock OKX API
// ---------------------------------------------------------------------------

vi.mock("../src/lib/okx-api.js", () => ({
  okxTokenSecurity: vi.fn().mockResolvedValue(null),
  okxSwapQuote: vi.fn().mockResolvedValue(null),
  okxSwapData: vi.fn().mockResolvedValue(null),
  okxWeb3Get: vi.fn().mockResolvedValue({ data: [] }),
  okxWeb3Post: vi.fn().mockResolvedValue({ data: [] }),
}));

// ---------------------------------------------------------------------------
// Mock Uniswap — getPool returns zero address (no pool)
// ---------------------------------------------------------------------------

vi.mock("../src/lib/uniswap.js", () => ({
  getPool: vi.fn().mockResolvedValue("0x0000000000000000000000000000000000000000"),
  getPoolInfo: vi.fn().mockResolvedValue(null),
  encodeSwapCalldata: vi.fn().mockReturnValue("0x"),
  UNISWAP_ROUTER: "0x7078c4537C04c2b2E52ddBa06074dBdACF23cA15",
  POSITION_MANAGER: "0xC36442b4a4522E871399CD717aBDD847Ab11FE88",
  FACTORY: "0x1F98431c8aD98523631AE4a59f267346ea31F984",
  routerAbi: [],
  poolAbi: [],
  factoryAbi: [],
}));

// ---------------------------------------------------------------------------
// Mock viem — createPublicClient returns stub
// ---------------------------------------------------------------------------

vi.mock("viem", async () => {
  const actual = await vi.importActual<Record<string, unknown>>("viem");
  return {
    ...actual,
    createPublicClient: vi.fn().mockReturnValue({
      getCode: vi.fn().mockResolvedValue("0x6080604052"),
      readContract: vi.fn().mockResolvedValue(null),
    }),
    http: vi.fn().mockReturnValue({}),
  };
});

// ---------------------------------------------------------------------------
// Mock verdict-registry (on-chain publish)
// ---------------------------------------------------------------------------

vi.mock("../src/contracts/verdict-registry.js", () => ({
  publishVerdictOnChain: vi.fn().mockResolvedValue(true),
  getVerdictCount: vi.fn().mockResolvedValue(0n),
}));

// ---------------------------------------------------------------------------
// Mock verdict-store — use real implementation
// ---------------------------------------------------------------------------

// We use the real verdictStore but clear it between tests
import { verdictStore } from "../src/verdicts/verdict-store.js";

// ---------------------------------------------------------------------------
// Imports (after all mocks)
// ---------------------------------------------------------------------------

import { ScannerAgent } from "../src/agents/scanner-agent.js";
import { AnalystAgent } from "../src/agents/analyst-agent.js";
import { ExecutorAgent } from "../src/agents/executor-agent.js";
import { AgenticWallet } from "../src/wallet/agentic-wallet.js";
import { publishVerdictOnChain } from "../src/contracts/verdict-registry.js";
import type { Address } from "viem";

// ---------------------------------------------------------------------------
// Wallet factory
// ---------------------------------------------------------------------------

function makeWallet(role: string, address: Address): AgenticWallet {
  return new AgenticWallet("0", address, role);
}

// ===========================================================================
// Scanner Agent
// ===========================================================================

describe("ScannerAgent", () => {
  const wallet = makeWallet("scanner", "0x0000000000000000000000000000000000000010");
  let agent: ScannerAgent;

  beforeEach(() => {
    agent = new ScannerAgent(wallet);
    verdictStore.clear();
  });

  it("discovers tokens from all sources", async () => {
    const candidates = (await agent.execute("discover", {})) as Array<{
      address: string;
      source: string;
      name?: string;
    }>;

    expect(Array.isArray(candidates)).toBe(true);
    expect(candidates.length).toBeGreaterThan(0);

    // Check sources are present
    const sources = new Set(candidates.map((c) => c.source));
    expect(sources.has("trenches_new")).toBe(true);
    expect(sources.has("trenches_migrated")).toBe(true);
    expect(sources.has("smart_money")).toBe(true);
    expect(sources.has("hot_tokens")).toBe(true);
  });

  it("deduplicates by lowercase address", async () => {
    const candidates = (await agent.execute("discover", {})) as Array<{
      address: string;
      source: string;
    }>;

    const addresses = candidates.map((c) => c.address);
    const unique = new Set(addresses);
    expect(addresses.length).toBe(unique.size);
  });

  it("autonomousLoop filters already-scanned tokens", async () => {
    // Mark one token as scanned
    verdictStore.add({
      token: "0xaaa111",
      tokenName: "Already Scanned",
      tokenSymbol: "AS",
      riskScore: 0,
      verdict: "SAFE",
      isHoneypot: false,
      hasRug: false,
      hasMint: false,
      isProxy: false,
      buyTax: 0,
      sellTax: 0,
      holderConcentration: 0,
      risks: [],
      priceUsd: 0,
      marketCap: 0,
      liquidityUsd: 0,
      timestamp: Date.now(),
    });

    const newTokens = await agent.autonomousLoop();
    const newAddrs = (newTokens as Array<{ address: string }>).map(
      (t) => t.address,
    );

    expect(newAddrs).not.toContain("0xaaa111");
    expect(newAddrs.length).toBeGreaterThan(0);
  });

  it("shouldBuyService returns true for analyst", () => {
    expect(agent.shouldBuyService("analyst")).toBe(true);
  });

  it("shouldBuyService returns false for other types", () => {
    expect(agent.shouldBuyService("executor")).toBe(false);
    expect(agent.shouldBuyService("scanner")).toBe(false);
  });

  it("throws on unknown action", async () => {
    await expect(agent.execute("unknown", {})).rejects.toThrow(
      "Unknown action: unknown",
    );
  });
});

// ===========================================================================
// Analyst Agent
// ===========================================================================

describe("AnalystAgent", () => {
  const wallet = makeWallet("analyst", "0x0000000000000000000000000000000000000010");
  let agent: AnalystAgent;

  beforeEach(() => {
    agent = new AnalystAgent(wallet);
    verdictStore.clear();
    vi.clearAllMocks();
  });

  it("deepScan returns Verdict with riskScore and risks", async () => {
    const verdict = (await agent.execute("scan", {
      token: "0xABCDABCDABCDABCDABCDABCDABCDABCDABCDABCD",
    })) as Record<string, unknown>;

    expect(verdict).toHaveProperty("token");
    expect(verdict).toHaveProperty("tokenName");
    expect(verdict).toHaveProperty("tokenSymbol");
    expect(verdict).toHaveProperty("riskScore");
    expect(verdict).toHaveProperty("verdict");
    expect(verdict).toHaveProperty("isHoneypot");
    expect(verdict).toHaveProperty("hasRug");
    expect(verdict).toHaveProperty("hasMint");
    expect(verdict).toHaveProperty("isProxy");
    expect(verdict).toHaveProperty("risks");
    expect(verdict).toHaveProperty("priceUsd");
    expect(verdict).toHaveProperty("marketCap");
    expect(verdict).toHaveProperty("liquidityUsd");
    expect(verdict).toHaveProperty("timestamp");

    expect(typeof verdict.riskScore).toBe("number");
    expect(Array.isArray(verdict.risks)).toBe(true);
    expect(["SAFE", "CAUTION", "DANGEROUS"]).toContain(verdict.verdict);
  });

  it("detects honeypot + rug + mint = DANGEROUS", async () => {
    const verdict = (await agent.execute("scan", {
      token: "0xABCDABCDABCDABCDABCDABCDABCDABCDABCDABCD",
    })) as Record<string, unknown>;

    // Our mock returns honeypot=true, mintable=true, rugHistory=true, concentration=80%
    expect(verdict.isHoneypot).toBe(true);
    expect(verdict.hasRug).toBe(true);
    expect(verdict.hasMint).toBe(true);
    expect(verdict.verdict).toBe("DANGEROUS");
    expect((verdict.riskScore as number)).toBeGreaterThanOrEqual(100);

    const risks = verdict.risks as string[];
    expect(risks).toContain("honeypot");
    expect(risks).toContain("rug_history");
    expect(risks).toContain("mint");
    expect(risks).toContain("concentrated_holders");
  });

  it("publishes verdict on-chain", async () => {
    await agent.execute("scan", {
      token: "0xABCDABCDABCDABCDABCDABCDABCDABCDABCDABCD",
    });

    expect(publishVerdictOnChain).toHaveBeenCalledTimes(1);
  });

  it("stores verdict in verdictStore", async () => {
    const token = "0xABCDABCDABCDABCDABCDABCDABCDABCDABCDABCD";
    await agent.execute("scan", { token });

    const stored = verdictStore.getByToken(token);
    expect(stored).toBeDefined();
    expect(stored?.token).toBe(token);
  });

  it("report action returns cached verdict if available", async () => {
    const token = "0xABCDABCDABCDABCDABCDABCDABCDABCDABCDABCD";

    // First scan
    const v1 = (await agent.execute("scan", { token })) as Record<string, unknown>;

    // Report should return cached
    const v2 = (await agent.execute("report", { token })) as Record<string, unknown>;

    expect(v2.timestamp).toBe(v1.timestamp);
  });

  it("shouldBuyService returns false", () => {
    expect(agent.shouldBuyService("scanner")).toBe(false);
    expect(agent.shouldBuyService("executor")).toBe(false);
  });

  it("throws on unknown action", async () => {
    await expect(agent.execute("unknown", {})).rejects.toThrow(
      "Unknown action: unknown",
    );
  });
});

// ===========================================================================
// Executor Agent
// ===========================================================================

describe("ExecutorAgent", () => {
  const wallet = makeWallet("executor", "0x0000000000000000000000000000000000000030");
  let agent: ExecutorAgent;

  beforeEach(() => {
    agent = new ExecutorAgent(wallet);
    verdictStore.clear();
  });

  it("invest returns success via DeFi LP path", async () => {
    const result = (await agent.execute("invest", {
      token: "0xABCDABCDABCDABCDABCDABCDABCDABCDABCDABCD",
      amount: "50",
    })) as Record<string, unknown>;

    expect(result.success).toBe(true);
    expect(result.token).toBe("0xABCDABCDABCDABCDABCDABCDABCDABCDABCDABCD");
    expect(result.amount).toBe("50");
    expect(["defi_lp", "swap"]).toContain(result.method);
  });

  it("tracks portfolio after investment", async () => {
    await agent.execute("invest", {
      token: "0xABCDABCDABCDABCDABCDABCDABCDABCDABCDABCD",
      amount: "25",
    });

    const portfolio = (await agent.execute("portfolio", {})) as {
      positions: Array<Record<string, unknown>>;
      totalInvested: number;
    };

    expect(portfolio.positions.length).toBe(1);
    expect(portfolio.totalInvested).toBe(25);
    expect(portfolio.positions[0].token).toBe(
      "0xABCDABCDABCDABCDABCDABCDABCDABCDABCDABCD",
    );
  });

  it("portfolio returns empty when no investments", async () => {
    const portfolio = (await agent.execute("portfolio", {})) as {
      positions: Array<Record<string, unknown>>;
      totalInvested: number;
    };

    expect(portfolio.positions.length).toBe(0);
    expect(portfolio.totalInvested).toBe(0);
  });

  it("shouldBuyService returns false for all types", () => {
    expect(agent.shouldBuyService("analyst")).toBe(false);
    expect(agent.shouldBuyService("scanner")).toBe(false);
    expect(agent.shouldBuyService("executor")).toBe(false);
  });

  it("throws on unknown action", async () => {
    await expect(agent.execute("unknown", {})).rejects.toThrow(
      "Unknown action: unknown",
    );
  });
});
