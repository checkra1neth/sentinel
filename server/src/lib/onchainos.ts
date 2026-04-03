import { execSync } from "child_process";
import type { OnchainosResult } from "../types.js";

/**
 * Execute an onchainos CLI command and parse JSON output.
 * Runs: onchainos ${command} --json 2>/dev/null
 */
export function onchainos<T>(command: string): OnchainosResult<T> {
  try {
    const raw = execSync(`onchainos ${command} --json 2>/dev/null`, {
      timeout: 30_000,
      encoding: "utf-8",
      maxBuffer: 10 * 1024 * 1024,
    });

    // CLI may print non-JSON lines before the actual JSON payload.
    // Find the first line that starts with '{' or '['.
    const lines = raw.split("\n");
    let jsonStart = -1;
    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trimStart();
      if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
        jsonStart = i;
        break;
      }
    }

    if (jsonStart === -1) {
      return { success: false, data: undefined as T, error: "No JSON found in CLI output" };
    }

    const jsonStr = lines.slice(jsonStart).join("\n");
    const data = JSON.parse(jsonStr) as T;
    return { success: true, data };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, data: undefined as T, error: message };
  }
}

// ---------------------------------------------------------------------------
// Wallet
// ---------------------------------------------------------------------------

export const onchainosWallet = {
  balance: (token?: string): OnchainosResult<unknown> =>
    onchainos(`wallet balance${token ? ` --token ${token}` : ""}`),

  send: (to: string, amount: string, token?: string): OnchainosResult<unknown> =>
    onchainos(`wallet send --to ${to} --amount ${amount}${token ? ` --token ${token}` : ""}`),

  contractCall: (address: string, method: string, args?: string): OnchainosResult<unknown> =>
    onchainos(`wallet contract-call --address ${address} --method ${method}${args ? ` --args ${args}` : ""}`),

  signMessage: (message: string): OnchainosResult<unknown> =>
    onchainos(`wallet sign-message --message "${message}"`),

  addresses: (): OnchainosResult<unknown> =>
    onchainos("wallet addresses"),

  switchAccount: (index: number): OnchainosResult<unknown> =>
    onchainos(`wallet switch-account --index ${index}`),
};

// ---------------------------------------------------------------------------
// Payment (x402)
// ---------------------------------------------------------------------------

export const onchainosPayment = {
  /** network must be CAIP-2 format, e.g. eip155:196 */
  x402Pay: (url: string, network: string, maxAmount?: string): OnchainosResult<unknown> =>
    onchainos(`payment x402-pay --url ${url} --network ${network}${maxAmount ? ` --max-amount ${maxAmount}` : ""}`),
};

// ---------------------------------------------------------------------------
// Security
// ---------------------------------------------------------------------------

export const onchainosSecurity = {
  tokenScan: (token: string, chainId?: number): OnchainosResult<unknown> =>
    onchainos(`security token-scan --token ${token}${chainId ? ` --chain-id ${chainId}` : ""}`),

  txScan: (txHash: string): OnchainosResult<unknown> =>
    onchainos(`security tx-scan --tx ${txHash}`),
};

// ---------------------------------------------------------------------------
// Swap
// ---------------------------------------------------------------------------

export const onchainosSwap = {
  quote: (from: string, to: string, amount: string, chainId?: number): OnchainosResult<unknown> =>
    onchainos(`swap quote --from ${from} --to ${to} --amount ${amount}${chainId ? ` --chain-id ${chainId}` : ""}`),

  execute: (from: string, to: string, amount: string, slippage?: string): OnchainosResult<unknown> =>
    onchainos(`swap execute --from ${from} --to ${to} --amount ${amount}${slippage ? ` --slippage ${slippage}` : ""}`),
};

// ---------------------------------------------------------------------------
// Token
// ---------------------------------------------------------------------------

export const onchainosToken = {
  search: (query: string): OnchainosResult<unknown> =>
    onchainos(`token search --query "${query}"`),

  priceInfo: (token: string): OnchainosResult<unknown> =>
    onchainos(`token price-info --token ${token}`),

  liquidity: (token: string): OnchainosResult<unknown> =>
    onchainos(`token liquidity --token ${token}`),

  hotTokens: (chainId?: number): OnchainosResult<unknown> =>
    onchainos(`token hot-tokens${chainId ? ` --chain-id ${chainId}` : ""}`),

  advancedInfo: (token: string): OnchainosResult<unknown> =>
    onchainos(`token advanced-info --token ${token}`),
};

// ---------------------------------------------------------------------------
// Signal
// ---------------------------------------------------------------------------

export const onchainosSignal = {
  activities: (address?: string): OnchainosResult<unknown> =>
    onchainos(`signal activities${address ? ` --address ${address}` : ""}`),

  list: (filter?: string): OnchainosResult<unknown> =>
    onchainos(`signal list${filter ? ` --filter ${filter}` : ""}`),
};

// ---------------------------------------------------------------------------
// Market
// ---------------------------------------------------------------------------

export const onchainosMarket = {
  price: (token: string): OnchainosResult<unknown> =>
    onchainos(`market price --token ${token}`),

  kline: (token: string, interval?: string): OnchainosResult<unknown> =>
    onchainos(`market kline --token ${token}${interval ? ` --interval ${interval}` : ""}`),

  portfolioOverview: (): OnchainosResult<unknown> =>
    onchainos("market portfolio-overview"),
};

// ---------------------------------------------------------------------------
// DeFi
// ---------------------------------------------------------------------------

export const onchainosDefi = {
  search: (query: string): OnchainosResult<unknown> =>
    onchainos(`defi search --query "${query}"`),

  detail: (protocol: string): OnchainosResult<unknown> =>
    onchainos(`defi detail --protocol ${protocol}`),

  invest: (protocol: string, amount: string, token?: string): OnchainosResult<unknown> =>
    onchainos(`defi invest --protocol ${protocol} --amount ${amount}${token ? ` --token ${token}` : ""}`),

  withdraw: (protocol: string, amount: string): OnchainosResult<unknown> =>
    onchainos(`defi withdraw --protocol ${protocol} --amount ${amount}`),

  positions: (): OnchainosResult<unknown> =>
    onchainos("defi positions"),

  collect: (protocol: string): OnchainosResult<unknown> =>
    onchainos(`defi collect --protocol ${protocol}`),
};

// ---------------------------------------------------------------------------
// Portfolio
// ---------------------------------------------------------------------------

export const onchainosPortfolio = {
  totalValue: (): OnchainosResult<unknown> =>
    onchainos("portfolio total-value"),

  allBalances: (): OnchainosResult<unknown> =>
    onchainos("portfolio all-balances"),
};

// ---------------------------------------------------------------------------
// Trenches
// ---------------------------------------------------------------------------

export const onchainosTrenches = {
  tokens: (filter?: string): OnchainosResult<unknown> =>
    onchainos(`trenches tokens${filter ? ` --filter ${filter}` : ""}`),

  devInfo: (token: string): OnchainosResult<unknown> =>
    onchainos(`trenches dev-info --token ${token}`),
};
