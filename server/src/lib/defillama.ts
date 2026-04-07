const YIELDS_URL = "https://yields.llama.fi/pools";

export interface LlamaPool {
  pool: string;
  chain: string;
  project: string;
  symbol: string;
  tvlUsd: number;
  apyBase: number | null;
  apyReward: number | null;
  apy: number;
  stablecoin: boolean;
  exposure: string;
  volumeUsd1d: number | null;
  volumeUsd7d: number | null;
}

let cachedPools: LlamaPool[] = [];
let cacheTime = 0;
const CACHE_TTL = 10 * 60 * 1000;

async function fetchPools(): Promise<LlamaPool[]> {
  if (cachedPools.length > 0 && Date.now() - cacheTime < CACHE_TTL) {
    return cachedPools;
  }
  try {
    const res = await fetch(YIELDS_URL);
    if (!res.ok) return cachedPools;
    const data = await res.json() as { data?: LlamaPool[] };
    cachedPools = data.data ?? [];
    cacheTime = Date.now();
    return cachedPools;
  } catch {
    return cachedPools;
  }
}

export async function getUniswapPools(chain?: string): Promise<LlamaPool[]> {
  const pools = await fetchPools();
  return pools.filter((p) => {
    const isUniswap = p.project.toLowerCase().includes("uniswap");
    if (!isUniswap) return false;
    if (chain) return p.chain.toLowerCase() === chain.toLowerCase();
    return true;
  });
}

export async function getPoolApy(symbol: string, chain?: string): Promise<LlamaPool | null> {
  const pools = await fetchPools();
  const matches = pools.filter((p) => {
    const symbolMatch = p.symbol.toLowerCase().includes(symbol.toLowerCase());
    const isUniswap = p.project.toLowerCase().includes("uniswap");
    if (!symbolMatch || !isUniswap) return false;
    if (chain) return p.chain.toLowerCase() === chain.toLowerCase();
    return true;
  });
  if (matches.length === 0) return null;
  return matches.sort((a, b) => b.tvlUsd - a.tvlUsd)[0];
}
