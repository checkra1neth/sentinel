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
  balance: (chainId?: number, tokenAddress?: string): OnchainosResult<unknown> =>
    onchainos(`wallet balance${chainId ? ` --chain ${chainId}` : ""}${tokenAddress ? ` --token-address ${tokenAddress}` : ""} --force`),

  balanceAll: (): OnchainosResult<unknown> =>
    onchainos("wallet balance --all"),

  send: (receipt: string, amount: string, chainId: number, contractToken?: string): OnchainosResult<unknown> =>
    onchainos(`wallet send --readable-amount ${amount} --receipt ${receipt} --chain ${chainId}${contractToken ? ` --contract-token ${contractToken}` : ""} --force`),

  contractCall: (to: string, chainId: number, inputData: string, amt?: string, gasLimit?: string): OnchainosResult<unknown> =>
    onchainos(`wallet contract-call --to ${to} --chain ${chainId} --input-data ${inputData}${amt ? ` --amt ${amt}` : ""}${gasLimit ? ` --gas-limit ${gasLimit}` : ""} --force`),

  signMessage: (chainId: number, from: string, message: string, type?: string): OnchainosResult<unknown> =>
    onchainos(`wallet sign-message --chain ${chainId} --from ${from} --message "${message}"${type ? ` --type ${type}` : ""} --force`),

  addresses: (): OnchainosResult<unknown> =>
    onchainos("wallet addresses"),

  switchAccount: (accountId: string): OnchainosResult<unknown> =>
    onchainos(`wallet switch ${accountId}`),

  status: (): OnchainosResult<unknown> =>
    onchainos("wallet status"),

  history: (chainId?: number, limit?: number): OnchainosResult<unknown> =>
    onchainos(`wallet history${chainId ? ` --chain ${chainId}` : ""}${limit ? ` --limit ${limit}` : ""}`),

  historyDetail: (txHash: string, chainId: number, address: string): OnchainosResult<unknown> =>
    onchainos(`wallet history --tx-hash ${txHash} --chain ${chainId} --address ${address}`),
};

// ---------------------------------------------------------------------------
// Payment (x402)
// ---------------------------------------------------------------------------

export const onchainosPayment = {
  /** network must be CAIP-2 format, e.g. eip155:196. amount in minimal units. */
  x402Pay: (network: string, amount: string, payTo: string, asset: string, maxTimeoutSeconds?: number): OnchainosResult<unknown> =>
    onchainos(`payment x402-pay --network ${network} --amount ${amount} --pay-to ${payTo} --asset ${asset}${maxTimeoutSeconds ? ` --max-timeout-seconds ${maxTimeoutSeconds}` : ""}`),
};

// ---------------------------------------------------------------------------
// Security
// ---------------------------------------------------------------------------

export const onchainosSecurity = {
  tokenScan: (token: string, chainId: number = 196): OnchainosResult<unknown> =>
    onchainos(`security token-scan --tokens "${chainId}:${token}"`),

  /** EVM tx pre-execution scan */
  txScan: (chainId: number, from: string, data: string, to?: string, value?: string, gas?: string, gasPrice?: string): OnchainosResult<unknown> =>
    onchainos(`security tx-scan --chain ${chainId} --from ${from} --data ${data}${to ? ` --to ${to}` : ""}${value ? ` --value ${value}` : ""}${gas ? ` --gas ${gas}` : ""}${gasPrice ? ` --gas-price ${gasPrice}` : ""}`),

  /** Solana tx pre-execution scan */
  txScanSolana: (from: string, encoding: "base58" | "base64", transactions: string): OnchainosResult<unknown> =>
    onchainos(`security tx-scan --chain solana --from ${from} --encoding ${encoding} --transactions ${transactions}`),

  dappScan: (domain: string): OnchainosResult<unknown> =>
    onchainos(`security dapp-scan --domain "${domain}"`),

  sigScan: (chainId: number, from: string, sigMethod: string, message: string): OnchainosResult<unknown> =>
    onchainos(`security sig-scan --chain ${chainId} --from ${from} --sig-method ${sigMethod} --message '${message}'`),

  approvals: (address: string, chainId?: number, limit?: number, cursor?: string): OnchainosResult<unknown> =>
    onchainos(`security approvals --address ${address}${chainId ? ` --chain ${chainId}` : ""}${limit ? ` --limit ${limit}` : ""}${cursor ? ` --cursor ${cursor}` : ""}`),
};

