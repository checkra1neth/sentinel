# Sentinel Frontend — Analyze, Portfolio, Trade, Agents Tabs

## Overview

Expand from 3 nav tabs (Discover | Portfolio | Agents) to 5 tabs (Discover | Analyze | Portfolio | Trade | Agents). Expose all 56 unused backend endpoints. Same design system: `#09090b` bg, `#fafafa` fg, `#06b6d4` accent, `font-mono`, `text-xs`, `border-white/[0.06]`, no shadows.

## Navigation

```
Discover | Analyze | Portfolio | Trade | Agents
```

File: `web/src/components/nav-links.tsx`

Add two entries to LINKS array:
```ts
{ href: "/analyze", label: "Analyze" },   // after Discover
{ href: "/trade", label: "Trade" },        // after Portfolio
```

Final order: Discover, Analyze, Portfolio, Trade, Agents.

---

## Tab B: Analyze (`/analyze`)

**Purpose:** Manual token/dApp security scanner. "Do your own research" tool.

### Page: `web/src/app/analyze/page.tsx`

**Components:**
- `ScanInput` (already exists at `web/src/components/scan-input.tsx` — reuse/adapt)
- `VerdictCard` (new: `web/src/components/verdict-card.tsx`)
- `SecurityBreakdown` (new: `web/src/components/security-breakdown.tsx`)
- `DappScanResult` (new: `web/src/components/dapp-scan-result.tsx`)

### Layout

```
+--------------------------------------------------+
| SCAN INPUT [address / domain] [Scan] [type pill]  |
+--------------------------------------------------+
|                                                    |
| VERDICT CARD (full width)                          |
| ┌───────────────────────────────────────────────┐ |
| │ TOKEN NAME  $SYMBOL     SAFE ●●●●●○○○○○ 35   │ |
| │ Price $0.042  MCap $1.2M  Liq $340K  Vol $89K │ |
| │                                                │ |
| │ [Rescan]  [Full Profile →]  [Trade →]          │ |
| └───────────────────────────────────────────────┘ |
|                                                    |
| SECURITY BREAKDOWN (2-col grid)                    |
| ┌─────────────────┐ ┌──────────────────────────┐ |
| │ Honeypot    No   │ │ Risks                    │ |
| │ Mintable    No   │ │ - Top 10 hold 45%        │ |
| │ Proxy       No   │ │ - Creator holds 12%      │ |
| │ Buy Tax     0%   │ │ - Low liquidity          │ |
| │ Sell Tax    2%   │ │                          │ |
| │ Holder Conc 23%  │ │                          │ |
| └─────────────────┘ └──────────────────────────┘ |
|                                                    |
| DAPP SCAN (if domain entered)                      |
| ┌───────────────────────────────────────────────┐ |
| │ Domain: app.uniswap.org  Status: SAFE         │ |
| │ Phishing: No  Malware: No  Suspicious: No     │ |
| └───────────────────────────────────────────────┘ |
+--------------------------------------------------+
```

### Data Flow

1. User enters address or domain in ScanInput
2. Auto-detect type:
   - `0x` + 42 chars → token address → `POST /api/scan/{address}`
   - Contains `.` → domain → `GET /api/security/dapp-scan?domain={input}`
3. On token scan response → display VerdictCard + SecurityBreakdown
4. On dapp scan response → display DappScanResult
5. "Rescan" button → `POST /api/analyze/{address}/rescan`
6. "Full Profile" → navigate to `/token/{address}`
7. "Trade" → navigate to `/trade?token={address}`

### API Functions (add to `web/src/lib/api.ts`)

```ts
// POST with empty body, returns verdict
export async function scanToken(address: string): Promise<Verdict | null>
// POST, force rescan
export async function rescanToken(address: string): Promise<Verdict | null>
// GET dapp security scan
export async function scanDapp(domain: string): Promise<DappScanResult | null>
// GET token info (name, symbol, metadata)
export async function fetchTokenInfo(address: string): Promise<Record<string, unknown>>
```

### VerdictCard Component

Props:
```ts
interface VerdictCardProps {
  verdict: Verdict;
  loading?: boolean;
  onRescan: () => void;
}
```

