import { execSync } from "child_process";
import type { OnchainosResult } from "../types.js";

/**
 * Execute an onchainos CLI command and parse JSON output.
 * Runs: onchainos ${command} --json 2>/dev/null
 */
export function onchainos<T>(command: string): OnchainosResult<T> {
  try {
    const raw = execSync(`onchainos ${command} 2>/dev/null`, {
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
    const parsed = JSON.parse(jsonStr) as Record<string, unknown>;

    // CLI wraps responses in { ok: true, data: ... } — unwrap it
    if (parsed && typeof parsed === "object" && "ok" in parsed && "data" in parsed) {
      const inner = parsed.data;
      // If data is an array with one element, return that element directly
      if (Array.isArray(inner) && inner.length === 1) {
        return { success: parsed.ok === true, data: inner[0] as T };
      }
      return { success: parsed.ok === true, data: inner as T };
    }

    return { success: true, data: parsed as T };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, data: undefined as T, error: message };
  }
}

// ---------------------------------------------------------------------------
// Wallet
// ---------------------------------------------------------------------------

export const onchainosWallet = {
  balance: (chainId: number, token?: string): OnchainosResult<unknown> =>
    onchainos(`wallet balance --chain ${chainId}${token ? ` --token ${token}` : ""} --force`),

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
  tokenScan: (token: string, chainId: number = 196): OnchainosResult<unknown> =>
    onchainos(`security token-scan --tokens "${chainId}:${token}"`),

  txScan: (txHash: string): OnchainosResult<unknown> =>
    onchainos(`security tx-scan --tx ${txHash}`),
};

// ---------------------------------------------------------------------------
// Swap
// ---------------------------------------------------------------------------

export const onchainosSwap = {
  quote: (from: string, to: string, amount: string, chainId: number = 196): OnchainosResult<unknown> =>
    onchainos(`swap quote --from ${from} --to ${to} --amount ${amount} --chain ${chainId}`),

  execute: (from: string, to: string, amount: string, chainId: number = 196, slippage?: string): OnchainosResult<unknown> =>
    onchainos(`swap execute --from ${from} --to ${to} --amount ${amount} --chain ${chainId}${slippage ? ` --slippage ${slippage}` : ""}`),
};

// ---------------------------------------------------------------------------
// Token
// ---------------------------------------------------------------------------

export const onchainosToken = {
  search: (query: string, chains: string = "xlayer"): OnchainosResult<unknown> =>
    onchainos(`token search --query "${query}" --chains ${chains}`),

  priceInfo: (token: string, chainId: number = 196): OnchainosResult<unknown> =>
    onchainos(`token price-info --address ${token} --chain ${chainId}`),

  liquidity: (token: string, chainId: number = 196): OnchainosResult<unknown> =>
    onchainos(`token liquidity --address ${token} --chain ${chainId}`),

  hotTokens: (chainId: number = 196): OnchainosResult<unknown> =>
    onchainos(`token hot-tokens --chain ${chainId}`),

  advancedInfo: (token: string, chainId: number = 196): OnchainosResult<unknown> =>
    onchainos(`token advanced-info --address ${token} --chain ${chainId}`),
};

// ---------------------------------------------------------------------------
// Signal
// ---------------------------------------------------------------------------

export const onchainosSignal = {
  activities: (trackerType: string = "smart_money", chainId: number = 196): OnchainosResult<unknown> =>
    onchainos(`tracker activities --tracker-type ${trackerType} --chain ${chainId}`),

  list: (chainId: number = 196): OnchainosResult<unknown> =>
    onchainos(`signal list --chain ${chainId}`),
};

// ---------------------------------------------------------------------------
// Market
// ---------------------------------------------------------------------------

export const onchainosMarket = {
  price: (token: string, chainId: number = 196): OnchainosResult<unknown> =>
    onchainos(`market price --address ${token} --chain ${chainId}`),

  prices: (tokens: string[], chainId: number = 196): OnchainosResult<unknown> =>
    onchainos(`market prices --tokens ${tokens.join(",")} --chain ${chainId}`),

  kline: (token: string, chainId: number = 196, interval?: string): OnchainosResult<unknown> =>
    onchainos(`market kline --address ${token} --chain ${chainId}${interval ? ` --interval ${interval}` : ""}`),
};

// ---------------------------------------------------------------------------
// DeFi
// ---------------------------------------------------------------------------

export const onchainosDefi = {
  search: (query: string, chainId: number = 196): OnchainosResult<unknown> =>
    onchainos(`defi search --query "${query}" --chain ${chainId}`),

  detail: (protocol: string): OnchainosResult<unknown> =>
    onchainos(`defi detail --protocol ${protocol}`),

  invest: (protocol: string, amount: string, token?: string): OnchainosResult<unknown> =>
    onchainos(`defi invest --protocol ${protocol} --amount ${amount}${token ? ` --token ${token}` : ""}`),

  withdraw: (protocol: string, amount: string): OnchainosResult<unknown> =>
    onchainos(`defi withdraw --protocol ${protocol} --amount ${amount}`),

  positions: (address: string, chains: string = "xlayer"): OnchainosResult<unknown> =>
    onchainos(`defi positions --address ${address} --chains ${chains}`),

  collect: (protocol: string): OnchainosResult<unknown> =>
    onchainos(`defi collect --protocol ${protocol}`),
};

// ---------------------------------------------------------------------------
// Portfolio
// ---------------------------------------------------------------------------

export const onchainosPortfolio = {
  totalValue: (address: string, chains: string = "xlayer"): OnchainosResult<unknown> =>
    onchainos(`portfolio total-value --address ${address} --chains ${chains}`),

  allBalances: (address: string, chains: string = "xlayer"): OnchainosResult<unknown> =>
    onchainos(`portfolio all-balances --address ${address} --chains ${chains}`),
};

// ---------------------------------------------------------------------------
// Trenches
// ---------------------------------------------------------------------------

export const onchainosTrenches = {
  tokens: (stage: string = "NEW", chainId: number = 196): OnchainosResult<unknown> =>
    onchainos(`memepump tokens --chain ${chainId} --stage ${stage}`),

  devInfo: (token: string, chainId: number = 196): OnchainosResult<unknown> =>
    onchainos(`memepump token-details --address ${token} --chain ${chainId}`),

  tokenBundleInfo: (token: string): OnchainosResult<unknown> =>
    onchainos(`memepump token-bundle-info --address ${token}`),
};