// ---------------------------------------------------------------------------
// Swap
// ---------------------------------------------------------------------------

export const onchainosSwap = {
  chains: (): OnchainosResult<unknown> =>
    onchainos("swap chains"),

  liquidity: (chainId: number = 196): OnchainosResult<unknown> =>
    onchainos(`swap liquidity --chain ${chainId}`),

  approve: (token: string, amount: string, chainId: number = 196): OnchainosResult<unknown> =>
    onchainos(`swap approve --token ${token} --amount ${amount} --chain ${chainId}`),

  quote: (from: string, to: string, amount: string, chainId: number = 196, swapMode?: string): OnchainosResult<unknown> =>
    onchainos(`swap quote --from ${from} --to ${to} --readable-amount ${amount} --chain ${chainId}${swapMode ? ` --swap-mode ${swapMode}` : ""}`),

  execute: (from: string, to: string, amount: string, wallet: string, chainId: number = 196, slippage?: string, gasLevel?: string): OnchainosResult<unknown> =>
    onchainos(`swap execute --from ${from} --to ${to} --readable-amount ${amount} --wallet ${wallet} --chain ${chainId}${slippage ? ` --slippage ${slippage}` : ""}${gasLevel ? ` --gas-level ${gasLevel}` : ""}`),

  /** Calldata only — does NOT sign or broadcast */
  swap: (from: string, to: string, amount: string, wallet: string, chainId: number = 196, slippage?: string): OnchainosResult<unknown> =>
    onchainos(`swap swap --from ${from} --to ${to} --readable-amount ${amount} --wallet ${wallet} --chain ${chainId}${slippage ? ` --slippage ${slippage}` : ""}`),
};

// ---------------------------------------------------------------------------
// Token
// ---------------------------------------------------------------------------

export const onchainosToken = {
  search: (query: string, chains: string = "xlayer"): OnchainosResult<unknown> =>
    onchainos(`token search --query "${query}" --chains ${chains}`),

  info: (token: string, chainId: number = 196): OnchainosResult<unknown> =>
    onchainos(`token info --address ${token} --chain ${chainId}`),

  priceInfo: (token: string, chainId: number = 196): OnchainosResult<unknown> =>
    onchainos(`token price-info --address ${token} --chain ${chainId}`),

  holders: (token: string, chainId: number = 196, tagFilter?: number): OnchainosResult<unknown> =>
    onchainos(`token holders --address ${token} --chain ${chainId}${tagFilter ? ` --tag-filter ${tagFilter}` : ""}`),

  liquidity: (token: string, chainId: number = 196): OnchainosResult<unknown> =>
    onchainos(`token liquidity --address ${token} --chain ${chainId}`),

  hotTokens: (chainId: number = 196, rankingType?: string, rankBy?: string, timeFrame?: string): OnchainosResult<unknown> =>
    onchainos(`token hot-tokens --chain ${chainId}${rankingType ? ` --ranking-type ${rankingType}` : ""}${rankBy ? ` --rank-by ${rankBy}` : ""}${timeFrame ? ` --time-frame ${timeFrame}` : ""}`),

  advancedInfo: (token: string, chainId: number = 196): OnchainosResult<unknown> =>
    onchainos(`token advanced-info --address ${token} --chain ${chainId}`),

  topTrader: (token: string, chainId: number = 196, tagFilter?: number): OnchainosResult<unknown> =>
    onchainos(`token top-trader --address ${token} --chain ${chainId}${tagFilter ? ` --tag-filter ${tagFilter}` : ""}`),

  trades: (token: string, chainId: number = 196, limit?: number, tagFilter?: number): OnchainosResult<unknown> =>
    onchainos(`token trades --address ${token} --chain ${chainId}${limit ? ` --limit ${limit}` : ""}${tagFilter ? ` --tag-filter ${tagFilter}` : ""}`),

  clusterOverview: (token: string, chainId: number = 196): OnchainosResult<unknown> =>
    onchainos(`token cluster-overview --address ${token} --chain ${chainId}`),

  clusterTopHolders: (token: string, rangeFilter: string, chainId: number = 196): OnchainosResult<unknown> =>
    onchainos(`token cluster-top-holders --address ${token} --range-filter ${rangeFilter} --chain ${chainId}`),

  clusterList: (token: string, chainId: number = 196): OnchainosResult<unknown> =>
    onchainos(`token cluster-list --address ${token} --chain ${chainId}`),

  clusterSupportedChains: (): OnchainosResult<unknown> =>
    onchainos("token cluster-supported-chains"),
};

