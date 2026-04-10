// ---------------------------------------------------------------------------
// User Wallet Manager
// Non-custodial model: each user gets a dedicated TEE wallet account under
// the shared OnchainOS API key. Users fund that wallet directly on X Layer.
// ---------------------------------------------------------------------------

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname } from "path";
import { fileURLToPath } from "url";
import { isAddress, type Address } from "viem";
import { getUsdtBalance as readUsdtBalance } from "../contracts/client.js";
import {
  onchainosWallet,
  withOnchainosWalletLock,
} from "../lib/onchainos.js";
import { AgenticWallet } from "./agentic-wallet.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UserAccount {
  userWalletAddress: string;   // User's connected wallet (MetaMask / EOA)
  accountId: string;          // OnchainOS TEE sub-account id
  agentWalletAddress: Address; // User-dedicated TEE wallet address on X Layer
  createdAt: number;
  updatedAt: number;
}

interface PersistedStore {
  accounts: UserAccount[];
}

interface WalletAddressesResponse {
  accountId?: string;
  evm?: Array<{ address?: string }>;
  xlayer?: Array<{ address?: string }>;
}

const STORE_PATH = fileURLToPath(new URL("../../data/user-wallets.json", import.meta.url));

function normalizeWalletAddress(address: string): string {
  return address.toLowerCase();
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? value as Record<string, unknown>
    : null;
}

function findStringByKey(
  value: unknown,
  matcher: (key: string) => boolean,
): string | null {
  if (typeof value === "string" && value.trim() !== "") {
    return null;
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      const found = findStringByKey(entry, matcher);
      if (found) return found;
    }
    return null;
  }

  const record = asRecord(value);
  if (!record) return null;

  for (const [key, entry] of Object.entries(record)) {
    if (matcher(key) && typeof entry === "string" && entry.trim() !== "") {
      return entry;
    }
  }

  for (const entry of Object.values(record)) {
    const found = findStringByKey(entry, matcher);
    if (found) return found;
  }

  return null;
}

function collectAddresses(
  value: unknown,
  path: string[] = [],
): Array<{ path: string; address: Address }> {
  if (typeof value === "string") {
    if (isAddress(value)) {
      return [{ path: path.join(".").toLowerCase(), address: value }];
    }
    return [];
  }

  if (Array.isArray(value)) {
    return value.flatMap((entry, index) => collectAddresses(entry, [...path, String(index)]));
  }

  const record = asRecord(value);
  if (!record) return [];

  return Object.entries(record).flatMap(([key, entry]) => collectAddresses(entry, [...path, key]));
}

function parseAddressesResponse(value: unknown): WalletAddressesResponse {
  const record = asRecord(value);
  if (!record) return {};

  return {
    accountId: typeof record.accountId === "string" ? record.accountId : undefined,
    evm: Array.isArray(record.evm) ? record.evm as Array<{ address?: string }> : undefined,
    xlayer: Array.isArray(record.xlayer) ? record.xlayer as Array<{ address?: string }> : undefined,
  };
}

function resolveWalletAddress(...sources: unknown[]): Address | null {
  for (const source of sources) {
    const parsed = parseAddressesResponse(source);
    const xlayerAddress = parsed.xlayer?.find((entry) => typeof entry.address === "string" && isAddress(entry.address))?.address;
    if (xlayerAddress && isAddress(xlayerAddress)) {
      return xlayerAddress;
    }

    const evmAddress = parsed.evm?.find((entry) => typeof entry.address === "string" && isAddress(entry.address))?.address;
    if (evmAddress && isAddress(evmAddress)) {
      return evmAddress;
    }

    const discovered = collectAddresses(source);
    const preferred = discovered.find((entry) => entry.path.includes("xlayer"))
      ?? discovered.find((entry) => entry.path.includes("evm"))
      ?? discovered[0];

    if (preferred) return preferred.address;
  }

  return null;
}

function resolveAccountId(...sources: unknown[]): string | null {
  for (const source of sources) {
    const accountId = findStringByKey(source, (key) => {
      const normalized = key.toLowerCase();
      return normalized === "accountid" || normalized === "currentaccountid";
    });
    if (accountId) return accountId;
  }

  return null;
}

// ---------------------------------------------------------------------------
// Manager
// ---------------------------------------------------------------------------

export class UserWalletManager {
  private accounts = new Map<string, UserAccount>();
  private pendingCreations = new Map<string, Promise<UserAccount>>();

  constructor() {
    this.load();
  }