- Risk score as horizontal bar (same style as tab-overview.tsx)
- Verdict badge: SAFE=#34d399, CAUTION=#f59e0b, DANGEROUS=#ef4444
- 6 metric pills: Price, 24h%, MCap, Liquidity, Volume, Holders
- Action buttons: Rescan, Full Profile (Link), Trade (Link)

### SecurityBreakdown Component

Props:
```ts
interface SecurityBreakdownProps {
  verdict: Verdict;
}
```

- 2-column grid on desktop, 1-column on mobile
- Left: KV rows (honeypot, mintable, proxy, buyTax, sellTax, holderConcentration)
- Right: Risks list (verdict.risks array)
- Color coding: danger flags in #ef4444, safe flags in #34d399

### DappScanResult Component

Props:
```ts
interface DappScanResultProps {
  data: Record<string, unknown>;
  domain: string;
}
```

- Domain + overall status
- KV rows for each security flag from the response

### ScanInput Adaptation

The existing `scan-input.tsx` needs:
- Type detection (token vs domain) with pill indicator
- Loading state during scan
- Error state display

---

## Tab C: Portfolio (`/portfolio`) — Expansion

**Purpose:** Complete portfolio view with PnL, balances, positions, history, and approval management.

### Page: `web/src/app/portfolio/page.tsx` (REWRITE existing)

**Components:**
- `PortfolioOverview` (new: `web/src/components/portfolio-overview.tsx`)
- `TokenBalances` (new: `web/src/components/token-balances.tsx`)
- `LpPositions` (extracted from current page, expanded)
- `ApprovalManager` (new: `web/src/components/approval-manager.tsx`)
- `DexHistory` (new: `web/src/components/dex-history.tsx`)

### Layout

```
+--------------------------------------------------+
| OVERVIEW BAR                                       |
| Total Value: $12,450  24h PnL: +$340 (+2.8%)     |
| 7d PnL: +$1,200 (+10.6%)  Positions: 4           |
+--------------------------------------------------+
|                                                    |
| TOKEN BALANCES (horizontal scroll cards)           |
| ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐              |
| │ OKB  │ │ USDT │ │ WETH │ │ XDOG │              |
| │$4.2K │ │$3.1K │ │$2.8K │ │$1.2K │              |
| │+2.3% │ │ 0.0% │ │-1.1% │ │+15%  │              |
| └──────┘ └──────┘ └──────┘ └──────┘              |
+--------------------------------------------------+
|                                                    |
| LP POSITIONS (table — existing + actions)          |
| Token | Pool | Invested | APR | TVL | [Collect All]|
| XDOG  | XDOG/USDT | $500 | 45% | $2M | [Exit]    |
| OKB   | OKB/USDT  | $300 | 12% | $8M | [Exit]    |
+--------------------------------------------------+
|                                                    |
| APPROVAL MANAGER                                   |
| ┌───────────────────────────────────────────────┐ |
| │ Token      Spender        Amount   [Revoke]   │ |
| │ USDT       0x7078...4c15  Unlimited [Revoke]  │ |
| │ WETH       0xa800...4333  $5,000   [Revoke]   │ |
| └───────────────────────────────────────────────┘ |
+--------------------------------------------------+
|                                                    |
| DEX HISTORY (table with filters)                   |
| [All ▾] [Token filter ▾] [Date range]            |
| Type | Token | Amount | Price | Time | TxHash     |
| BUY  | XDOG  | 10,000 | $0.04 | 2h  | 0xab...   |
| SELL | OKB   | 50     | $48   | 5h  | 0xcd...   |
+--------------------------------------------------+
```

### Data Flow

**Overview bar:**
- `GET /api/portfolio/overview?timeFrame=7d` → total value, PnL
- `GET /api/portfolio/pnl` → recent PnL data

**Token Balances:**
- `GET /api/manage/portfolio` → full portfolio with token balances + DeFi positions
- Fallback: `GET /api/manage/balances` for agent wallet balances

**LP Positions:**
- `GET /api/portfolio` → existing positions data
- "Collect All" → `POST /api/manage/collect-all`
- "Exit" → `POST /api/manage/exit/{investmentId}` with `ratio` body param