// ---------------------------------------------------------------------------
// Signal
// ---------------------------------------------------------------------------

export const onchainosSignal = {
  activities: (trackerType: string = "smart_money", chainId: number = 196, tradeType?: string, minVolume?: string): OnchainosResult<unknown> =>
    onchainos(`tracker activities --tracker-type ${trackerType} --chain ${chainId}${tradeType ? ` --trade-type ${tradeType}` : ""}${minVolume ? ` --min-volume ${minVolume}` : ""}`),

  signalChains: (): OnchainosResult<unknown> =>
    onchainos("signal chains"),

  list: (chainId: number = 196, walletType?: string, minAmountUsd?: string, tokenAddress?: string): OnchainosResult<unknown> =>
    onchainos(`signal list --chain ${chainId}${walletType ? ` --wallet-type ${walletType}` : ""}${minAmountUsd ? ` --min-amount-usd ${minAmountUsd}` : ""}${tokenAddress ? ` --token-address ${tokenAddress}` : ""}`),

  leaderboardChains: (): OnchainosResult<unknown> =>
    onchainos("leaderboard supported-chains"),

  leaderboardList: (chainId: number = 196, timeFrame: string = "3", sortBy: string = "1", walletType?: string): OnchainosResult<unknown> =>
    onchainos(`leaderboard list --chain ${chainId} --time-frame ${timeFrame} --sort-by ${sortBy}${walletType ? ` --wallet-type ${walletType}` : ""}`),
};

// ---------------------------------------------------------------------------
// Market
// ---------------------------------------------------------------------------

export const onchainosMarket = {
  price: (token: string, chainId: number = 196): OnchainosResult<unknown> =>
    onchainos(`market price --address ${token} --chain ${chainId}`),

  prices: (tokens: string[], chainId: number = 196): OnchainosResult<unknown> =>
    onchainos(`market prices --tokens ${tokens.join(",")} --chain ${chainId}`),

  kline: (token: string, chainId: number = 196, bar?: string, limit?: number): OnchainosResult<unknown> =>
    onchainos(`market kline --address ${token} --chain ${chainId}${bar ? ` --bar ${bar}` : ""}${limit ? ` --limit ${limit}` : ""}`),

  /** Index price aggregated from multiple sources */
  index: (token: string, chainId: number = 196): OnchainosResult<unknown> =>
    onchainos(`market index --address ${token} --chain ${chainId}`),
};

// ---------------------------------------------------------------------------
// DeFi
// ---------------------------------------------------------------------------

