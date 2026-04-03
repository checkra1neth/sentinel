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

    if (cmd.includes("token price-info")) {
      return JSON.stringify({
        name: "TestToken",
        symbol: "TST",
        priceUsd: 1.23,
        marketCap: 1000000,
        volume24h: 50000,
      });
    }

    if (cmd.includes("security token-scan")) {
      return JSON.stringify({
        isHoneypot: false,
        isProxy: false,
        isMintable: false,
        buyTax: "0",
        sellTax: "0",
        isOpenSource: true,
        riskLevel: "low",
      });
    }

    if (cmd.includes("token advanced-info")) {
      return JSON.stringify({
        name: "TestToken",
        symbol: "TST",
        devActivity: "active",
      });
    }

    if (cmd.includes("token liquidity")) {
      return JSON.stringify([
        { poolAddress: "0xabc", tokenA: "0x111", tokenB: "0x222", tvlUsd: 100000 },
      ]);
    }

    if (cmd.includes("token hot-tokens")) {
      return JSON.stringify([
        { address: "0xAAA", name: "Hot1" },
        { address: "0xBBB", name: "Hot2" },
        { address: "0xCCC", name: "Hot3" },
      ]);
    }

    if (cmd.includes("signal activities")) {
      return JSON.stringify([
        { wallet: "0xWhale", action: "buy", token: "0xAAA" },
      ]);
    }

    if (cmd.includes("swap quote")) {
      return JSON.stringify({
        toAmount: "1500000",
        outputAmount: "1500000",
        estimatedGas: "150000",
      });
    }

    if (cmd.includes("swap execute")) {
      return JSON.stringify({ txHash: "0x" + "a".repeat(64) });
    }

    if (cmd.includes("wallet switch-account")) {
      return JSON.stringify({ success: true });
    }

    // Default: return empty JSON
    return "{}";
  }),
}));

// ---------------------------------------------------------------------------
// Mock OKX API — return null for all
// ---------------------------------------------------------------------------

vi.mock("../src/lib/okx-api.js", () => ({
  okxTokenSecurity: vi.fn().mockResolvedValue(null),
  okxSwapQuote: vi.fn().mockResolvedValue(null),
  okxSwapData: vi.fn().mockResolvedValue(null),
  okxWeb3Get: vi.fn().mockResolvedValue({ data: [] }),
  okxWeb3Post: vi.fn().mockResolvedValue({ data: [] }),
}));

// ---------------------------------------------------------------------------
// Mock Uniswap — getPool returns null (no pool)
// ---------------------------------------------------------------------------

