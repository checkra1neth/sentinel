import { type Address } from "viem";
import { onchainosWallet, onchainosPayment } from "../lib/onchainos.js";
import { config } from "../config.js";

/**
 * Wraps an OKX Agentic Wallet (OnchainOS) for a single agent role.
 * Each agent (analyst, auditor, trader) gets its own wallet instance.
 */
export class AgenticWallet {
  readonly accountId: string;
  readonly address: Address;
  readonly role: string;

  constructor(accountId: string, address: Address, role: string) {
    this.accountId = accountId;
    this.address = address;
    this.role = role;
  }

  /** Switch onchainos CLI context to this wallet's account. */
  private async activate(): Promise<void> {
    if (!this.accountId) return;
    onchainosWallet.switchAccount(this.accountId);
  }

  /** Get native or token balance on X Layer. */
  async getBalance(tokenAddress?: string): Promise<string> {
    await this.activate();
    const result = onchainosWallet.balance(config.chainId, tokenAddress);
    if (!result.success) {
      return "0";
    }
    const data = result.data as Record<string, unknown>;
    return String(data.balance ?? data.amount ?? "0");
  }

  /** Convenience: get USDT balance. */
  async getUsdtBalance(): Promise<string> {
    return this.getBalance(config.contracts.usdt);
  }

  /** Send native or ERC-20 tokens. */
  async send(amount: string, to: Address, tokenAddress?: string): Promise<boolean> {
    await this.activate();
    const result = onchainosWallet.send(to, amount, config.chainId, tokenAddress);
    return result.success;
  }

  /** Execute an arbitrary contract call via onchainos CLI. */
  async contractCall(to: Address, inputData: string, value?: string): Promise<boolean> {
    await this.activate();
    const result = onchainosWallet.contractCall(to, config.chainId, inputData, value);
    return result.success;
  }

  /** Sign an arbitrary message. */
  async signMessage(message: string): Promise<string | null> {
    await this.activate();
    const result = onchainosWallet.signMessage(config.chainId, this.address, message);
    if (!result.success) return null;
    const data = result.data as Record<string, unknown>;
    return String(data.signature ?? data);
  }

  /** Sign an x402 payment authorization for service purchases. */
  async signX402Payment(
    payTo: Address,
    amount: string,
    asset: Address,
  ): Promise<{ signature: string; authorization: Record<string, string> } | null> {
    await this.activate();
    const network = `eip155:${config.chainId}`;
    const result = onchainosPayment.x402Pay(network, amount, payTo, asset);
    if (!result.success) return null;

    const data = result.data as Record<string, unknown>;
    return {
      signature: String(data.signature ?? ""),
      authorization: {
        payer: this.address,
        payTo,
        amount,
        asset,
        network,
        ...(typeof data.authorization === "object" && data.authorization !== null
          ? (data.authorization as Record<string, string>)
          : {}),
      },
    };
  }
}

/**
 * Factory: create wallet instances for all three agent roles from config.
 */
export function createAgentWallets(): Record<string, AgenticWallet> {
  const { wallets } = config;
  return {
    analyst: new AgenticWallet(wallets.analyst.accountId, wallets.analyst.address, "analyst"),
    auditor: new AgenticWallet(wallets.auditor.accountId, wallets.auditor.address, "auditor"),
    trader: new AgenticWallet(wallets.trader.accountId, wallets.trader.address, "trader"),
  };
}