export const onchainosDefi = {
  supportChains: (): OnchainosResult<unknown> =>
    onchainos("defi support-chains"),

  supportPlatforms: (): OnchainosResult<unknown> =>
    onchainos("defi support-platforms"),

  /** List all DeFi products by APY */
  list: (pageNum: number = 1): OnchainosResult<unknown> =>
    onchainos(`defi list --page-num ${pageNum}`),

  /** Search DeFi products — use --token and/or --platform, product-group: SINGLE_EARN, DEX_POOL, LENDING */
  search: (token: string, chainId: number = 196, productGroup: string = "DEX_POOL", platform?: string): OnchainosResult<unknown> =>
    onchainos(`defi search --token "${token}" --chain ${chainId} --product-group ${productGroup}${platform ? ` --platform "${platform}"` : ""}`),

  /** Get pool/product detail by investment ID (no --chain param) */
  detail: (investmentId: number): OnchainosResult<unknown> =>
    onchainos(`defi detail --investment-id ${investmentId}`),

  /** Get pre-investment info: accepted tokens, V3 tick parameters */
  prepare: (investmentId: number): OnchainosResult<unknown> =>
    onchainos(`defi prepare --investment-id ${investmentId}`),

  /** Calculate V3 pool entry amounts */
  calculateEntry: (investmentId: number, address: string, inputToken: string, inputAmount: string, tokenDecimal: number, tickLower?: number, tickUpper?: number): OnchainosResult<unknown> =>
    onchainos(`defi calculate-entry --id ${investmentId} --address ${address} --input-token ${inputToken} --input-amount ${inputAmount} --token-decimal ${tokenDecimal}${tickLower !== undefined ? ` --tick-lower=${tickLower}` : ""}${tickUpper !== undefined ? ` --tick-upper=${tickUpper}` : ""}`),

  /** Generate calldata to enter a DeFi position */
  deposit: (investmentId: number, address: string, userInput: string, slippage?: string, tickLower?: number, tickUpper?: number): OnchainosResult<unknown> =>
    onchainos(`defi deposit --investment-id ${investmentId} --address ${address} --user-input '${userInput}'${slippage ? ` --slippage ${slippage}` : ""}${tickLower !== undefined ? ` --tick-lower=${tickLower}` : ""}${tickUpper !== undefined ? ` --tick-upper=${tickUpper}` : ""}`),

  /** Generate calldata to exit a DeFi position */
  redeem: (investmentId: number, address: string, ratio?: string, chainId?: number, tokenId?: string, userInput?: string, slippage?: string): OnchainosResult<unknown> =>
    onchainos(`defi redeem --id ${investmentId} --address ${address}${ratio ? ` --ratio ${ratio}` : ""}${chainId ? ` --chain ${chainId}` : ""}${tokenId ? ` --token-id ${tokenId}` : ""}${userInput ? ` --user-input '${userInput}'` : ""}${slippage ? ` --slippage ${slippage}` : ""}`),

  /** Generate calldata to claim DeFi rewards */
  claim: (address: string, rewardType: string, chainId?: number, investmentId?: number, platformId?: string, tokenId?: string, expectOutput?: string): OnchainosResult<unknown> =>
    onchainos(`defi claim --address ${address} --reward-type ${rewardType}${chainId ? ` --chain ${chainId}` : ""}${investmentId ? ` --id ${investmentId}` : ""}${platformId ? ` --platform-id ${platformId}` : ""}${tokenId ? ` --token-id ${tokenId}` : ""}${expectOutput ? ` --expect-output '${expectOutput}'` : ""}`),

  /** Get user DeFi holdings overview */
  positions: (address: string, chains: string = "xlayer"): OnchainosResult<unknown> =>
    onchainos(`defi positions --address ${address} --chains ${chains}`),

  /** Get detailed DeFi holdings for a specific protocol */
  positionDetail: (address: string, chainId: number, platformId: string): OnchainosResult<unknown> =>
    onchainos(`defi position-detail --address ${address} --chain ${chainId} --platform-id ${platformId}`),
};

// ---------------------------------------------------------------------------
// Portfolio
// ---------------------------------------------------------------------------

