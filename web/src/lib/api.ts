const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3002";

async function get<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${API_URL}/api${path}`);
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
  const data = await get<{ tokens?: Record<string, unknown>[] }>("/discover/feed?limit=50");
  return data?.tokens ?? [];
}

export async function fetchWhaleSignals(): Promise<Record<string, unknown>[]> {
  const data = await get<{ signals?: Record<string, unknown>[] }>("/discover/whales?limit=30");
  return data?.signals ?? [];
}

export async function fetchTrending(): Promise<Record<string, unknown>[]> {
  const data = await get<{ tokens?: Record<string, unknown>[] }>("/dex/trending");
  return data?.tokens ?? [];
}

export async function fetchVerdicts(limit = 50): Promise<Verdict[]> {
  const data = await get<{ verdicts?: Verdict[] }>(`/verdicts?limit=${limit}`);
  return data?.verdicts ?? [];
}

export async function fetchLeaderboard(): Promise<Record<string, unknown>> {
  const data = await get<Record<string, unknown>>("/leaderboard?timeFrame=3&sortBy=1");
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

export async function fetchTokenTrades(address: string, limit = 20): Promise<Record<string, unknown>> {
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

// -- Formatting helpers --

export function formatUsd(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
  if (v >= 1) return `$${v.toFixed(2)}`;
  return `$${v.toFixed(6)}`;
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