vi.mock("../src/lib/uniswap.js", () => ({
  getPool: vi.fn().mockResolvedValue(null),
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
// Mock viem — createPublicClient returns stub with getCode
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
// Imports (after all mocks)
// ---------------------------------------------------------------------------

import { AnalystAgent } from "../src/agents/analyst-agent.js";
import { AuditorAgent } from "../src/agents/auditor-agent.js";
import { TraderAgent } from "../src/agents/trader-agent.js";
import { AgenticWallet } from "../src/wallet/agentic-wallet.js";
import type { Address } from "viem";

// ---------------------------------------------------------------------------
// Wallet factory for tests
// ---------------------------------------------------------------------------

function makeWallet(role: string, address: Address): AgenticWallet {
  return new AgenticWallet("0", address, role);
}

// ===========================================================================
// Analyst Agent
// ===========================================================================

describe("AnalystAgent", () => {
  const wallet = makeWallet("analyst", "0x0000000000000000000000000000000000000010");
  const agent = new AnalystAgent(wallet);

  it("token-report returns structured AnalysisResult", async () => {
    const result = (await agent.execute("token-report", {
      token: "0xABCDABCDABCDABCDABCDABCDABCDABCDABCDABCD",
    })) as Record<string, unknown>;

    expect(result).toHaveProperty("token");
    expect(result).toHaveProperty("name");
    expect(result).toHaveProperty("symbol");
    expect(result).toHaveProperty("priceUsd");
    expect(result).toHaveProperty("marketCap");
    expect(result).toHaveProperty("volume24h");
    expect(result).toHaveProperty("riskScore");
    expect(result).toHaveProperty("risks");
    expect(result).toHaveProperty("recommendation");
    expect(result).toHaveProperty("securityScan");
    expect(result).toHaveProperty("liquidityPools");
    expect(result).toHaveProperty("timestamp");

    expect(typeof result.riskScore).toBe("number");
    expect(Array.isArray(result.risks)).toBe(true);
    expect(["AVOID", "CAUTION", "LOW_RISK", "OPPORTUNITY"]).toContain(result.recommendation);
  });

  it("trending returns smartMoney and hotTokens", async () => {
    const result = (await agent.execute("trending", {})) as Record<string, unknown>;

    expect(result).toHaveProperty("smartMoney");
    expect(result).toHaveProperty("hotTokens");
    expect(result).toHaveProperty("timestamp");
  });

  it("throws on unknown action", async () => {
    await expect(agent.execute("unknown", {})).rejects.toThrow("Unknown action: unknown");
  });

  it("shouldBuyService returns true for auditor and trader", () => {
    expect(agent.shouldBuyService("auditor")).toBe(true);
    expect(agent.shouldBuyService("trader")).toBe(true);
  });

  it("shouldBuyService returns false for unknown types", () => {
    expect(agent.shouldBuyService("other")).toBe(false);
  });
});

// ===========================================================================
// Auditor Agent
// ===========================================================================

describe("AuditorAgent", () => {
  const wallet = makeWallet("auditor", "0x0000000000000000000000000000000000000020");
  const agent = new AuditorAgent(wallet);

  it("quick-scan returns structured AuditResult", async () => {
    const result = (await agent.execute("quick-scan", {
      contract: "0xABCDABCDABCDABCDABCDABCDABCDABCDABCDABCD",
    })) as Record<string, unknown>;

    expect(result).toHaveProperty("contract");
    expect(result).toHaveProperty("contractType");
    expect(result).toHaveProperty("bytecodeSize");
    expect(result).toHaveProperty("riskScore");
    expect(result).toHaveProperty("verdict");
    expect(result).toHaveProperty("issues");
    expect(result).toHaveProperty("securityScan");
    expect(result).toHaveProperty("timestamp");

    expect(typeof result.riskScore).toBe("number");
    expect(["CLEAN", "LOW_RISK", "CAUTION", "DANGEROUS"]).toContain(result.verdict);
    expect(Array.isArray(result.issues)).toBe(true);
  });

  it("throws on unknown action", async () => {
    await expect(agent.execute("unknown", {})).rejects.toThrow("Unknown action: unknown");
  });

  it("shouldBuyService returns false for all types", () => {
    expect(agent.shouldBuyService("analyst")).toBe(false);
    expect(agent.shouldBuyService("trader")).toBe(false);
    expect(agent.shouldBuyService("auditor")).toBe(false);
  });
});

// ===========================================================================
// Trader Agent
// ===========================================================================

describe("TraderAgent", () => {
  const wallet = makeWallet("trader", "0x0000000000000000000000000000000000000030");
  const agent = new TraderAgent(wallet);

  it("swap returns structured TradeResult", async () => {
    const result = (await agent.execute("swap", {
      fromToken: "USDT",
      toToken: "OKB",
      amount: "100",
    })) as Record<string, unknown>;

    expect(result).toHaveProperty("bestRoute");
    expect(result).toHaveProperty("alternativeRoutes");
    expect(result).toHaveProperty("status");
    expect(result).toHaveProperty("timestamp");

    expect(["QUOTE_READY", "EXECUTED", "QUOTE_FAILED"]).toContain(result.status);
  });

  it("throws on unknown action", async () => {
    await expect(agent.execute("unknown", {})).rejects.toThrow("Unknown action: unknown");
  });

  it("shouldBuyService returns true for analyst", () => {
    expect(agent.shouldBuyService("analyst")).toBe(true);
  });

  it("shouldBuyService returns false for other types", () => {
    expect(agent.shouldBuyService("auditor")).toBe(false);
    expect(agent.shouldBuyService("other")).toBe(false);
  });
});
