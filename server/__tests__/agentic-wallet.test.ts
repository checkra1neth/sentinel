import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Address } from "viem";

// Mock onchainos module before imports
vi.mock("../src/lib/onchainos.js", () => ({
  onchainosWallet: {
    balance: vi.fn(),
    send: vi.fn(),
    contractCall: vi.fn(),
    signMessage: vi.fn(),
    switchAccount: vi.fn(),
  },
  onchainosPayment: {
    x402Pay: vi.fn(),
  },
}));

// Mock config module
vi.mock("../src/config.js", () => ({
  config: {
    chainId: 196,
    contracts: {
      usdt: "0x1E4a5963aBFD975d8c9021ce480b42188849D41d" as Address,
    },
    wallets: {
      analyst: { accountId: "0", address: "0xAAAA000000000000000000000000000000000001" as Address },
      auditor: { accountId: "1", address: "0xAAAA000000000000000000000000000000000002" as Address },
      trader: { accountId: "2", address: "0xAAAA000000000000000000000000000000000003" as Address },
    },
  },
}));

import { AgenticWallet, createAgentWallets } from "../src/wallet/agentic-wallet.js";
import { onchainosWallet, onchainosPayment } from "../src/lib/onchainos.js";

const mockWallet = vi.mocked(onchainosWallet);
const mockPayment = vi.mocked(onchainosPayment);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("AgenticWallet", () => {
  const TEST_ACCOUNT_ID = "0";
  const TEST_ADDRESS = "0xABCDEF1234567890ABCDEF1234567890ABCDEF12" as Address;
  const TEST_ROLE = "analyst";

  it("constructor sets correct properties", () => {
    const wallet = new AgenticWallet(TEST_ACCOUNT_ID, TEST_ADDRESS, TEST_ROLE);

    expect(wallet.accountId).toBe(TEST_ACCOUNT_ID);
    expect(wallet.address).toBe(TEST_ADDRESS);
    expect(wallet.role).toBe(TEST_ROLE);
  });

  it("getBalance calls onchainos with correct chain", async () => {
    mockWallet.balance.mockReturnValue({
      success: true,
      data: { balance: "150.5" },
    });
    mockWallet.switchAccount.mockReturnValue({ success: true, data: {} });

    const wallet = new AgenticWallet(TEST_ACCOUNT_ID, TEST_ADDRESS, TEST_ROLE);
    const balance = await wallet.getBalance();

    expect(mockWallet.switchAccount).toHaveBeenCalledWith(0);
    expect(mockWallet.balance).toHaveBeenCalledWith(196, undefined);
    expect(balance).toBe("150.5");
  });

  it("getBalance with token address passes it through", async () => {
    const token = "0x1111111111111111111111111111111111111111";
    mockWallet.balance.mockReturnValue({
      success: true,
      data: { balance: "42" },
    });
    mockWallet.switchAccount.mockReturnValue({ success: true, data: {} });

    const wallet = new AgenticWallet(TEST_ACCOUNT_ID, TEST_ADDRESS, TEST_ROLE);
    const balance = await wallet.getBalance(token);

    expect(mockWallet.balance).toHaveBeenCalledWith(196, token);
    expect(balance).toBe("42");
  });

  it("getBalance returns '0' on failure", async () => {
    mockWallet.balance.mockReturnValue({
      success: false,
      data: undefined as unknown,
      error: "Network error",
    });
    mockWallet.switchAccount.mockReturnValue({ success: true, data: {} });

    const wallet = new AgenticWallet(TEST_ACCOUNT_ID, TEST_ADDRESS, TEST_ROLE);
    const balance = await wallet.getBalance();

    expect(balance).toBe("0");
  });

  it("getUsdtBalance calls getBalance with USDT address", async () => {
    mockWallet.balance.mockReturnValue({
      success: true,
      data: { balance: "1000" },
    });
    mockWallet.switchAccount.mockReturnValue({ success: true, data: {} });

    const wallet = new AgenticWallet(TEST_ACCOUNT_ID, TEST_ADDRESS, TEST_ROLE);
    const balance = await wallet.getUsdtBalance();

    expect(mockWallet.balance).toHaveBeenCalledWith(
      196,
      "0x1E4a5963aBFD975d8c9021ce480b42188849D41d",
    );
    expect(balance).toBe("1000");
  });

  it("send returns true on success", async () => {
    mockWallet.send.mockReturnValue({ success: true, data: { txHash: "0x123" } });
    mockWallet.switchAccount.mockReturnValue({ success: true, data: {} });

    const wallet = new AgenticWallet(TEST_ACCOUNT_ID, TEST_ADDRESS, TEST_ROLE);
    const to = "0x2222222222222222222222222222222222222222" as Address;
    const ok = await wallet.send("10", to);

    expect(ok).toBe(true);
    expect(mockWallet.send).toHaveBeenCalledWith(to, "10", undefined);
  });

  it("send returns false on failure", async () => {
    mockWallet.send.mockReturnValue({ success: false, data: undefined as unknown, error: "Insufficient funds" });
    mockWallet.switchAccount.mockReturnValue({ success: true, data: {} });

    const wallet = new AgenticWallet(TEST_ACCOUNT_ID, TEST_ADDRESS, TEST_ROLE);
    const to = "0x2222222222222222222222222222222222222222" as Address;
    const ok = await wallet.send("10", to);

    expect(ok).toBe(false);
  });

  it("contractCall delegates to onchainos", async () => {
    mockWallet.contractCall.mockReturnValue({ success: true, data: {} });
    mockWallet.switchAccount.mockReturnValue({ success: true, data: {} });

    const wallet = new AgenticWallet(TEST_ACCOUNT_ID, TEST_ADDRESS, TEST_ROLE);
    const to = "0x3333333333333333333333333333333333333333" as Address;
    const ok = await wallet.contractCall(to, "0xabcdef", "1000");

    expect(ok).toBe(true);
    expect(mockWallet.contractCall).toHaveBeenCalledWith(to, "0xabcdef", "1000");
  });

  it("signMessage returns signature string", async () => {
    mockWallet.signMessage.mockReturnValue({
      success: true,
      data: { signature: "0xdeadbeef" },
    });
    mockWallet.switchAccount.mockReturnValue({ success: true, data: {} });

    const wallet = new AgenticWallet(TEST_ACCOUNT_ID, TEST_ADDRESS, TEST_ROLE);
    const sig = await wallet.signMessage("hello");

    expect(sig).toBe("0xdeadbeef");
    expect(mockWallet.signMessage).toHaveBeenCalledWith("hello");
  });

  it("signMessage returns null on failure", async () => {
    mockWallet.signMessage.mockReturnValue({
      success: false,
      data: undefined as unknown,
      error: "Rejected",
    });
    mockWallet.switchAccount.mockReturnValue({ success: true, data: {} });

    const wallet = new AgenticWallet(TEST_ACCOUNT_ID, TEST_ADDRESS, TEST_ROLE);
    const sig = await wallet.signMessage("hello");

    expect(sig).toBeNull();
  });

  it("signX402Payment returns structured result", async () => {
    mockPayment.x402Pay.mockReturnValue({
      success: true,
      data: {
        signature: "0xpayment_sig",
        authorization: { nonce: "1", expiry: "9999999999" },
      },
    });
    mockWallet.switchAccount.mockReturnValue({ success: true, data: {} });

    const wallet = new AgenticWallet(TEST_ACCOUNT_ID, TEST_ADDRESS, TEST_ROLE);
    const payTo = "0x4444444444444444444444444444444444444444" as Address;
    const asset = "0x1E4a5963aBFD975d8c9021ce480b42188849D41d" as Address;
    const result = await wallet.signX402Payment(payTo, "50", asset);

    expect(result).not.toBeNull();
    expect(result!.signature).toBe("0xpayment_sig");
    expect(result!.authorization.payer).toBe(TEST_ADDRESS);
    expect(result!.authorization.payTo).toBe(payTo);
    expect(result!.authorization.amount).toBe("50");
    expect(result!.authorization.asset).toBe(asset);
    expect(result!.authorization.network).toBe("eip155:196");
    expect(result!.authorization.nonce).toBe("1");
    expect(result!.authorization.expiry).toBe("9999999999");
  });

  it("signX402Payment returns null on failure", async () => {
    mockPayment.x402Pay.mockReturnValue({
      success: false,
      data: undefined as unknown,
      error: "Payment rejected",
    });
    mockWallet.switchAccount.mockReturnValue({ success: true, data: {} });

    const wallet = new AgenticWallet(TEST_ACCOUNT_ID, TEST_ADDRESS, TEST_ROLE);
    const payTo = "0x4444444444444444444444444444444444444444" as Address;
    const asset = "0x1E4a5963aBFD975d8c9021ce480b42188849D41d" as Address;
    const result = await wallet.signX402Payment(payTo, "50", asset);

    expect(result).toBeNull();
  });

  it("skips switchAccount when accountId is empty", async () => {
    mockWallet.balance.mockReturnValue({
      success: true,
      data: { balance: "10" },
    });

    const wallet = new AgenticWallet("", TEST_ADDRESS, TEST_ROLE);
    await wallet.getBalance();

    expect(mockWallet.switchAccount).not.toHaveBeenCalled();
  });
});

describe("createAgentWallets", () => {
  it("returns wallets for all three roles", async () => {
    // Re-mock config with wallet values for this test
    const { createAgentWallets: factory } = await import("../src/wallet/agentic-wallet.js");
    const wallets = factory();

    expect(wallets.analyst).toBeInstanceOf(AgenticWallet);
    expect(wallets.auditor).toBeInstanceOf(AgenticWallet);
    expect(wallets.trader).toBeInstanceOf(AgenticWallet);
    expect(wallets.analyst.role).toBe("analyst");
    expect(wallets.auditor.role).toBe("auditor");
    expect(wallets.trader.role).toBe("trader");
  });
});
