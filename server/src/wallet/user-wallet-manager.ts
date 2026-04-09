// ---------------------------------------------------------------------------
// User Wallet Manager
// Custodial model: Sentinel's agentic wallet acts on behalf of all users.
// Each user's MetaMask address maps to a tracked balance account.
// ---------------------------------------------------------------------------

import { config } from "../config.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UserAccount {
  walletAddress: string;       // User's MetaMask address
  agentWalletAddress: string;  // Sentinel's wallet address (shared)
  depositedBalance: string;    // Tracked balance in USDT minimal units
  createdAt: number;
}

// ---------------------------------------------------------------------------
// Manager
// ---------------------------------------------------------------------------

export class UserWalletManager {
  private accounts = new Map<string, UserAccount>();

  /**
   * Get or create an agent wallet account for a user.
   * Returns Sentinel's wallet as the user's agent wallet (custodial model).
   */
  getOrCreateAccount(userWalletAddress: string): UserAccount {
    const key = userWalletAddress.toLowerCase();
    const existing = this.accounts.get(key);
    if (existing) return existing;

    const account: UserAccount = {
      walletAddress: userWalletAddress,
      agentWalletAddress: config.wallets.analyst.address, // Sentinel wallet
      depositedBalance: "0",
      createdAt: Date.now(),
    };

    this.accounts.set(key, account);
    console.log(`[user-wallet] Created account for ${userWalletAddress} -> agent wallet ${account.agentWalletAddress}`);
    return account;
  }

  /**
   * Record a user deposit (called after verifying on-chain tx).
   * Amount is in USDT minimal units (6 decimals).
   */
  recordDeposit(userWalletAddress: string, amount: string): void {
    const key = userWalletAddress.toLowerCase();
    const account = this.accounts.get(key);
    if (!account) {
      console.warn(`[user-wallet] recordDeposit: no account for ${userWalletAddress}`);
      return;
    }

    const current = BigInt(account.depositedBalance);
    const deposit = BigInt(amount);
    account.depositedBalance = (current + deposit).toString();

    console.log(`[user-wallet] Deposit ${amount} for ${userWalletAddress}. New balance: ${account.depositedBalance}`);
  }

  /**
   * Get tracked balance for a user. Returns "0" if no account.
   */
  getBalance(userWalletAddress: string): string {
    const key = userWalletAddress.toLowerCase();
    const account = this.accounts.get(key);
    return account?.depositedBalance ?? "0";
  }

  /**
   * Deduct from a user's tracked balance after an agent action.
   * Returns true if deduction succeeded, false if insufficient balance.
   */
  deductBalance(userWalletAddress: string, amount: string): boolean {
    const key = userWalletAddress.toLowerCase();
    const account = this.accounts.get(key);
    if (!account) return false;

    const current = BigInt(account.depositedBalance);
    const deduction = BigInt(amount);
    if (current < deduction) return false;

    account.depositedBalance = (current - deduction).toString();
    console.log(`[user-wallet] Deducted ${amount} from ${userWalletAddress}. New balance: ${account.depositedBalance}`);
    return true;
  }

  /**
   * Get all registered accounts (for admin/debug).
   */
  getAllAccounts(): UserAccount[] {
    return [...this.accounts.values()];
  }
}

// Singleton instance
export const userWalletManager = new UserWalletManager();
