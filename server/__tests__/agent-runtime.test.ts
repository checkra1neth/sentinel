import { describe, it, expect } from "vitest";
import { AnalystAgent } from "../src/agents/analyst-agent.js";
import { AuditorAgent } from "../src/agents/auditor-agent.js";
import { TraderAgent } from "../src/agents/trader-agent.js";

describe("AnalystAgent", () => {
  const agent = new AnalystAgent("0x0000000000000000000000000000000000000010");

  it("executes token-report action", async () => {
    const result = await agent.execute("token-report", { token: "OKB" });
    expect(result).toHaveProperty("token", "OKB");
    expect(result).toHaveProperty("riskScore");
    expect(result).toHaveProperty("marketCap");
    expect(result).toHaveProperty("volume24h");
    expect(result).toHaveProperty("recommendation");
    expect(typeof result.riskScore).toBe("number");
  });

  it("throws on unknown action", async () => {
    await expect(agent.execute("unknown", {})).rejects.toThrow(
      "Unknown action: unknown",
    );
  });

  it("shouldBuyService returns true for auditor", () => {
    expect(agent.shouldBuyService("auditor")).toBe(true);
  });

  it("shouldBuyService returns false for other types", () => {
    expect(agent.shouldBuyService("trader")).toBe(false);
  });
});

describe("AuditorAgent", () => {
  const agent = new AuditorAgent("0x0000000000000000000000000000000000000020");

  it("executes quick-scan action", async () => {
    const result = await agent.execute("quick-scan", {
      contract: "0x1234567890abcdef1234567890abcdef12345678",
    });
    expect(result).toHaveProperty("contract");
    expect(result).toHaveProperty("riskScore");
    expect(result).toHaveProperty("issues");
    expect(result).toHaveProperty("verified");
    expect(Array.isArray(result.issues)).toBe(true);
  });

  it("throws on unknown action", async () => {
    await expect(agent.execute("unknown", {})).rejects.toThrow(
      "Unknown action: unknown",
    );
  });

  it("shouldBuyService returns false by default", () => {
    expect(agent.shouldBuyService("analyst")).toBe(false);
    expect(agent.shouldBuyService("trader")).toBe(false);
  });
});

describe("TraderAgent", () => {
  const agent = new TraderAgent("0x0000000000000000000000000000000000000030");

  it("executes swap action", async () => {
    const result = await agent.execute("swap", {
      fromToken: "USDT",
      toToken: "OKB",
      fromAmount: "100",
    });
    expect(result).toHaveProperty("fromToken", "USDT");
    expect(result).toHaveProperty("toToken", "OKB");
    expect(result).toHaveProperty("fromAmount", "100");
    expect(result).toHaveProperty("toAmount");
    expect(result).toHaveProperty("txHash");
    expect(result.txHash).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it("throws on unknown action", async () => {
    await expect(agent.execute("unknown", {})).rejects.toThrow(
      "Unknown action: unknown",
    );
  });

  it("shouldBuyService returns true for analyst", () => {
    expect(agent.shouldBuyService("analyst")).toBe(true);
  });

  it("shouldBuyService returns false for other types", () => {
    expect(agent.shouldBuyService("auditor")).toBe(false);
  });
});
