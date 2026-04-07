# Sentinel Full Backend — All OKX + Uniswap Skills Integration

## Context

Sentinel uses ~40% of available OKX/Uniswap skills. Missing: kline price analysis, whale/degen signals, full trenches stages, fee collection, position exits, portfolio overview, audit logging, token search, bundle analysis, Uniswap liquidity-planner. User needs configurable auto/manual mode per subsystem.

## Architecture

4 subsystems: **Discover**, **Analyze**, **Invest**, **Manage**. Each has auto mode (agent-driven cron) and manual mode (user triggers via API). Mode configurable per-subsystem via `/api/settings`.

All subsystems share: `onchainos.ts` (skill wrapper), `event-bus.ts` (WebSocket events), `verdict-store.ts` (in-memory state).

## Settings System

### New file: `server/src/settings.ts`

In-memory settings with defaults. Persisted to `server/settings.json`.

```typescript
interface Settings {
  discover: {
    mode: "auto" | "manual";
    interval: string;        // cron expression, default "*/5 * * * *"
    sources: string[];       // default ["NEW", "MIGRATED", "TRENDING", "TOP_GAINERS"]
    trackWhales: boolean;    // default true
    trackSmartMoney: boolean; // default true
    trackDegen: boolean;     // default false
  };
  analyze: {
    mode: "auto" | "manual";
    useKline: boolean;       // default true — add price-action to risk scoring
    useWhaleContext: boolean; // default true — factor whale activity into risk
    riskThreshold: number;   // default 40 — max risk score for SAFE verdict
  };
  invest: {
    mode: "auto" | "manual";
    maxPerPosition: number;  // default 10 USDT
    strategy: "lp" | "swap" | "auto"; // default "auto" — LP first, swap fallback
    stopLossPercent: number; // default 20
  };
  manage: {
    mode: "auto" | "manual";
    collectFeesInterval: string; // default "0 */6 * * *"
    rebalanceEnabled: boolean;   // default true
    stopLossEnabled: boolean;    // default true
  };
}
```

### New endpoints

- `GET /api/settings` — current settings
- `PATCH /api/settings` — partial update (deep merge)

---

## Subsystem 1: Discover

### What changes

**Scanner agent** currently queries: `trenches(NEW)`, `trenches(MIGRATED)`, `signal.activities(smart_money)`, `token.hotTokens()`.

Add:
- `onchainosTrenches.tokens("TRENDING")` — trending tokens
- `onchainosTrenches.tokens("TOP_GAINERS")` — top gainers
- `onchainosSignal.activities("whale")` — whale movements
- `onchainosSignal.activities("degen")` — degen activity (configurable)
- `onchainosToken.search(query)` — search by name/symbol
- `onchainosTrenches.tokenBundleInfo(token)` — bundle analysis for rug detection

### New endpoints

- `GET /api/discover/feed?sources=NEW,TRENDING&limit=50` — aggregated token feed from all configured sources
- `GET /api/discover/whales?limit=20` — recent whale/smart_money/degen signals
- `POST /api/discover/scan` — manual trigger: run scanner once regardless of cron

### Files to modify

- `server/src/agents/scanner-agent.ts` — add new sources, respect settings.discover.sources
- `server/src/router/service-router.ts` — add discover endpoints

---

## Subsystem 2: Analyze

### What changes

**Analyst agent** currently does 7-signal risk scoring. Missing: price-action analysis, whale context.

Add to deep scan pipeline:
- `onchainosMarket.kline(token, chainId, "1h")` — hourly candles for volatility/trend analysis
- `onchainosMarket.kline(token, chainId, "15m")` — 15min candles for recent momentum
- Cross-reference whale signals: if whale is accumulating this token → lower risk; if dumping → higher risk
- `onchainosTrenches.tokenBundleInfo(token)` — check for suspicious bundled transactions

### New risk factors (added to existing scoring)

```
kline_volatility_1h > 30%   → +12 points
kline_downtrend (3+ red candles) → +8 points
whale_dumping                → +15 points
whale_accumulating           → -5 points (reduces risk)
bundle_suspicious            → +20 points
no_kline_data (illiquid)     → +10 points
```

