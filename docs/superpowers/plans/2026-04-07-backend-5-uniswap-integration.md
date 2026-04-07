# Backend Part 5: Uniswap Skills Integration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate all 6 Uniswap skills: DexScreener API, DefiLlama yields, Uniswap Trading API, v4 hook security checks. Add new data sources to Scanner, Analyst, Executor.

**Architecture:** 3 new lib files (dexscreener, defillama, uniswap-trading). Modify scanner, analyst, executor to use them. New API endpoints for DexScreener/DefiLlama data. Config for Uniswap API key.

**Tech Stack:** TypeScript, fetch API, existing Express router

**Spec:** `docs/superpowers/specs/2026-04-07-uniswap-integration-spec.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `server/src/lib/dexscreener.ts` | Create | DexScreener API client |
| `server/src/lib/defillama.ts` | Create | DefiLlama yields API client |
| `server/src/lib/uniswap-trading.ts` | Create | Uniswap Trading API client |
| `server/src/config.ts` | Modify | Add UNISWAP_API_KEY |
| `server/src/agents/scanner-agent.ts` | Modify | Add DexScreener trending source |
| `server/src/agents/analyst-agent.ts` | Modify | Add DexScreener + DefiLlama + Trading API risk sources |
| `server/src/agents/executor-agent.ts` | Modify | Add Uniswap quote to preview |
| `server/src/router/service-router.ts` | Modify | Add /dex/* and /yields endpoints |
| `server/src/types.ts` | Modify | Add dexScreener/defiLlama fields to Verdict |

---

### Task 1: Create DexScreener API client

**Files:**
- Create: `server/src/lib/dexscreener.ts`

- [ ] **Step 1: Create dexscreener.ts**

```typescript
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
```

- [ ] **Step 2: Verify with real call**

```bash
cd /Users/pavelmackevic/Projects/agentra/server
npx tsx -e "
import { getTokenPairs, searchTokens, getTrendingTokens } from './src/lib/dexscreener.js';

const pairs = await getTokenPairs('xlayer', '0x1E4a5963aBFD975d8c9021ce480b42188849D41d');
console.log('Pairs for USDT:', pairs.length);
if (pairs[0]) console.log('First:', pairs[0].baseToken?.symbol, pairs[0].priceUsd, 'vol24h:', pairs[0].volume?.h24);

const search = await searchTokens('OKB xlayer');
console.log('Search OKB:', search.length);

const trending = await getTrendingTokens();
console.log('Trending:', trending.length);
"
```

- [ ] **Step 3: Commit**

```bash
git add server/src/lib/dexscreener.ts
git commit -m "feat: add DexScreener API client — pairs, search, trending

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Create DefiLlama yields client

**Files:**
- Create: `server/src/lib/defillama.ts`

- [ ] **Step 1: Create defillama.ts**

```typescript
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
}

let cachedPools: LlamaPool[] = [];
let cacheTime = 0;
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

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
  // Return highest TVL match
  return matches.sort((a, b) => b.tvlUsd - a.tvlUsd)[0];
}
```

- [ ] **Step 2: Verify with real call**

```bash
cd /Users/pavelmackevic/Projects/agentra/server
npx tsx -e "
import { getUniswapPools, getPoolApy } from './src/lib/defillama.js';

const pools = await getUniswapPools('X Layer');
console.log('Uniswap pools on X Layer:', pools.length);
for (const p of pools.slice(0, 3)) {
  console.log(' ', p.symbol, 'APY:', p.apy?.toFixed(2) + '%', 'TVL:', p.tvlUsd);
}

const usdt = await getPoolApy('USDT', 'X Layer');
console.log('USDT pool:', usdt?.symbol, usdt?.apy);
"
```

- [ ] **Step 3: Commit**

```bash
git add server/src/lib/defillama.ts
git commit -m "feat: add DefiLlama yields client — pool APY data with cache

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Create Uniswap Trading API client

**Files:**
- Create: `server/src/lib/uniswap-trading.ts`
- Modify: `server/src/config.ts`

- [ ] **Step 1: Add UNISWAP_API_KEY to config.ts**

Read `server/src/config.ts`. Add to the config object:

```typescript
  uniswap: {
    apiKey: optional("UNISWAP_API_KEY"),
    tradingApiUrl: "https://trade-api.gateway.uniswap.org/v1",
  },
