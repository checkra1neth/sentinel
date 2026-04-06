import { describe, it, expect, beforeEach } from "vitest";
import { verdictStore } from "../src/verdicts/verdict-store.js";
import type { Verdict } from "../src/types.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeVerdict(overrides: Partial<Verdict> = {}): Verdict {
  return {
    token: "0x1234567890abcdef1234567890abcdef12345678",
    tokenName: "TestToken",
    tokenSymbol: "TST",
    riskScore: 25,
    verdict: "SAFE",
    isHoneypot: false,
    hasRug: false,
    hasMint: false,
    isProxy: false,
    buyTax: 0,
    sellTax: 0,
    holderConcentration: 5,
    risks: [],
    priceUsd: 1.0,
    marketCap: 1_000_000,
    liquidityUsd: 500_000,
    timestamp: Date.now(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("VerdictStore", () => {
  beforeEach(() => {
    verdictStore.clear();
  });

  it("add() stores verdict and marks as scanned", () => {
    const v = makeVerdict();
    verdictStore.add(v);

    expect(verdictStore.isScanned(v.token)).toBe(true);
    expect(verdictStore.getRecent(10)).toHaveLength(1);
    expect(verdictStore.getRecent(10)[0]).toEqual(v);
  });

  it("isScanned() returns false for unknown tokens", () => {
    expect(verdictStore.isScanned("0xunknown")).toBe(false);
  });

  it("isScanned() is case-insensitive", () => {
    verdictStore.add(makeVerdict({ token: "0xABCDef" }));
    expect(verdictStore.isScanned("0xabcdef")).toBe(true);
    expect(verdictStore.isScanned("0xABCDEF")).toBe(true);
  });

  it("getRecent() returns correct limit", () => {
    for (let i = 0; i < 10; i++) {
      verdictStore.add(
        makeVerdict({ token: `0x${i.toString().padStart(40, "0")}` }),
      );
    }

    const recent = verdictStore.getRecent(3);
    expect(recent).toHaveLength(3);
  });

  it("getRecent() returns newest first", () => {
    verdictStore.add(makeVerdict({ tokenName: "First" }));
    verdictStore.add(makeVerdict({ tokenName: "Second" }));
    verdictStore.add(makeVerdict({ tokenName: "Third" }));

    const recent = verdictStore.getRecent(10);
    expect(recent[0].tokenName).toBe("Third");
    expect(recent[1].tokenName).toBe("Second");
    expect(recent[2].tokenName).toBe("First");
  });

  it("getByToken() finds correct verdict", () => {
    const target = makeVerdict({
      token: "0xAAAA0000000000000000000000000000000000AA",
      tokenName: "Target",
    });
    verdictStore.add(makeVerdict({ token: "0x1111000000000000000000000000000000000011" }));
    verdictStore.add(target);
    verdictStore.add(makeVerdict({ token: "0x2222000000000000000000000000000000000022" }));

    const found = verdictStore.getByToken(
      "0xAAAA0000000000000000000000000000000000AA",
    );
    expect(found).toBeDefined();
    expect(found!.tokenName).toBe("Target");
  });

  it("getByToken() is case-insensitive", () => {
    verdictStore.add(
      makeVerdict({
        token: "0xABCD0000000000000000000000000000000000EF",
        tokenName: "CaseTest",
      }),
    );

    const found = verdictStore.getByToken(
      "0xabcd0000000000000000000000000000000000ef",
    );
    expect(found).toBeDefined();
    expect(found!.tokenName).toBe("CaseTest");
  });

  it("getByToken() returns undefined for missing token", () => {
    expect(verdictStore.getByToken("0xmissing")).toBeUndefined();
  });

  it("getStats() aggregates correctly", () => {
    verdictStore.add(makeVerdict({ verdict: "SAFE" }));
    verdictStore.add(makeVerdict({ verdict: "SAFE", token: "0xa" }));
    verdictStore.add(makeVerdict({ verdict: "CAUTION", token: "0xb" }));
    verdictStore.add(makeVerdict({ verdict: "DANGEROUS", token: "0xc" }));
    verdictStore.add(
      makeVerdict({ verdict: "DANGEROUS", token: "0xd", lpInvested: "100" }),
    );

    const stats = verdictStore.getStats();
    expect(stats.totalScanned).toBe(5);
    expect(stats.totalSafe).toBe(2);
    expect(stats.totalCaution).toBe(1);
    expect(stats.totalDangerous).toBe(2);
    expect(stats.totalLpInvested).toBe(100);
  });

  it("getStats() returns zeros when empty", () => {
    const stats = verdictStore.getStats();
    expect(stats.totalScanned).toBe(0);
    expect(stats.totalSafe).toBe(0);
    expect(stats.totalCaution).toBe(0);
    expect(stats.totalDangerous).toBe(0);
    expect(stats.totalLpInvested).toBe(0);
    expect(stats.lpPnl).toBe(0);
  });
});