### New endpoints

- `GET /api/analyze/:token` — full analysis report (cached or fresh). Returns: verdict + kline summary + whale activity + bundle info
- `POST /api/analyze/:token/rescan` — force fresh scan ignoring cache

### Files to modify

- `server/src/agents/analyst-agent.ts` — add kline analysis, whale context, bundle check
- `server/src/router/service-router.ts` — add analyze endpoints

---

## Subsystem 3: Invest

### What changes

**Executor agent** currently: search DeFi pool → invest via OnchainOS → fallback to swap.

Add:
- `onchainosDefi.calculateEntry(investmentId, address, inputToken, inputAmount)` — preview before investing
- Uniswap-specific: use `liquidity-planner` skill data for tick range optimization (via `onchainosDefi.search` with platform filter "uniswap")
- `onchainosSwap.quote(from, to, amount)` — quote before swap (show user expected output)
- Configurable strategy: LP (concentrated liquidity) vs Swap (spot) vs Auto

### New endpoints

- `POST /api/invest/preview` — preview investment: returns pool options, expected APR, price impact
  - Body: `{ token, amount, strategy: "lp" | "swap" | "auto" }`
  - Response: `{ pools: [...], bestPool, expectedApr, priceImpact, swapQuote }`
- `POST /api/invest/execute` — execute investment (manual mode)
  - Body: `{ token, amount, strategy, poolId? }`
  - Response: `{ success, txHash, position }`
- `POST /api/invest/swap` — simple swap without LP
  - Body: `{ fromToken, toToken, amount }`
  - Response: `{ success, txHash, amountOut }`

### Files to modify

- `server/src/agents/executor-agent.ts` — add preview, configurable strategy, swap quote
- `server/src/router/service-router.ts` — add invest endpoints

---

## Subsystem 4: Manage

### What changes

Currently: LP positions tracked locally. No fee collection, no exits, no P&L, no audit trail.

Add:
- `onchainosDefi.collect(investmentId, address)` — collect LP fees
- `onchainosDefi.withdraw(investmentId, address, amount)` — exit position (full or partial)
- `onchainosDefi.positions(address)` — sync on-chain positions with local state
- `onchainosPortfolio.totalValue(address)` — total portfolio value across all tokens
- `onchainosPortfolio.allBalances(address)` — all token balances
- `onchainosMarket.price(token)` — current price for P&L calculation
- Stop-loss: if token drops > X% from entry → auto exit (if manage.mode == "auto")
- Fee collection cron: collect all pending fees on schedule

### New endpoints

- `GET /api/manage/portfolio` — enhanced portfolio: positions + P&L + pending fees + total value
  - Response: `{ totalValue, positions: [{ ...position, currentPrice, pnl, pendingFees }], walletBalances }`
- `POST /api/manage/collect/:investmentId` — collect fees for specific position
- `POST /api/manage/collect-all` — collect all pending fees
- `POST /api/manage/exit/:investmentId` — exit position (full withdrawal)
- `POST /api/manage/exit/:investmentId/partial` — partial exit
  - Body: `{ percent: 50 }`
- `GET /api/manage/audit` — audit log of all actions
- `GET /api/manage/pnl` — P&L summary across all positions

### New file: `server/src/scheduler/manage-loop.ts`

Cron that runs on `manage.collectFeesInterval`:
1. Sync positions from chain via `onchainosDefi.positions()`
2. For each position: check current price vs entry price
3. If `stopLossEnabled` and loss > `stopLossPercent` → auto exit
4. If `rebalanceEnabled` → collect pending fees
5. Emit events for all actions

### Files to modify/create

- Create: `server/src/scheduler/manage-loop.ts`
- Modify: `server/src/agents/executor-agent.ts` — add exit, collect, withdraw actions
- Modify: `server/src/router/service-router.ts` — add manage endpoints
- Modify: `server/src/index.ts` — register manage-loop cron

---

## Decision Engine Changes

Current: `onTokensDiscovered()` always auto-scans and auto-invests.