**Approval Manager:**
- Needs executor wallet address from `/api/agents` response
- `GET /api/security/approvals/{executorAddress}` → list approvals
- Revoke is a contract call — display info, link to explorer for now

**DEX History:**
- `GET /api/portfolio/history?limit=50` → paginated history
- Filters: txType (BUY/SELL/ADD_LP/REMOVE_LP), token address, date range (begin/end timestamps)

### API Functions (add to `web/src/lib/api.ts`)

```ts
export async function fetchPortfolioOverview(timeFrame?: string): Promise<Record<string, unknown>>
export async function fetchPortfolioPnl(): Promise<Record<string, unknown>>
export async function fetchManagedPortfolio(): Promise<Record<string, unknown>>
export async function fetchAgentBalances(): Promise<Record<string, unknown>>
export async function fetchLpPositions(): Promise<Record<string, unknown>>
export async function collectAllRewards(): Promise<Record<string, unknown>>  // POST
export async function exitPosition(investmentId: string, ratio?: number): Promise<Record<string, unknown>>  // POST
export async function fetchApprovals(address: string): Promise<Record<string, unknown>>
export async function fetchDexHistory(params?: { limit?: number; cursor?: string; token?: string; txType?: string; begin?: string; end?: string }): Promise<Record<string, unknown>>
export async function fetchAgents(): Promise<Record<string, unknown>>
```

### PortfolioOverview Component

Props:
```ts
interface PortfolioOverviewProps {
  totalValue?: number;
  pnl24h?: number;
  pnlPercent24h?: number;
  pnl7d?: number;
  pnlPercent7d?: number;
  positionCount?: number;
}
```

- Horizontal bar with 4-5 stat pills (same style as existing portfolio summary line but bigger)
- PnL green if positive, red if negative

### TokenBalances Component

Props:
```ts
interface TokenBalancesProps {
  balances: Array<{ token: string; symbol: string; balance: number; valueUsd: number; change24h?: number }>;
}
```

- Horizontal scrollable row of cards
- Each card: symbol, USD value, 24h change %
- Click card → navigate to `/token/{address}`

### ApprovalManager Component

Props:
```ts
interface ApprovalManagerProps {
  address: string;  // wallet address to check approvals for
}
```

