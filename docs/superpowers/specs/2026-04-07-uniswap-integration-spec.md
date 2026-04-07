# Uniswap Skills Full Integration Spec

## Context

6 Uniswap skills installed but NOT integrated into backend: swap-integration, pay-with-any-token, v4-security-foundations, viem-integration, liquidity-planner, swap-planner. Each provides unique data and capabilities that complement existing OKX skills.

## New Data Sources

### DexScreener API (from swap-planner + liquidity-planner)

Three endpoints to integrate as a new `lib/dexscreener.ts`:

**1. Token pairs** — pool data for a specific token
```
GET https://api.dexscreener.com/token-pairs/v1/{network}/{tokenAddress}
```
Response fields: `pairAddress`, `baseToken.address`, `baseToken.symbol`, `quoteToken.address`, `quoteToken.symbol`, `priceUsd`, `priceChange.h24`, `volume.h24`, `liquidity.usd`, `fdv`, `pairCreatedAt`, `url`

**2. Token search** — find tokens by keyword
```
GET https://api.dexscreener.com/latest/dex/search?q={query}
```
Response: `pairs[]` array with same fields as above

**3. Trending/promoted tokens** — boosted tokens on DexScreener
```
GET https://api.dexscreener.com/token-boosts/top/v1
```
Response: `token.address`, `token.symbol`, `chainId`, `amount` (boost amount)

### DefiLlama Yields API (from liquidity-planner)

**Pool APY data**
```
GET https://yields.llama.fi/pools
```
Response: `pool`, `chain`, `project`, `symbol`, `tvlUsd`, `apyBase`, `apyReward`, `apy`, `stablecoin`, `exposure`

Filter by: `project === "uniswap-v3"` and `chain === "X Layer"` (or chain ID mapping)

### Uniswap Trading API (from swap-integration)

Base URL: `https://trade-api.gateway.uniswap.org/v1`
Requires: `x-api-key` header

**1. Check approval**
```
POST /check_approval
Body: { token, amount, walletAddress, chainId }
Response: { approval: { token, spender, amount, chainId }, gasFee, gasFeeQuote }
```

**2. Get quote**
```
POST /quote
Body: {
  tokenInChainId, tokenOutChainId,
  tokenIn, tokenOut,
  amount, type: "EXACT_INPUT" | "EXACT_OUTPUT",
  swapper, slippageTolerance?,
  configs: [{ routingType: "CLASSIC", protocols: ["V2","V3","V4"] }]
}
Response: { quote: { methodParameters, blockNumber, amount, amountDecimals, quoteGasAdjusted, gasPriceWei, route, routeString }, requestId }
```

**3. Get swap calldata**
```
POST /swap
Body: { quote (from step 2), simulateTransaction?, urgency? }
Response: { swap: { to, data, value, chainId, gasLimit }, gasFee }
```

## Integration Plan

### File 1: `server/src/lib/dexscreener.ts` (NEW)

DexScreener API client. Functions:

```typescript
interface DexPair {
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
  info?: { imageUrl?: string; websites?: Array<{ url: string }>; socials?: Array<{ platform: string; handle: string }> };
}

interface DexSearchResult {
  pairs: DexPair[];
}

interface BoostedToken {
  chainId: number;
  tokenAddress: string;
  icon?: string;
  description?: string;
  amount: number;
}

// Functions:
async function getTokenPairs(network: string, tokenAddress: string): Promise<DexPair[]>
async function searchTokens(query: string): Promise<DexPair[]>
async function getTrendingTokens(): Promise<BoostedToken[]>
```

Network mapping: X Layer = `xlayer` for DexScreener (verify with test call).

### File 2: `server/src/lib/uniswap-trading.ts` (NEW)

Uniswap Trading API client. API key from env `UNISWAP_API_KEY`.

```typescript
interface SwapQuote {
  tokenIn: string;
  tokenOut: string;
  amount: string;
  amountDecimals: string;
  quoteGasAdjusted: string;
  gasPriceWei: string;
  route: unknown[];
  routeString: string;
  requestId: string;
}

interface SwapCalldata {
  to: string;
  data: string;
  value: string;
  chainId: number;
  gasLimit: string;
}

// Functions:
async function checkApproval(token: string, amount: string, wallet: string, chainId: number): Promise<unknown>
async function getQuote(params: {
  tokenIn: string;
  tokenOut: string;
  tokenInChainId: number;
  tokenOutChainId: number;
  amount: string;
  type: "EXACT_INPUT" | "EXACT_OUTPUT";
  swapper: string;
  slippageTolerance?: number;
  routingTypes?: string[];
}): Promise<SwapQuote>
async function getSwapCalldata(quote: SwapQuote): Promise<SwapCalldata>
```

### File 3: `server/src/lib/defillama.ts` (NEW)

DefiLlama yields client.

```typescript
interface LlamaPool {
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

// Functions:
async function getUniswapPools(chain?: string): Promise<LlamaPool[]>
async function getPoolApy(symbol: string, chain?: string): Promise<LlamaPool | null>
```

### Modifications to Existing Files

#### `server/src/agents/scanner-agent.ts` — Add DexScreener sources

Add to `discoverTokens()`:
- `dexscreener.searchTokens("xlayer")` — search for X Layer tokens
- `dexscreener.getTrendingTokens()` — filter by X Layer chainId
- Merge results with existing OKX sources, deduplicate by address

