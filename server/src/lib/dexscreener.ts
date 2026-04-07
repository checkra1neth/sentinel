const BASE_URL = "https://api.dexscreener.com";

export interface DexPair {
  pairAddress: string;
  chainId: string;
  dexId: string;
  url: string;
  baseToken: { address: string; name: string; symbol: string };
  quoteToken: { address: string; name: string; symbol: string };
  priceNative: string;
  priceUsd: string;
  priceChange: { m5: number; h1: number; h6: number; h24: number };
  volume: { m5: number; h1: number; h6: number; h24: number };
  liquidity: { usd: number; base: number; quote: number };
  fdv: number;
  marketCap: number;
  pairCreatedAt: number;
  info?: {
    imageUrl?: string;
    websites?: Array<{ url: string }>;
    socials?: Array<{ platform: string; handle: string }>;
  };
}

export interface BoostedToken {
  chainId: number;
  tokenAddress: string;
  icon?: string;
  description?: string;
  amount: number;
}

export async function getTokenPairs(network: string, tokenAddress: string): Promise<DexPair[]> {
  try {
    const res = await fetch(`${BASE_URL}/token-pairs/v1/${network}/${tokenAddress}`);
    if (!res.ok) return [];
    const data = await res.json() as { pairs?: DexPair[] } | DexPair[];
    return Array.isArray(data) ? data : (data.pairs ?? []);
  } catch {
    return [];
  }
}

export async function searchTokens(query: string): Promise<DexPair[]> {
  try {
    const res = await fetch(`${BASE_URL}/latest/dex/search?q=${encodeURIComponent(query)}`);
    if (!res.ok) return [];
    const data = await res.json() as { pairs?: DexPair[] };
    return data.pairs ?? [];
  } catch {
    return [];
  }
}

export async function getTrendingTokens(): Promise<BoostedToken[]> {
  try {
    const res = await fetch(`${BASE_URL}/token-boosts/top/v1`);
    if (!res.ok) return [];
    const data = await res.json() as BoostedToken[] | { tokens?: BoostedToken[] };
    return Array.isArray(data) ? data : (data.tokens ?? []);
  } catch {
    return [];
  }
}