- Table: Token, Spender (truncated), Approved Amount, Revoke button
- "Unlimited" shown in #f59e0b warning color
- Revoke button links to explorer tx builder (we can't sign from frontend without wallet)

### DexHistory Component

Props:
```ts
interface DexHistoryProps {
  address?: string;
}
```

- Table: Type (BUY/SELL badge), Token, Amount, Price, Time (relative), TxHash (link to explorer)
- Filter row above table: txType dropdown, token text filter
- Pagination via cursor

---

## Tab D: Trade (`/trade`)

**Purpose:** Swap tokens with pre-flight security + browse DeFi products to invest.

### Page: `web/src/app/trade/page.tsx` (NEW)

**Sub-tabs:** Swap | DeFi

**Components:**
- `TradeTabs` (new: `web/src/components/trade-tabs.tsx`) — sub-tab nav
- `SwapPanel` (new: `web/src/components/swap-panel.tsx`)
- `SwapPreFlight` (new: `web/src/components/swap-preflight.tsx`)
- `DefiProducts` (new: `web/src/components/defi-products.tsx`)
- `DefiDepositModal` (new: `web/src/components/defi-deposit-modal.tsx`)

### Swap Sub-Tab Layout

```
+--------------------------------------------------+
| [Swap]  [DeFi]                                    |
+--------------------------------------------------+
|                                                    |
|  ┌─────────────────────────────────────────────┐  |
|  │ From:  [OKB ▾]          Amount: [____]      │  |
|  │ Balance: 12.5 OKB ($600)                     │  |
|  │                                               │  |
|  │              ⇅ (swap direction)               │  |
|  │                                               │  |
|  │ To:    [USDT ▾]         Est: 598.50 USDT     │  |
|  │                                               │  |
|  │ Rate: 1 OKB = 47.88 USDT                     │  |
|  │ Gas: ~0.002 OKB ($0.09)                       │  |
|  │ Slippage: 0.5%                                │  |
|  │                                               │  |
|  │ PRE-FLIGHT SECURITY ✓                         │  |
|  │ USDT: SAFE (risk 5) · No honeypot · 0% tax   │  |
|  │                                               │  |
|  │ [Execute Swap]                                │  |
|  └─────────────────────────────────────────────┘  |
|                                                    |
+--------------------------------------------------+
```

### DeFi Sub-Tab Layout

```
+--------------------------------------------------+
| [Swap]  [DeFi]                                    |
+--------------------------------------------------+
|                                                    |
| DEFI PRODUCTS (sorted by APY)                      |
| ┌───────────────────────────────────────────────┐ |
| │ Pool         Platform  APY    TVL    [Deposit] │ |
| │ OKB/USDT     Uniswap  45.2%  $2.1M  [→]      │ |
| │ WETH/USDT    SushiSwap 12.8% $8.4M  [→]      │ |
| │ OKB/WETH     Uniswap  8.5%   $1.2M  [→]      │ |
| └───────────────────────────────────────────────┘ |
|                                                    |
| YIELD COMPARISON (DefiLlama)                       |
| ┌───────────────────────────────────────────────┐ |
| │ Pool         Protocol  APY    TVL    Chain     │ |
| │ OKB-USDT     Uniswap  42%    $2M    X Layer   │ |
| └───────────────────────────────────────────────┘ |
+--------------------------------------------------+
```

### Data Flow

**Swap:**
1. User selects from-token and to-token, enters amount
2. Auto-fetch quote: `POST /api/invest/swap` preview (or use backend quote endpoint)
3. Auto-scan to-token security: `GET /api/analyze/{toToken}` → show pre-flight badge
4. Gas estimate: `GET /api/gateway/gas`
5. Optional TX simulation: `POST /api/gateway/simulate`
6. Execute: `POST /api/invest/swap` with `{ fromToken, toToken, amount }`
7. URL param support: `/trade?token=0x...` pre-fills to-token (from Analyze tab "Trade" button)

**DeFi:**
1. Load products: `GET /api/defi/products?page=1`
2. Load DefiLlama yields: `GET /api/yields`
3. Click Deposit → modal with:
   - `POST /api/invest/preview` → show expected outcome
   - `POST /api/invest/execute` → execute investment
4. Existing positions visible in Portfolio tab

### API Functions (add to `web/src/lib/api.ts`)

```ts
export async function fetchGas(): Promise<Record<string, unknown>>
export async function simulateTx(from: string, to: string, data: string): Promise<Record<string, unknown>>
export async function executeSwap(fromToken: string, toToken: string, amount: string): Promise<Record<string, unknown>>  // POST
export async function fetchDefiProducts(page?: number): Promise<Record<string, unknown>>
export async function fetchDefiDetail(investmentId: string): Promise<Record<string, unknown>>
export async function previewInvestment(token: string, amount: string, tokenSymbol: string): Promise<Record<string, unknown>>  // POST
export async function executeInvestment(token: string, amount: string, tokenSymbol: string, riskScore: number): Promise<Record<string, unknown>>  // POST
export async function fetchYields(symbol?: string): Promise<Record<string, unknown>>
```

### SwapPanel Component

Props:
```ts
interface SwapPanelProps {
  initialToToken?: string;  // from URL params
}
```

- From/To token selectors (text input with token search)
- Amount input with "Max" button
- Quote display (rate, gas, slippage)
- Pre-flight security badge (auto-scans to-token)
- Execute button (disabled until quote loaded + security checked)

### SwapPreFlight Component

Props:
```ts
interface SwapPreFlightProps {
  token: string;
  verdict: Verdict | null;
  loading: boolean;
}
```

- Inline security summary: verdict badge + key flags (honeypot, tax)
- Green checkmark if SAFE, amber warning if CAUTION, red block if DANGEROUS

### DefiProducts Component

Props: none (fetches own data)

- Paginated table sorted by APY descending
- Columns: Pool Name, Platform, APY, TVL, Deposit button
- Click Deposit → opens DefiDepositModal

### DefiDepositModal Component

Props:
```ts
interface DefiDepositModalProps {
  investmentId: string;
  poolName: string;
  onClose: () => void;
}
```

- Shows product detail (fetched on mount)
- Amount input
- Preview result (POST /invest/preview)
- Confirm button → execute

---

## Tab E: Agents (`/agents`) — Expansion

**Purpose:** Add pending approvals queue and system settings.

### Page: `web/src/app/agents/page.tsx` (EXPAND existing)

**New Components:**
- `PendingApprovals` (new: `web/src/components/pending-approvals.tsx`)
- `SettingsPanel` (new: `web/src/components/settings-panel.tsx`)

### Layout Addition (insert ABOVE existing agent cards)

```
+--------------------------------------------------+
| PENDING APPROVALS                                  |
| ┌───────────────────────────────────────────────┐ |
| │ ANALYZE QUEUE                                  │ |
| │ 0xabc... XDOG  Risk: 35  [Approve] [Reject]  │ |
| │ 0xdef... WBTC  Risk: --  [Approve] [Reject]  │ |
| │                                                │ |
| │ INVEST QUEUE                                   │ |
| │ 0xabc... XDOG  SAFE  $500  [Approve] [Reject] │ |
| └───────────────────────────────────────────────┘ |
+--------------------------------------------------+
| (existing agent cards)                             |
| (existing event log)                               |
+--------------------------------------------------+
| SETTINGS                                           |
| ┌───────────────────────────────────────────────┐ |
| │ Scan Interval:    [5] min                      │ |
| │ Risk Threshold:   [65]                         │ |
| │ Auto-Invest:      [ON/OFF]                     │ |
| │ Max Investment:    [$500]                       │ |
| │                          [Save Settings]       │ |
| └───────────────────────────────────────────────┘ |
+--------------------------------------------------+
```

### Data Flow

**Pending Approvals:**
- `GET /api/pending/analyze` → tokens awaiting analysis
- `GET /api/pending/invest` → tokens awaiting investment
- Approve analyze: `POST /api/pending/analyze/{token}/approve`
- Approve invest: `POST /api/pending/invest/{token}/approve`
- Reject: `DELETE /api/pending/{token}`
- Poll every 10s (same as existing agent data)

**Settings:**
- `GET /api/settings` → current settings
- `PATCH /api/settings` → update settings
- Fields depend on backend response shape — render dynamically as KV editor

### API Functions (add to `web/src/lib/api.ts`)

```ts
export async function fetchPendingAnalyze(): Promise<Record<string, unknown>[]>
export async function fetchPendingInvest(): Promise<Record<string, unknown>[]>
export async function approvePendingAnalyze(token: string): Promise<Record<string, unknown>>  // POST
export async function approvePendingInvest(token: string): Promise<Record<string, unknown>>  // POST
export async function rejectPending(token: string): Promise<Record<string, unknown>>  // DELETE
export async function fetchSettings(): Promise<Record<string, unknown>>
export async function updateSettings(settings: Record<string, unknown>): Promise<Record<string, unknown>>  // PATCH
```

### PendingApprovals Component

Props: none (fetches own data with polling)

- Two sections: Analyze Queue, Invest Queue
- Each item: token address (truncated), symbol if available, risk score, action buttons
- Approve = green outline button, Reject = red outline button
- Empty state: "No pending approvals"

### SettingsPanel Component

Props: none (fetches own data)

- KV form rendered from settings response
- Number inputs for numeric values, toggles for booleans
- Save button → PATCH
- Success/error feedback inline

---

## New Files Summary

### Pages (4 files)
- `web/src/app/analyze/page.tsx` — NEW
- `web/src/app/portfolio/page.tsx` — REWRITE
- `web/src/app/trade/page.tsx` — NEW
- `web/src/app/agents/page.tsx` — EXPAND

### Components (13 files)
- `web/src/components/verdict-card.tsx` — NEW
- `web/src/components/security-breakdown.tsx` — NEW
- `web/src/components/dapp-scan-result.tsx` — NEW
- `web/src/components/portfolio-overview.tsx` — NEW
- `web/src/components/token-balances.tsx` — NEW
- `web/src/components/approval-manager.tsx` — NEW
- `web/src/components/dex-history.tsx` — NEW
- `web/src/components/trade-tabs.tsx` — NEW
- `web/src/components/swap-panel.tsx` — NEW
- `web/src/components/swap-preflight.tsx` — NEW
- `web/src/components/defi-products.tsx` — NEW
- `web/src/components/defi-deposit-modal.tsx` — NEW
- `web/src/components/pending-approvals.tsx` — NEW
- `web/src/components/settings-panel.tsx` — NEW

### Modified Files (2 files)
- `web/src/components/nav-links.tsx` — add 2 nav entries
- `web/src/lib/api.ts` — add ~20 new fetch functions

### Total: 19 files (4 pages + 14 components + 1 modified lib)

---

## API Endpoints Used (all 56 previously unused)

| Tab | Endpoint | Method |
|-----|----------|--------|
| Analyze | `/scan/:token` | POST |
| Analyze | `/analyze/:token/rescan` | POST |
| Analyze | `/security/dapp-scan` | GET |
| Analyze | `/token/info/:token` | GET |
| Portfolio | `/portfolio/overview` | GET |
| Portfolio | `/portfolio/pnl` | GET |
| Portfolio | `/portfolio/history` | GET |
| Portfolio | `/manage/portfolio` | GET |
| Portfolio | `/manage/balances` | GET |
| Portfolio | `/manage/collect-all` | POST |
| Portfolio | `/manage/exit/:id` | POST |
| Portfolio | `/security/approvals/:addr` | GET |
| Trade | `/gateway/gas` | GET |
| Trade | `/gateway/simulate` | POST |
| Trade | `/invest/swap` | POST |
| Trade | `/invest/preview` | POST |
| Trade | `/invest/execute` | POST |
| Trade | `/defi/products` | GET |
| Trade | `/defi/detail/:id` | GET |
| Trade | `/yields` | GET |
| Agents | `/pending/analyze` | GET |
| Agents | `/pending/invest` | GET |
| Agents | `/pending/analyze/:token/approve` | POST |
| Agents | `/pending/invest/:token/approve` | POST |
| Agents | `/pending/:token` | DELETE |
| Agents | `/settings` | GET |
| Agents | `/settings` | PATCH |

---

## API Client Helpers

The existing `api.ts` only has a `get<T>` helper. Add `post<T>` and `patch<T>` and `del<T>`:

```ts
async function post<T>(path: string, body?: unknown): Promise<T | null> {
  try {
    const res = await fetch(`${API_URL}/api${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch { return null; }
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
  } catch { return null; }
}