```

- [ ] **Step 2: Create uniswap-trading.ts**

```typescript
import { config } from "../config.js";

const API_URL = config.uniswap.tradingApiUrl;

function headers(): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (config.uniswap.apiKey) h["x-api-key"] = config.uniswap.apiKey;
  return h;
}

export interface UniswapQuote {
  tokenIn: string;
  tokenOut: string;
  amount: string;
  amountDecimals: string;
  quoteGasAdjusted: string;
  gasPriceWei: string;
  route: unknown[];
  routeString: string;
  requestId: string;
  raw: unknown;
}

export interface UniswapSwapCalldata {
  to: string;
  data: string;
  value: string;
  chainId: number;
  gasLimit: string;
}

export async function checkApproval(
  token: string,
  amount: string,
  walletAddress: string,
  chainId: number,
): Promise<unknown> {
  try {
    const res = await fetch(`${API_URL}/check_approval`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ token, amount, walletAddress, chainId }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function getQuote(params: {
  tokenIn: string;
  tokenOut: string;
  tokenInChainId: number;
  tokenOutChainId: number;
  amount: string;
  type: "EXACT_INPUT" | "EXACT_OUTPUT";
  swapper: string;
  slippageTolerance?: number;
}): Promise<UniswapQuote | null> {
  try {
    const body = {
      tokenInChainId: params.tokenInChainId,
      tokenOutChainId: params.tokenOutChainId,
      tokenIn: params.tokenIn,
      tokenOut: params.tokenOut,
      amount: params.amount,
      type: params.type,
      swapper: params.swapper,
      slippageTolerance: params.slippageTolerance,
      configs: [{ routingType: "CLASSIC", protocols: ["V2", "V3"] }],
    };

    const res = await fetch(`${API_URL}/quote`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify(body),
    });

    if (!res.ok) return null;
    const data = await res.json() as Record<string, unknown>;
    const quote = (data.quote ?? data) as Record<string, unknown>;

    return {
      tokenIn: params.tokenIn,
      tokenOut: params.tokenOut,
      amount: String(quote.amount ?? params.amount),
      amountDecimals: String(quote.amountDecimals ?? ""),
      quoteGasAdjusted: String(quote.quoteGasAdjusted ?? ""),
      gasPriceWei: String(quote.gasPriceWei ?? ""),
      route: (quote.route ?? []) as unknown[],
      routeString: String(quote.routeString ?? ""),
      requestId: String(data.requestId ?? ""),
      raw: data,
    };
  } catch {
    return null;
  }
}

export async function getSwapCalldata(quote: UniswapQuote): Promise<UniswapSwapCalldata | null> {
  try {
    const res = await fetch(`${API_URL}/swap`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ quote: quote.raw, simulateTransaction: false }),
    });

    if (!res.ok) return null;
    const data = await res.json() as Record<string, unknown>;
    const swap = (data.swap ?? data) as Record<string, unknown>;

    return {
      to: String(swap.to ?? ""),
      data: String(swap.data ?? ""),
      value: String(swap.value ?? "0"),
      chainId: Number(swap.chainId ?? 196),
      gasLimit: String(swap.gasLimit ?? ""),
    };
  } catch {
    return null;
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add server/src/lib/uniswap-trading.ts server/src/config.ts
git commit -m "feat: add Uniswap Trading API client — quote, swap, approval check

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Add DexScreener to Scanner discovery

**Files:**
- Modify: `server/src/agents/scanner-agent.ts`

- [ ] **Step 1: Add import**

```typescript
import { getTrendingTokens } from "../lib/dexscreener.js";
```

- [ ] **Step 2: Add DexScreener trending source**

At the end of `discoverTokens()`, before the final log line, add:

```typescript
    // DexScreener trending/promoted tokens
    try {
      const trending = await getTrendingTokens();
      // Filter for X Layer (chainId might be "196" or "xlayer")
      const xlayerTrending = trending.filter((t) =>
        String(t.chainId) === "196" || String(t.chainId).toLowerCase() === "xlayer"
      );
      for (const t of xlayerTrending) {
        if (t.tokenAddress) add(t.tokenAddress, "dexscreener_trending");
      }
    } catch { /* DexScreener unavailable */ }
```

- [ ] **Step 3: Commit**

```bash
git add server/src/agents/scanner-agent.ts
git commit -m "feat: add DexScreener trending tokens to scanner discovery

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Add DexScreener + DefiLlama + Trading API to Analyst risk scoring

**Files:**
- Modify: `server/src/agents/analyst-agent.ts`
- Modify: `server/src/types.ts`

- [ ] **Step 1: Add Verdict type fields**

Read `server/src/types.ts`, find the `Verdict` interface. Add these optional fields:

```typescript
  dexScreener?: {
    pairAddress: string;
    priceUsd: string;
    volume24h: number;
    liquidity: number;
    fdv: number;
    pairCreatedAt: number;
    url: string;
  };
  defiLlamaApy?: number;
  uniswapRoute?: string;
```

- [ ] **Step 2: Add imports to analyst-agent.ts**

```typescript
import { getTokenPairs } from "../lib/dexscreener.js";
import { getPoolApy } from "../lib/defillama.js";
import { getQuote as getUniswapQuote } from "../lib/uniswap-trading.js";
```

- [ ] **Step 3: Add new risk sources to deepScan()**

Find the end of Source I (bundle analysis) in `deepScan()`. After it, before `// --- Source G: Age & activity ---`, add:

```typescript
    // --- Source J: DexScreener pool data ---
    let dexScreenerData: Verdict["dexScreener"] | undefined;
    try {
      const dexPairs = await getTokenPairs("xlayer", tokenAddress);
      if (dexPairs.length > 0) {
        const best = dexPairs.sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))[0];
        dexScreenerData = {
          pairAddress: best.pairAddress,
          priceUsd: best.priceUsd,
          volume24h: best.volume?.h24 ?? 0,
          liquidity: best.liquidity?.usd ?? 0,
          fdv: best.fdv ?? 0,
          pairCreatedAt: best.pairCreatedAt ?? 0,
          url: best.url ?? "",
        };

        // Token age risk
        if (best.pairCreatedAt) {
          const ageMs = Date.now() - best.pairCreatedAt;
          const ageDays = ageMs / (1000 * 60 * 60 * 24);
          if (ageDays < 1) {
            risks.push("very_new_token(<1d)");
            riskScore += 25;
          } else if (ageDays < 7) {
            risks.push(`new_token_risk(${Math.floor(ageDays)}d)`);
            riskScore += 15;
          }
        }

        // DEX volume risk
        const vol24 = best.volume?.h24 ?? 0;
        if (vol24 < 1000 && !isLargeCap) {
          risks.push(`dex_low_volume($${Math.floor(vol24)})`);
          riskScore += 10;
        }

        // DEX liquidity cross-check
        const dexLiq = best.liquidity?.usd ?? 0;
        if (dexLiq < 10000 && !isLargeCap && !isStablecoin) {
          risks.push(`dex_thin_liquidity($${Math.floor(dexLiq)})`);
          riskScore += 12;
        }

        // FDV risk
        if (best.fdv > 0 && best.fdv < 50000 && !isStablecoin) {
          risks.push(`micro_cap(fdv:$${Math.floor(best.fdv / 1000)}k)`);
          riskScore += 8;
        }

        // DEX crash
        const dexChange = best.priceChange?.h24 ?? 0;
        if (dexChange < -50) {
          risks.push(`dex_crash(${dexChange.toFixed(0)}%)`);
          riskScore += 10;
        }
      }
    } catch { /* DexScreener unavailable */ }

    // --- Source K: DefiLlama APY data ---
    let defiLlamaApy: number | undefined;
    try {
      const llamaPool = await getPoolApy(tokenSymbol || String(symbol ?? ""), "X Layer");
      if (llamaPool) {
        defiLlamaApy = llamaPool.apy;
        if (llamaPool.apy > 1000) {
          risks.push(`suspicious_apy(${llamaPool.apy.toFixed(0)}%)`);
          riskScore += 5;
        }
      }
    } catch { /* DefiLlama unavailable */ }

    // --- Source L: Uniswap Trading API route check ---
    let uniswapRoute: string | undefined;
    try {
      const uniQuote = await getUniswapQuote({
        tokenIn: config.contracts.usdt,
        tokenOut: tokenAddress,
        tokenInChainId: config.chainId,
        tokenOutChainId: config.chainId,
        amount: "1000000", // 1 USDT (6 decimals)
        type: "EXACT_INPUT",
        swapper: this.walletAddress,
      });
      if (uniQuote) {
        uniswapRoute = uniQuote.routeString;
      } else if (!isLargeCap && !isStablecoin) {
        risks.push("no_uniswap_route");
        riskScore += 20;
      }
    } catch { /* Trading API unavailable */ }
```

- [ ] **Step 4: Add new fields to verdict object**

Find where the `verdict` object is constructed (around `const verdict: Verdict = {`). Add:

```typescript
      dexScreener: dexScreenerData,
      defiLlamaApy,
      uniswapRoute,
```

- [ ] **Step 5: Commit**

```bash
git add server/src/agents/analyst-agent.ts server/src/types.ts
git commit -m "feat: add DexScreener, DefiLlama, Uniswap Trading API to Analyst risk scoring

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Add Uniswap quote to Executor preview

**Files:**
- Modify: `server/src/agents/executor-agent.ts`

- [ ] **Step 1: Add import**

```typescript
import { getQuote as getUniswapQuote } from "../lib/uniswap-trading.js";
```

- [ ] **Step 2: Add Uniswap quote to previewInvestment()**

Find `previewInvestment()`. After the existing `swapQuote` block (onchainos quote), add:

```typescript
    // Uniswap Trading API quote
    let uniswapQuote: Record<string, unknown> | null = null;
    try {
      const uniResult = await getUniswapQuote({
        tokenIn: config.contracts.usdt,
        tokenOut: tokenSymbol,
        tokenInChainId: config.chainId,
        tokenOutChainId: config.chainId,
        amount: String(Number(investAmount) * 1e6), // USDT has 6 decimals
        type: "EXACT_INPUT",
        swapper: this.walletAddress,
      });
      if (uniResult) {
        uniswapQuote = {
          amountOut: uniResult.amountDecimals,
          route: uniResult.routeString,
          gasPriceWei: uniResult.gasPriceWei,
        };
      }
    } catch { /* Uniswap Trading API unavailable */ }
```

Update the return object to include `uniswapQuote`:

Find the `return {` block and add `uniswapQuote` field:

```typescript
    return {
      token: tokenSymbol,
      amount: investAmount,
      strategy: cfg.strategy,
      pools,
      bestPool: pools[0] ?? null,
      swapQuote,
      uniswapQuote,
    };
```

- [ ] **Step 3: Commit**

```bash
git add server/src/agents/executor-agent.ts
git commit -m "feat: add Uniswap Trading API quote to invest preview

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Add DexScreener/DefiLlama API endpoints to router

**Files:**
- Modify: `server/src/router/service-router.ts`

- [ ] **Step 1: Add imports**

```typescript
import { getTokenPairs, searchTokens, getTrendingTokens } from "../lib/dexscreener.js";
import { getUniswapPools, getPoolApy } from "../lib/defillama.js";
```

- [ ] **Step 2: Add endpoints BEFORE the `// ── Manage ──` section**

```typescript
  // ── DexScreener ──

  router.get("/dex/pairs/:token", async (req: Request, res: Response): Promise<void> => {
    try {
      const pairs = await getTokenPairs("xlayer", req.params.token);
      res.json({ pairs });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  router.get("/dex/search", async (req: Request, res: Response): Promise<void> => {
    try {
      const q = String(req.query.q ?? "");
      if (!q) { res.status(400).json({ error: "q parameter required" }); return; }
      const pairs = await searchTokens(q);
      res.json({ pairs });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  router.get("/dex/trending", async (_req: Request, res: Response): Promise<void> => {
    try {
      const tokens = await getTrendingTokens();
      res.json({ tokens });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  // ── DefiLlama ──

  router.get("/yields", async (req: Request, res: Response): Promise<void> => {
    try {
      const symbol = String(req.query.symbol ?? "");
      const chain = req.query.chain as string | undefined;
      if (symbol) {
        const pool = await getPoolApy(symbol, chain);
        res.json({ pool });
      } else {
        const pools = await getUniswapPools(chain);
        res.json({ pools: pools.slice(0, 50) });
      }
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
    }
  });
```

- [ ] **Step 3: Commit**

```bash
git add server/src/router/service-router.ts
git commit -m "feat: add /dex/pairs, /dex/search, /dex/trending, /yields endpoints

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Verify all Uniswap integrations with real data

- [ ] **Step 1: Test DexScreener endpoints**

```bash
# Pairs for USDT on X Layer
curl -s http://localhost:3002/api/dex/pairs/0x1E4a5963aBFD975d8c9021ce480b42188849D41d | python3 -c "
import sys, json
d = json.load(sys.stdin)
pairs = d.get('pairs', [])
print(f'DexScreener pairs: {len(pairs)}')
for p in pairs[:3]:
    print(f'  {p.get(\"baseToken\",{}).get(\"symbol\")}/{p.get(\"quoteToken\",{}).get(\"symbol\")} price={p.get(\"priceUsd\")} vol24h={p.get(\"volume\",{}).get(\"h24\")} liq={p.get(\"liquidity\",{}).get(\"usd\")}')
"

# Search
curl -s "http://localhost:3002/api/dex/search?q=OKB" | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(f'DexScreener search: {len(d.get(\"pairs\", []))} results')
"

# Trending
curl -s http://localhost:3002/api/dex/trending | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(f'DexScreener trending: {len(d.get(\"tokens\", []))} tokens')
"
```

- [ ] **Step 2: Test DefiLlama endpoint**

```bash
curl -s "http://localhost:3002/api/yields?chain=X+Layer" | python3 -c "
import sys, json
d = json.load(sys.stdin)
pools = d.get('pools', [])
print(f'DefiLlama Uniswap pools: {len(pools)}')
for p in pools[:3]:
    print(f'  {p.get(\"symbol\")} APY={p.get(\"apy\",0):.2f}% TVL=\${p.get(\"tvlUsd\",0):,.0f}')
"
```

- [ ] **Step 3: Test enhanced analyze with DexScreener data**

```bash
TOKEN=$(curl -s "http://localhost:3002/api/discover/feed?limit=1" | python3 -c "import sys,json; print(json.load(sys.stdin)['tokens'][0]['address'])")
curl -s "http://localhost:3002/api/analyze/$TOKEN" | python3 -c "
import sys, json
d = json.load(sys.stdin)
v = d.get('verdict', d)
print(f'Token: {v.get(\"tokenSymbol\")} Score: {v.get(\"riskScore\")} Verdict: {v.get(\"verdict\")}')
dex = v.get('dexScreener')
print(f'DexScreener: {\"present\" if dex else \"none\"}')
if dex:
    print(f'  price={dex.get(\"priceUsd\")} vol24h={dex.get(\"volume24h\")} liq={dex.get(\"liquidity\")}')
print(f'DefiLlama APY: {v.get(\"defiLlamaApy\", \"none\")}')
print(f'Uniswap route: {v.get(\"uniswapRoute\", \"none\")}')
risks = [r for r in v.get('risks', []) if 'dex_' in r or 'new_token' in r or 'micro_cap' in r or 'uniswap' in r or 'suspicious' in r]
print(f'New risk factors: {risks}')
"
```

- [ ] **Step 4: Test enhanced invest preview**

```bash
curl -s -X POST http://localhost:3002/api/invest/preview \
  -H "Content-Type: application/json" \
  -d '{"token":"USDT"}' | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(f'OKX pools: {len(d.get(\"pools\",[]))}')
print(f'OKX swap quote: {d.get(\"swapQuote\") is not None}')
print(f'Uniswap quote: {d.get(\"uniswapQuote\") is not None}')
if d.get('uniswapQuote'):
    print(f'  route: {d[\"uniswapQuote\"].get(\"route\")}')
"
```

- [ ] **Step 5: Commit verification**

```bash
git add -A
git commit -m "chore: verify all Uniswap integrations — DexScreener, DefiLlama, Trading API

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```