  private load(): void {
    if (!existsSync(STORE_PATH)) return;

    try {
      const raw = readFileSync(STORE_PATH, "utf-8");
      const parsed = JSON.parse(raw) as PersistedStore;
      const accounts = Array.isArray(parsed.accounts) ? parsed.accounts : [];

      for (const account of accounts) {
        if (!account.userWalletAddress || !account.accountId || !isAddress(account.agentWalletAddress)) {
          continue;
        }

        const normalized = normalizeWalletAddress(account.userWalletAddress);
        this.accounts.set(normalized, {
          ...account,
          userWalletAddress: normalized,
        });
      }
    } catch (err) {
      console.warn("[user-wallet] Failed to load persisted user wallets:", err);
    }
  }

  private persist(): void {
    try {
      mkdirSync(dirname(STORE_PATH), { recursive: true });
      writeFileSync(
        STORE_PATH,
        JSON.stringify({ accounts: [...this.accounts.values()] }, null, 2),
      );
    } catch (err) {
      console.warn("[user-wallet] Failed to persist user wallets:", err);
    }
  }

  getAccount(userWalletAddress: string): UserAccount | null {
    const normalized = normalizeWalletAddress(userWalletAddress);
    return this.accounts.get(normalized) ?? null;
  }

  async getOrCreateAccount(userWalletAddress: string): Promise<UserAccount> {
    const normalized = normalizeWalletAddress(userWalletAddress);
    const existing = this.accounts.get(normalized);
    if (existing) return existing;

    const inFlight = this.pendingCreations.get(normalized);
    if (inFlight) return inFlight;

    const created = this.createAccount(normalized)
      .finally(() => {
        this.pendingCreations.delete(normalized);
      });

    this.pendingCreations.set(normalized, created);
    return created;
  }

  getWalletForAccount(account: UserAccount): AgenticWallet {
    return new AgenticWallet(
      account.accountId,
      account.agentWalletAddress,
      `user:${account.userWalletAddress}`,
    );
  }

  async getWalletForUser(userWalletAddress: string): Promise<AgenticWallet> {
    const account = await this.getOrCreateAccount(userWalletAddress);
    return this.getWalletForAccount(account);
  }

  async getUsdtBalanceForAccount(account: UserAccount): Promise<string> {
    try {
      const balance = await readUsdtBalance(account.agentWalletAddress);
      return balance.toString();
    } catch {
      return "0";
    }
  }

  async getUsdtBalance(userWalletAddress: string): Promise<string> {
    const account = await this.getOrCreateAccount(userWalletAddress);
    return this.getUsdtBalanceForAccount(account);
  }

  getAllAccounts(): UserAccount[] {
    return [...this.accounts.values()];
  }

  private async createAccount(userWalletAddress: string): Promise<UserAccount> {
    return withOnchainosWalletLock(async () => {
      const beforeStatus = onchainosWallet.status();
      const beforeAddresses = onchainosWallet.addresses();
      const addResult = onchainosWallet.add();

      if (!addResult.success) {
        throw new Error(addResult.error ?? "Failed to create a new OnchainOS wallet account");
      }

      const afterStatus = onchainosWallet.status();
      const afterAddresses = onchainosWallet.addresses();

      const previousAccountId = resolveAccountId(beforeStatus.data);
      const accountIdFromAdd = resolveAccountId(addResult.data);
      const accountIdFromStatus = resolveAccountId(afterStatus.data);
      const accountIdFromAddresses = resolveAccountId(afterAddresses.data);
      const accountId = accountIdFromAdd
        ?? (accountIdFromStatus && accountIdFromStatus !== previousAccountId ? accountIdFromStatus : null)
        ?? (accountIdFromAddresses && accountIdFromAddresses !== previousAccountId ? accountIdFromAddresses : null);

      const previousWalletAddress = resolveWalletAddress(beforeAddresses.data);
      const walletAddressFromAdd = resolveWalletAddress(addResult.data);
      const walletAddressAfterAdd = resolveWalletAddress(afterAddresses.data);
      const agentWalletAddress = walletAddressFromAdd
        ?? (walletAddressAfterAdd && walletAddressAfterAdd !== previousWalletAddress ? walletAddressAfterAdd : null);

      if (!accountId || !agentWalletAddress) {
        throw new Error("Created TEE wallet account, but failed to resolve its account id or X Layer address");
      }

      const timestamp = Date.now();
      const account: UserAccount = {
        userWalletAddress,
        accountId,
        agentWalletAddress,
        createdAt: timestamp,
        updatedAt: timestamp,
      };

      this.accounts.set(userWalletAddress, account);
      this.persist();

      console.log(`[user-wallet] Created TEE wallet ${agentWalletAddress} for ${userWalletAddress} (account ${accountId})`);

      return account;
    });
  }
}

// Singleton instance
export const userWalletManager = new UserWalletManager();