export const onchainosPortfolio = {
  chains: (): OnchainosResult<unknown> =>
    onchainos("portfolio chains"),

  supportedChains: (): OnchainosResult<unknown> =>
    onchainos("portfolio supported-chains"),

  totalValue: (address: string, chains: string = "xlayer"): OnchainosResult<unknown> =>
    onchainos(`portfolio total-value --address ${address} --chains ${chains}`),

  allBalances: (address: string, chains: string = "xlayer"): OnchainosResult<unknown> =>
    onchainos(`portfolio all-balances --address ${address} --chains ${chains}`),

  tokenBalances: (address: string, tokens: string): OnchainosResult<unknown> =>
    onchainos(`portfolio token-balances --address ${address} --tokens ${tokens}`),

  overview: (address: string, chainId: number = 196, timeFrame?: string): OnchainosResult<unknown> =>
    onchainos(`portfolio overview --address ${address} --chain ${chainId}${timeFrame ? ` --time-frame ${timeFrame}` : ""}`),

  dexHistory: (address: string, chainId: number = 196, begin?: string, end?: string, limit?: number, cursor?: string, token?: string, txType?: string): OnchainosResult<unknown> =>
    onchainos(`portfolio dex-history --address ${address} --chain ${chainId}${begin ? ` --begin ${begin}` : ""}${end ? ` --end ${end}` : ""}${limit ? ` --limit ${limit}` : ""}${cursor ? ` --cursor ${cursor}` : ""}${token ? ` --token ${token}` : ""}${txType ? ` --tx-type ${txType}` : ""}`),

  recentPnl: (address: string, chainId: number = 196, limit?: number): OnchainosResult<unknown> =>
    onchainos(`portfolio recent-pnl --address ${address} --chain ${chainId}${limit ? ` --limit ${limit}` : ""}`),

  tokenPnl: (address: string, chainId: number, token: string): OnchainosResult<unknown> =>
    onchainos(`portfolio token-pnl --address ${address} --chain ${chainId} --token ${token}`),
};

// ---------------------------------------------------------------------------
// Trenches
// ---------------------------------------------------------------------------

export const onchainosTrenches = {
  chains: (): OnchainosResult<unknown> =>
    onchainos("memepump chains"),

  tokens: (stage: string = "NEW", chainId: number = 196): OnchainosResult<unknown> =>
    onchainos(`memepump tokens --chain ${chainId} --stage ${stage}`),

  tokenDetails: (token: string, chainId: number = 196): OnchainosResult<unknown> =>
    onchainos(`memepump token-details --address ${token} --chain ${chainId}`),

  /** Real dev info: rug pull history, migration stats, holding info */
  tokenDevInfo: (token: string, chainId: number = 196): OnchainosResult<unknown> =>
    onchainos(`memepump token-dev-info --address ${token} --chain ${chainId}`),

  similarTokens: (token: string, chainId: number = 196): OnchainosResult<unknown> =>
    onchainos(`memepump similar-tokens --address ${token} --chain ${chainId}`),

  tokenBundleInfo: (token: string, chainId: number = 196): OnchainosResult<unknown> =>
    onchainos(`memepump token-bundle-info --address ${token} --chain ${chainId}`),

  apedWallet: (token: string, chainId: number = 196): OnchainosResult<unknown> =>
    onchainos(`memepump aped-wallet --address ${token} --chain ${chainId}`),
};

// ---------------------------------------------------------------------------
// Gateway
// ---------------------------------------------------------------------------

export const onchainosGateway = {
  chains: (): OnchainosResult<unknown> =>
    onchainos("gateway chains"),

  gas: (chainId: number = 196): OnchainosResult<unknown> =>
    onchainos(`gateway gas --chain ${chainId}`),

  gasLimit: (from: string, to: string, chainId: number = 196, data?: string): OnchainosResult<unknown> =>
    onchainos(`gateway gas-limit --from ${from} --to ${to} --chain ${chainId}${data ? ` --data ${data}` : ""}`),

  simulate: (from: string, to: string, data: string, chainId: number = 196, amount?: string): OnchainosResult<unknown> =>
    onchainos(`gateway simulate --from ${from} --to ${to} --data ${data} --chain ${chainId}${amount ? ` --amount ${amount}` : ""}`),

  broadcast: (signedTx: string, address: string, chainId: number = 196): OnchainosResult<unknown> =>
    onchainos(`gateway broadcast --signed-tx ${signedTx} --address ${address} --chain ${chainId}`),

  orders: (address: string, chainId: number = 196, orderId?: string): OnchainosResult<unknown> =>
    onchainos(`gateway orders --address ${address} --chain ${chainId}${orderId ? ` --order-id ${orderId}` : ""}`),
};