async function del<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${API_URL}/api${path}`, { method: "DELETE" });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch { return null; }
}
```

## Token Search for Swap

The SwapPanel token selector uses `/dex/search?q={query}` to search tokens by name/symbol. Debounce 300ms. Display results as dropdown: symbol + name + address (truncated). On select, populate the token field.

```ts
export async function searchTokens(query: string): Promise<Record<string, unknown>[]>
// GET /api/dex/search?q={query}
```

## Settings Schema

The settings endpoint returns a flat object. Known fields (from backend):
- `scanIntervalMs`: number (milliseconds, display as minutes)
- `riskThreshold`: number (0-100)
- `autoInvest`: boolean
- `maxInvestmentUsd`: number

Render as labeled form fields (number inputs + toggle), not a dynamic KV editor.

---

## Design System Reference

All new components follow existing patterns:

- **Background:** `#09090b` (page), `white/[0.04]` (cards/inputs)
- **Text:** `#fafafa` (primary), `#a1a1aa` (secondary), `#52525b` (muted)
- **Accent:** `#06b6d4` (cyan, active states)
- **Success:** `#34d399` (green)
- **Warning:** `#f59e0b` (amber)
- **Danger:** `#ef4444` (red)
- **Borders:** `border-white/[0.06]` (sections), `border-white/[0.03]` (rows)
- **Font:** `font-mono`, `text-xs` for data, `text-[10px]` for labels, `text-[11px]` for table cells
- **Spacing:** `px-6 lg:px-10` page padding, `py-8` page top, `gap-6` between sections
- **Labels:** `text-[10px] font-medium text-[#52525b] uppercase tracking-wider`
- **Tables:** same as screener-table.tsx and tab-overview.tsx patterns
- **Buttons:** `text-xs font-mono px-3 py-1.5 rounded border border-white/[0.06]` + color variant
- **Max width:** `max-w-[1400px] mx-auto`
- **Responsive:** hide non-essential columns on `sm:` breakpoint