#### `server/src/agents/analyst-agent.ts` — Enhanced risk scoring

Add new data sources to `deepScan()`:

**Source J: DexScreener pool data**
```typescript
const dexPairs = await dexscreener.getTokenPairs("xlayer", tokenAddress);
// Extract:
// - priceUsd (cross-reference with OKX price)
// - volume.h24 (real DEX volume)
// - liquidity.usd (real pool liquidity)
// - priceChange.h24 (real price change)
// - pairCreatedAt (token age)
// - fdv (fully diluted valuation)

// Risk factors:
// pairCreatedAt < 7 days → +15 points "new_token_risk"
// pairCreatedAt < 1 day → +25 points "very_new_token"
// volume.h24 < $1000 → +10 points "dex_low_volume"
// liquidity.usd < $10k → +12 points "dex_thin_liquidity"
// priceChange.h24 < -50% → +10 points "dex_crash"
// fdv > 0 && fdv < $50k → +8 points "micro_cap"
```

**Source K: DefiLlama APY data**
```typescript
const llamaPool = await defillama.getPoolApy(tokenSymbol, "X Layer");
// If pool found:
// - Store apy, tvlUsd in verdict for display
// - If apy > 1000% → +5 points "suspicious_apy"
```

**Source L: Uniswap Trading API quote**
```typescript
const uniQuote = await uniswapTrading.getQuote({
  tokenIn: USDT_ADDRESS,
  tokenOut: tokenAddress,
  tokenInChainId: 196,
  tokenOutChainId: 196,
  amount: "1000000", // 1 USDT
  type: "EXACT_INPUT",
  swapper: analystWalletAddress,
});
// Extract:
// - gasPriceWei (network congestion)
// - route (available pools and routing path)
// - If quote fails entirely → +20 points "no_uniswap_route" (can't trade on Uniswap)
```

Add to Verdict type:
```typescript
// New fields in Verdict interface:
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

#### `server/src/agents/executor-agent.ts` — Uniswap Trading API for swaps

In `previewInvestment()`:
- Add Uniswap Trading API quote alongside existing onchainos swap quote
- Return both: `okxSwapQuote` and `uniswapSwapQuote` for comparison
- Better routing = user/agent picks cheaper option

In `investInToken()`:
- If settings.invest.strategy includes Uniswap, use Trading API for the swap step
- Fall back to onchainos swap if Trading API fails

#### `server/src/router/service-router.ts` — New endpoints

**DexScreener endpoints:**
```
GET /api/dex/pairs/:token — DexScreener pairs for token
GET /api/dex/search?q= — DexScreener token search
GET /api/dex/trending — DexScreener trending/promoted tokens
```

**DefiLlama endpoint:**
```
GET /api/yields?symbol=&chain= — DefiLlama APY data
```

**Enhanced invest preview:**
- `POST /api/invest/preview` now returns both OKX and Uniswap quotes for comparison

#### `server/src/config.ts` — New env var

```
UNISWAP_API_KEY=<key>
```

Add to config:
```typescript
uniswap: {
  apiKey: optional("UNISWAP_API_KEY"),
  tradingApiUrl: "https://trade-api.gateway.uniswap.org/v1",
},
```

## Full Skills Usage Map (After Integration)

### OKX Skills (15/15 — already integrated)
All onchainos functions from previous plans.

### Uniswap Skills (6/6 — NEW)

| Skill | How Used | Where |
|-------|----------|-------|
| **swap-planner** | DexScreener search + trending + risk assessment logic | Scanner (discovery) + Analyst (risk scoring) |
| **liquidity-planner** | DexScreener pairs + DefiLlama APY + fee tier recommendations + range suggestions | Analyst (pool data) + Executor (LP range) |
| **swap-integration** | Trading API quote + swap + approval check | Executor (swap execution) + Invest preview |
| **pay-with-any-token** | x402 payment with any ERC-20 via Uniswap auto-swap | x402-middleware (payment acceptance) |
| **v4-security-foundations** | Hook permission risk scoring for v4 pool tokens | Analyst (Source M: v4 hook risk) |
| **viem-integration** | Already used via existing viem setup | Analyst (contract reads), Executor (tx submission) |

### External APIs (NEW)

| API | Endpoint | Used In |
|-----|----------|---------|
| DexScreener | token-pairs, search, boosts | Scanner, Analyst, Router |
| DefiLlama | yields/pools | Analyst, Router |
| Uniswap Trading | quote, swap, check_approval | Executor, Router |

## Verification

1. `GET /api/dex/pairs/{token}` returns DexScreener data with priceUsd, volume, liquidity
2. `GET /api/dex/search?q=USDT` returns matching pairs
3. `GET /api/dex/trending` returns boosted tokens
4. `GET /api/yields?symbol=USDT` returns DefiLlama APY data
5. `GET /api/analyze/{token}` verdict includes dexScreener and defiLlamaApy fields
6. `POST /api/invest/preview` returns both okxSwapQuote and uniswapSwapQuote
7. `GET /api/discover/feed` includes dexscreener_trending source
8. New risk factors appear in analyst verdicts: new_token_risk, dex_low_volume, dex_thin_liquidity, no_uniswap_route
9. All 6 Uniswap skills represented in at least one endpoint