Change: respect settings:
- If `analyze.mode == "manual"` → don't auto-scan, just store discovered tokens for user review
- If `invest.mode == "manual"` → don't auto-invest, just flag SAFE tokens for user review
- Pending items stored in `pendingStore` (new in-memory store), exposed via:
  - `GET /api/pending/analyze` — tokens awaiting manual analysis
  - `GET /api/pending/invest` — SAFE tokens awaiting manual investment decision
  - `POST /api/pending/analyze/:token/approve` — trigger analysis
  - `POST /api/pending/invest/:token/approve` — trigger investment
  - `DELETE /api/pending/:token` — dismiss/skip

### File to modify

- `server/src/agents/decision-engine.ts`
- Create: `server/src/pending-store.ts`

---

## Full Skills Usage Map (after implementation)

| Skill | Function | Where Used |
|-------|----------|-----------|
| onchainosTrenches.tokens | NEW, MIGRATED, TRENDING, TOP_GAINERS | Scanner |
| onchainosTrenches.devInfo | Dev rug history | Analyst |
| onchainosTrenches.tokenBundleInfo | Bundle analysis | Analyst |
| onchainosSignal.activities | smart_money, whale, degen | Scanner |
| onchainosToken.search | Token search by name | Scanner (search endpoint) |
| onchainosToken.priceInfo | Price data | Analyst |
| onchainosToken.liquidity | Pool/liquidity data | Analyst |
| onchainosToken.hotTokens | Trending tokens | Scanner |
| onchainosToken.advancedInfo | Holders, tags, concentration | Analyst |
| onchainosSecurity.tokenScan | Honeypot/tax/risk scan | Analyst |
| onchainosMarket.kline | Candle data for price-action | Analyst |
| onchainosMarket.price | Current price | Manage (P&L) |
| onchainosMarket.prices | Multi-token prices | Manage (portfolio) |
| onchainosSwap.quote | Swap preview | Invest (preview) |
| onchainosSwap.execute | Execute swap | Invest, Reinvest |
| onchainosDefi.search | Find pools | Invest, Reinvest |
| onchainosDefi.detail | Pool detail | Invest (preview) |
| onchainosDefi.calculateEntry | Entry preview | Invest (preview) |
| onchainosDefi.invest | Add liquidity | Invest |
| onchainosDefi.withdraw | Remove liquidity | Manage (exit) |
| onchainosDefi.positions | On-chain positions | Manage (sync) |
| onchainosDefi.collect | Collect LP fees | Manage (fees) |
| onchainosPortfolio.totalValue | Total wallet value | Manage (portfolio) |
| onchainosPortfolio.allBalances | All token balances | Manage (portfolio) |
| onchainosWallet.balance | USDT balance | All agents |
| onchainosWallet.send | Transfer tokens | Executor |
| onchainosWallet.addresses | Wallet addresses | Setup |
| onchainosWallet.switchAccount | Multi-wallet | Future |
| onchainosPayment.x402Pay | x402 payment | Inter-agent |
| okxTokenSecurity | OKX API security scan | Analyst (fallback) |
| okxSwapQuote | OKX swap quote | Invest (fallback) |
| okxSwapData | OKX swap calldata | Invest (fallback) |

**15/15 skill groups used. 30+ individual functions integrated.**

---

## Verification

1. `GET /api/settings` returns valid settings JSON
2. `PATCH /api/settings` updates and persists to settings.json
3. `GET /api/discover/feed` returns tokens from all configured sources
4. `GET /api/discover/whales` returns whale/smart_money signals
5. `GET /api/analyze/:token` returns full report with kline + whale context
6. `POST /api/invest/preview` returns pool options + swap quote
7. `POST /api/invest/execute` creates LP position or executes swap
8. `GET /api/manage/portfolio` returns positions with P&L and pending fees
9. `POST /api/manage/collect-all` collects pending fees
10. `POST /api/manage/exit/:id` exits position
11. Auto mode: cron loops respect settings, auto-scan/invest/collect work
12. Manual mode: tokens queued in pending store, user approves via API
13. All actions emit events to WebSocket
14. All onchainos functions in skills map are called at least once
