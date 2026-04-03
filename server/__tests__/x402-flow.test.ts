import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock config
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
// Mock child_process (onchainos CLI)
// ---------------------------------------------------------------------------

vi.mock("child_process", () => ({
  execSync: vi.fn(() => "{}"),
}));

// ---------------------------------------------------------------------------
// Tests: x402 Middleware
// ---------------------------------------------------------------------------

import express, { type Express } from "express";
import request from "supertest";
import { x402Middleware } from "../src/router/x402-middleware.js";

function createTestApp(): Express {
  const app = express();
  app.use(express.json());

  app.post(
    "/test/:serviceId/:action",
    x402Middleware(1, "10.00"),
    (req, res) => {
      res.json({
        ok: true,
        paymentVerified: req.paymentVerified,
        paymentPayer: req.paymentPayer,
        paymentAmount: req.paymentAmount,
      });
    },
  );

  return app;
}

describe("x402Middleware", () => {
  let app: Express;

  beforeEach(() => {
    app = createTestApp();
  });

  it("returns 402 without X-Payment header", async () => {
    const res = await request(app)
      .post("/test/1/token-report")
      .send({ token: "0xABC" });

    expect(res.status).toBe(402);
    expect(res.body.error).toBe("Payment Required");
    expect(res.body.challenge).toBeDefined();
    expect(res.body.challenge.price).toBe("10.00");
    expect(res.body.challenge.currency).toBe("USDT");
    expect(res.body.challenge.serviceId).toBe(1);
    expect(res.body.challenge.chainId).toBe(196);
    expect(res.body.challenge.escrowAddress).toBe("0x0000000000000000000000000000000000000002");
  });

  it("passes with valid X-Payment header", async () => {
    const payment = JSON.stringify({
      signature: "0xdeadbeef",
      payer: "0x0000000000000000000000000000000000000010",
      serviceId: 1,
    });

    const res = await request(app)
      .post("/test/1/token-report")
      .set("X-Payment", payment)
      .send({ token: "0xABC" });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.paymentVerified).toBe(true);
    expect(res.body.paymentPayer).toBe("0x0000000000000000000000000000000000000010");
    expect(res.body.paymentAmount).toBe("10.00");
  });

  it("rejects malformed JSON in X-Payment", async () => {
    const res = await request(app)
      .post("/test/1/token-report")
      .set("X-Payment", "not-json")
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("malformed JSON");
  });

  it("rejects missing signature", async () => {
    const payment = JSON.stringify({
      payer: "0x0000000000000000000000000000000000000010",
    });

    const res = await request(app)
      .post("/test/1/token-report")
      .set("X-Payment", payment)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("missing signature");
  });

  it("rejects invalid payer address", async () => {
    const payment = JSON.stringify({
      signature: "0xdeadbeef",
      payer: "not-an-address",
    });

    const res = await request(app)
      .post("/test/1/token-report")
      .set("X-Payment", payment)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("invalid payer");
  });

  it("rejects missing payer", async () => {
    const payment = JSON.stringify({
      signature: "0xdeadbeef",
    });

    const res = await request(app)
      .post("/test/1/token-report")
      .set("X-Payment", payment)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("invalid payer");
  });
});

// ---------------------------------------------------------------------------
// Tests: X402Client
// ---------------------------------------------------------------------------

import { X402Client } from "../src/payments/x402-client.js";
import { AgenticWallet } from "../src/wallet/agentic-wallet.js";

describe("X402Client", () => {
  const wallet = new AgenticWallet("0", "0x0000000000000000000000000000000000000010", "analyst");

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("buyService handles 402 -> sign -> retry flow", async () => {
    const challenge = {
      error: "Payment Required",
      challenge: {
        price: "10.00",
        currency: "USDT",
        escrowAddress: "0x0000000000000000000000000000000000000002",
        serviceId: 1,
        chainId: 196,
      },
    };

    const successResult = {
      serviceId: 1,
      action: "token-report",
      paymentVerified: true,
      result: { token: "0xABC", riskScore: 5 },
    };

    let callCount = 0;
    const mockFetch = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve({
          status: 402,
          ok: false,
          json: () => Promise.resolve(challenge),
        });
      }
      return Promise.resolve({
        status: 200,
        ok: true,
        json: () => Promise.resolve(successResult),
      });
    });

    vi.stubGlobal("fetch", mockFetch);

    // Mock wallet.signX402Payment
    vi.spyOn(wallet, "signX402Payment").mockResolvedValue({
      signature: "0xsig",
      authorization: { payer: wallet.address, payTo: "0x02", amount: "10.00", asset: "0xusdt", network: "eip155:196" },
    });

    const client = new X402Client(wallet, "http://localhost:3000");
    const result = await client.buyService(1, "token-report", { token: "0xABC" });

    expect(result.success).toBe(true);
    expect(result.result).toEqual({ token: "0xABC", riskScore: 5 });
    expect(mockFetch).toHaveBeenCalledTimes(2);

    // First call should have no X-Payment header
    const firstCallHeaders = mockFetch.mock.calls[0][1].headers;
    expect(firstCallHeaders["X-Payment"]).toBeUndefined();

    // Second call should have X-Payment header
    const secondCallHeaders = mockFetch.mock.calls[1][1].headers;
    expect(secondCallHeaders["X-Payment"]).toBeDefined();
  });

  it("buyService returns error when sign fails", async () => {
    const challenge = {
      error: "Payment Required",
      challenge: {
        price: "10.00",
        currency: "USDT",
        escrowAddress: "0x0000000000000000000000000000000000000002",
        serviceId: 1,
        chainId: 196,
      },
    };

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      status: 402,
      ok: false,
      json: () => Promise.resolve(challenge),
    }));

    vi.spyOn(wallet, "signX402Payment").mockResolvedValue(null);

    const client = new X402Client(wallet, "http://localhost:3000");
    const result = await client.buyService(1, "token-report", { token: "0xABC" });

    expect(result.success).toBe(false);
    expect(result.error).toBe("Failed to sign x402 payment");
  });

  it("buyService handles network errors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Network failure")));

    const client = new X402Client(wallet, "http://localhost:3000");
    const result = await client.buyService(1, "token-report", { token: "0xABC" });

    expect(result.success).toBe(false);
    expect(result.error).toBe("Network failure");
  });

  it("emits events during buyService flow", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("fail")));

    const client = new X402Client(wallet, "http://localhost:3000");
    const events: unknown[] = [];
    client.onEvent((event) => events.push(event));

    await client.buyService(1, "token-report", { token: "0xABC" });

    expect(events.length).toBeGreaterThan(0);
  });
});
