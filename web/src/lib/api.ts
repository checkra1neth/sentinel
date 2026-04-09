const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3002";

export const REFETCH_FAST = 10_000;   // 10s — real-time data
export const REFETCH_NORMAL = 30_000; // 30s — standard polling
export const REFETCH_SLOW = 60_000;   // 60s — slow-changing data

// staleTime — how long data is "fresh" (no refetch at all)
export const STALE_FAST = 10_000;     // 10s — prices, PnL
export const STALE_NORMAL = 60_000;   // 60s — portfolio, positions
export const STALE_SLOW = 5 * 60_000; // 5min — approvals, history, leaderboard

async function get<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${API_URL}/api${path}`);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

async function post<T>(path: string, body?: unknown): Promise<T | null> {
  try {
    const res = await fetch(`${API_URL}/api${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

async function patch<T>(path: string, body: unknown): Promise<T | null> {
  try {
    const res = await fetch(`${API_URL}/api${path}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

async function del<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${API_URL}/api${path}`, { method: "DELETE" });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

// -- Discover endpoints --

export interface DiscoverToken {
  token: string;
  tokenSymbol?: string;
  tokenName?: string;
  priceUsd?: number;
  priceChange24h?: number;
  marketCap?: number;
  liquidityUsd?: number;
  volume24h?: number;
  riskScore?: number;
  verdict?: "SAFE" | "CAUTION" | "DANGEROUS";
  source: "WHALE" | "SMART $" | "TRENDING" | "SCANNER" | "KOL";
  smartMoneyCount?: number;
  timestamp: number;
}

export interface Verdict {
  token: string;
  tokenName: string;
  tokenSymbol: string;
  riskScore: number;
  verdict: "SAFE" | "CAUTION" | "DANGEROUS";
  isHoneypot: boolean;
  hasRug: boolean;
  hasMint: boolean;
  isProxy: boolean;
  buyTax: number;
  sellTax: number;
  holderConcentration: number;
  risks: string[];
  priceUsd: number;
  marketCap: number;
  liquidityUsd: number;
  timestamp: number;
  txHash?: string;
  lpInvested?: string;
  holders?: number;
  priceChange24H?: number;
  volume24H?: number;
}

export interface DexPair {
  pairAddress: string;
  chainId: string;
  baseToken: { address: string; name: string; symbol: string };
  priceUsd: string;
  priceChange: { h24: number };
  volume: { h24: number };
  liquidity: { usd: number };
  fdv: number;
  marketCap: number;
}

export async function fetchDiscoverFeed(): Promise<Record<string, unknown>[]> {
  const data = await get<{ tokens?: Record<string, unknown>[] }>("/discover/feed?limit=200");
  return data?.tokens ?? [];
}

export async function fetchWhaleSignals(): Promise<Record<string, unknown>[]> {
  const data = await get<{ signals?: Record<string, unknown>[] }>("/discover/whales?limit=100");
  return data?.signals ?? [];
}

export async function fetchTrending(): Promise<Record<string, unknown>[]> {
  const data = await get<{ tokens?: Record<string, unknown>[] }>("/dex/trending");
  return data?.tokens ?? [];
}

export async function fetchVerdicts(limit = 200): Promise<Verdict[]> {
  const data = await get<{ verdicts?: Verdict[] }>(`/verdicts?limit=${limit}`);
  return data?.verdicts ?? [];
}

export async function fetchLeaderboard(timeFrame = "3", sortBy = "1"): Promise<Record<string, unknown>> {
  const data = await get<Record<string, unknown>>(`/leaderboard?timeFrame=${timeFrame}&sortBy=${sortBy}`);
  return data ?? {};
}

// -- Token Profile endpoints --

export async function fetchTokenPairs(address: string): Promise<DexPair[]> {
  const data = await get<{ pairs?: DexPair[] }>(`/dex/pairs/${address}`);
  return data?.pairs ?? [];
}

export async function fetchAnalysis(address: string): Promise<Verdict | null> {
  const data = await get<{ verdict?: Verdict }>(`/analyze/${address}`);
  return data?.verdict ?? null;
}

/** Fast GoPlus-based security check for swap pre-flight */
export async function fetchSwapSecurity(address: string, chainId?: number): Promise<Verdict | null> {
  const qs = chainId ? `?chainId=${chainId}` : "";
  const data = await get<Record<string, unknown>>(`/swap/security/${address}${qs}`);
  if (!data) return null;
  return {
    token: address,
    tokenName: "",
    tokenSymbol: String(data.tokenSymbol ?? ""),
    riskScore: Number(data.riskScore ?? 50),
    verdict: String(data.verdict ?? "UNKNOWN") as Verdict["verdict"],
    isHoneypot: Boolean(data.isHoneypot),
    hasRug: false,
    hasMint: false,
    isProxy: false,
    buyTax: Number(data.buyTax ?? 0),
    sellTax: Number(data.sellTax ?? 0),
    holderConcentration: 0,
    risks: (data.warnings as string[]) ?? [],
    priceUsd: 0,
    marketCap: 0,
    liquidityUsd: 0,
    timestamp: Date.now(),
    holders: Number(data.holderCount ?? 0),
  };
}

export async function fetchTokenHolders(address: string, tag?: number): Promise<Record<string, unknown>> {
  const path = tag ? `/token/holders/${address}?tag=${tag}` : `/token/holders/${address}`;
  const data = await get<Record<string, unknown>>(path);
  return data ?? {};
}

export async function fetchTokenCluster(address: string): Promise<Record<string, unknown>> {
  const data = await get<Record<string, unknown>>(`/token/cluster/${address}`);
  return data ?? {};
}

export async function fetchTopTraders(address: string): Promise<Record<string, unknown>> {
  const data = await get<Record<string, unknown>>(`/token/top-traders/${address}`);
  return data ?? {};
}

export async function fetchTokenTrades(address: string, limit = 100): Promise<Record<string, unknown>> {
  const data = await get<Record<string, unknown>>(`/token/trades/${address}?limit=${limit}`);
  return data ?? {};
}

export async function fetchClusterHolders(address: string, range = "3"): Promise<Record<string, unknown>> {
  const data = await get<Record<string, unknown>>(`/token/cluster-holders/${address}?range=${range}`);
  return data ?? {};
}

export async function fetchDevInfo(address: string): Promise<Record<string, unknown>> {
  const data = await get<Record<string, unknown>>(`/trenches/dev-info/${address}`);
  return data ?? {};
}

export async function fetchSimilarTokens(address: string): Promise<Record<string, unknown>> {
  const data = await get<Record<string, unknown>>(`/trenches/similar/${address}`);
  return data ?? {};
}

export async function fetchBundleInfo(address: string): Promise<Record<string, unknown>> {
  const data = await get<Record<string, unknown>>(`/trenches/bundle/${address}`);
  return data ?? {};
}

export async function fetchApedWallets(address: string): Promise<Record<string, unknown>> {
  const data = await get<Record<string, unknown>>(`/trenches/aped/${address}`);
  return data ?? {};
}

// -- Analyze endpoints --

export interface DappScanResult {
  domain: string;
  isPhishing: boolean;
  isMalware: boolean;
  isSuspicious: boolean;
  riskLevel: string;
  [key: string]: unknown;
}

export async function scanToken(address: string): Promise<Verdict | null> {
  const data = await post<{ verdict?: Verdict }>(`/scan/${address}`);
  return data?.verdict ?? null;
}

export async function rescanToken(address: string): Promise<Verdict | null> {
  const data = await post<{ verdict?: Verdict }>(`/analyze/${address}/rescan`);
  return data?.verdict ?? null;
}

export async function scanDapp(domain: string): Promise<DappScanResult | null> {
  return get<DappScanResult>(`/security/dapp-scan?domain=${encodeURIComponent(domain)}`);
}

export async function fetchTokenInfo(address: string, chainId?: number): Promise<Record<string, unknown>> {
  const qs = chainId ? `?chainId=${chainId}` : "";
  const data = await get<Record<string, unknown>>(`/token/info/${address}${qs}`);
  return data ?? {};
}

// -- Portfolio endpoints --

export async function fetchPortfolioOverview(timeFrame = "7d"): Promise<Record<string, unknown>> {
  const data = await get<Record<string, unknown>>(`/portfolio/overview?timeFrame=${timeFrame}`);
  return data ?? {};
}

export async function fetchPortfolioPnl(): Promise<Record<string, unknown>> {
  const data = await get<Record<string, unknown>>("/portfolio/pnl");
  return data ?? {};
}

export async function fetchManagedPortfolio(): Promise<Record<string, unknown>> {
  const data = await get<Record<string, unknown>>("/manage/portfolio");
  return data ?? {};
}

export async function fetchAgentBalances(): Promise<Record<string, unknown>> {
  const data = await get<Record<string, unknown>>("/manage/balances");
  return data ?? {};
}

export async function fetchLpPositions(): Promise<Record<string, unknown>> {
  const data = await get<Record<string, unknown>>("/portfolio");
  return data ?? {};
}

export async function collectAllRewards(): Promise<Record<string, unknown>> {
  const data = await post<Record<string, unknown>>("/manage/collect-all");
  return data ?? {};
}

export async function exitPosition(investmentId: string, ratio = 1): Promise<Record<string, unknown>> {
  const data = await post<Record<string, unknown>>(`/manage/exit/${investmentId}`, { ratio });
  return data ?? {};
}

export async function fetchApprovals(address: string): Promise<Record<string, unknown>> {
  // Fetch all chains in parallel, paginate each until no more cursor
  const chainIds = [1, 56, 137, 42161, 10, 8453, 196, 324, 43114, 250];
  const allItems: Record<string, unknown>[] = [];

  const fetches = chainIds.map(async (chain) => {
    let cursor: string | undefined;
    for (let page = 0; page < 10; page++) {
      const qs = `?chain=${chain}&limit=100${cursor ? `&cursor=${cursor}` : ""}`;
      const data = await get<Record<string, unknown>>(`/security/approvals/${address}${qs}`);
      const inner = (data?.data ?? data) as Record<string, unknown> | undefined;
      const list = inner?.dataList as Record<string, unknown>[] | undefined;
      if (Array.isArray(list) && list.length > 0) {
        allItems.push(...list);
        const nextCursor = inner?.cursor ? String(inner.cursor) : undefined;
        if (!nextCursor || nextCursor === "0" || list.length < 100) break;
        cursor = nextCursor;
      } else {
        break;
      }
    }
  });

  await Promise.all(fetches);
  return { success: true, data: { dataList: allItems, total: allItems.length } };
}

export async function fetchDexHistory(params?: {
  limit?: number;
  cursor?: string;
  token?: string;
  txType?: string;
  begin?: string;
  end?: string;
}): Promise<Record<string, unknown>> {
  const qs = new URLSearchParams();
  if (params?.limit) qs.set("limit", String(params.limit));
  if (params?.cursor) qs.set("cursor", params.cursor);
  if (params?.token) qs.set("token", params.token);
  if (params?.txType) qs.set("txType", params.txType);
  if (params?.begin) qs.set("begin", params.begin);
  if (params?.end) qs.set("end", params.end);
  const data = await get<Record<string, unknown>>(`/portfolio/history?${qs.toString()}`);
  return data ?? {};
}

export async function fetchAgents(): Promise<Record<string, unknown>> {
  const data = await get<Record<string, unknown>>("/agents");
  return data ?? {};
}

// -- Trade endpoints --

export async function fetchGas(): Promise<Record<string, unknown>> {
  const data = await get<Record<string, unknown>>("/gateway/gas");
  return data ?? {};
}

export async function fetchSwapQuote(from: string, to: string, amount: string, chainId?: number, router?: string, wallet?: string, fromDecimals?: number): Promise<Record<string, unknown>> {
  const qs = `/swap/quote?from=${from}&to=${to}&amount=${encodeURIComponent(amount)}${chainId ? `&chainId=${chainId}` : ""}${router ? `&router=${router}` : ""}${wallet ? `&wallet=${wallet}` : ""}${fromDecimals ? `&fromDecimals=${fromDecimals}` : ""}`;
  const data = await get<Record<string, unknown>>(qs);
  return data ?? {};
}

export async function fetchSwapCalldata(from: string, to: string, amount: string, wallet: string, chainId?: number, slippage?: number, router?: string, fromDecimals?: number): Promise<Record<string, unknown>> {
  const qs = `/swap/calldata?from=${from}&to=${to}&amount=${encodeURIComponent(amount)}&wallet=${wallet}${chainId ? `&chainId=${chainId}` : ""}${slippage ? `&slippage=${slippage}` : ""}${router ? `&router=${router}` : ""}${fromDecimals ? `&fromDecimals=${fromDecimals}` : ""}`;
  const data = await get<Record<string, unknown>>(qs);
  return data ?? {};
}

export async function fetchWalletBalance(token?: string, chainId?: number): Promise<Record<string, unknown>> {
  const path = `/wallet/balance?${token ? `token=${token}&` : ""}${chainId ? `chainId=${chainId}` : ""}`;
  const data = await get<Record<string, unknown>>(path);
  return data ?? {};
}

export async function fetchTokenBalances(chainId: number): Promise<Record<string, unknown>> {
  const data = await get<Record<string, unknown>>(`/wallet/token-balances?chainId=${chainId}`);
  return data ?? {};
}

export async function fetchPopularTokens(chainId: number): Promise<Record<string, unknown>> {
  const data = await get<Record<string, unknown>>(`/tokens/popular?chainId=${chainId}`);
  return data ?? {};
}

export async function simulateTx(from: string, to: string, data: string): Promise<Record<string, unknown>> {
  const res = await post<Record<string, unknown>>("/gateway/simulate", { from, to, data });
  return res ?? {};
}

export async function executeSwap(fromToken: string, toToken: string, amount: string): Promise<Record<string, unknown>> {
  const data = await post<Record<string, unknown>>("/invest/swap", { fromToken, toToken, amount });
  return data ?? {};
}

export async function searchTokens(query: string): Promise<Record<string, unknown>[]> {
  const data = await get<{ pairs?: Record<string, unknown>[] }>(`/dex/search?q=${encodeURIComponent(query)}`);
  return data?.pairs ?? [];
}

export async function fetchDefiProducts(page = 1): Promise<Record<string, unknown>> {
  const data = await get<Record<string, unknown>>(`/defi/products?page=${page}`);
  return data ?? {};
}

export async function fetchDefiDetail(investmentId: string, token?: string, chainId?: number): Promise<Record<string, unknown>> {
  const qs = token ? `?token=${encodeURIComponent(token)}${chainId ? `&chainId=${chainId}` : ""}` : "";
  const data = await get<Record<string, unknown>>(`/defi/detail/${investmentId}${qs}`);
  return data ?? {};
}

export async function fetchDefiSearch(token: string, chainId?: number, productGroup?: string): Promise<Record<string, unknown>> {
  const qs = new URLSearchParams({ token });
  if (chainId) qs.set("chainId", String(chainId));
  if (productGroup) qs.set("productGroup", productGroup);
  const data = await get<Record<string, unknown>>(`/defi/search-pool?${qs.toString()}`);
  return data ?? {};
}

export async function fetchDefiPrepare(investmentId: string): Promise<Record<string, unknown>> {
  const data = await get<Record<string, unknown>>(`/defi/prepare/${investmentId}`);
  return data ?? {};
}

export async function fetchDefiCalculateEntry(params: {
  investmentId: string;
  address: string;
  inputToken: string;
  amount: string;
  decimal: number;
  tickLower?: number;
  tickUpper?: number;
}): Promise<Record<string, unknown>> {
  const qs = new URLSearchParams({
    investmentId: params.investmentId,
    address: params.address,
    inputToken: params.inputToken,
    amount: params.amount,
    decimal: String(params.decimal),
  });
  if (params.tickLower !== undefined) qs.set("tickLower", String(params.tickLower));
  if (params.tickUpper !== undefined) qs.set("tickUpper", String(params.tickUpper));
  const data = await get<Record<string, unknown>>(`/defi/calculate-entry?${qs.toString()}`);
  return data ?? {};
}

export async function fetchDefiDepositCalldata(params: {
  investmentId: string;
  address: string;
  userInput: string;
  slippage?: string;
  tickLower?: number;
  tickUpper?: number;
}): Promise<Record<string, unknown>> {
  const data = await post<Record<string, unknown>>("/defi/deposit", params);
  return data ?? {};
}

export async function fetchDefiPositions(address: string, chains = "xlayer"): Promise<Record<string, unknown>> {
  const data = await get<Record<string, unknown>>(`/defi/positions/${address}?chains=${chains}`);
  return data ?? {};
}

export async function previewInvestment(token: string, amount: string, tokenSymbol: string): Promise<Record<string, unknown>> {
  const data = await post<Record<string, unknown>>("/invest/preview", { token, amount, tokenSymbol });
  return data ?? {};
}

export async function executeInvestment(token: string, amount: string, tokenSymbol: string, riskScore: number): Promise<Record<string, unknown>> {
  const data = await post<Record<string, unknown>>("/invest/execute", { token, amount, tokenSymbol, riskScore });
  return data ?? {};
}

export async function fetchYields(symbol?: string): Promise<Record<string, unknown>> {
  const path = symbol ? `/yields?symbol=${encodeURIComponent(symbol)}` : "/yields";
  const data = await get<Record<string, unknown>>(path);
  return data ?? {};
}

// -- Agents endpoints --

export async function fetchPendingAnalyze(): Promise<Record<string, unknown>[]> {
  const data = await get<{ tokens?: Record<string, unknown>[] }>("/pending/analyze");
  return data?.tokens ?? [];
}

export async function fetchPendingInvest(): Promise<Record<string, unknown>[]> {
  const data = await get<{ tokens?: Record<string, unknown>[] }>("/pending/invest");
  return data?.tokens ?? [];
}

export async function approvePendingAnalyze(token: string): Promise<Record<string, unknown>> {
  const data = await post<Record<string, unknown>>(`/pending/analyze/${token}/approve`);
  return data ?? {};
}

export async function approvePendingInvest(token: string): Promise<Record<string, unknown>> {
  const data = await post<Record<string, unknown>>(`/pending/invest/${token}/approve`);
  return data ?? {};
}

export async function rejectPending(token: string): Promise<Record<string, unknown>> {
  const data = await del<Record<string, unknown>>(`/pending/${token}`);
  return data ?? {};
}

export async function fetchSettings(): Promise<Record<string, unknown>> {
  const data = await get<Record<string, unknown>>("/settings");
  return data ?? {};
}

export async function updateSettings(settings: Record<string, unknown>): Promise<Record<string, unknown>> {
  const data = await patch<Record<string, unknown>>("/settings", settings);
  return data ?? {};
}

// -- Formatting helpers --

export function formatUsd(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
  if (v >= 1) return `$${v.toFixed(2)}`;
  return `$${v.toFixed(6)}`;
}

export function formatPercent(v: number): string {
  if (v >= 1000) return `${(v / 1000).toFixed(1)}K%`;
  return `${v.toFixed(2)}%`;
}

export function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

export function truncAddr(addr: string): string {
  if (addr.length < 12) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}
