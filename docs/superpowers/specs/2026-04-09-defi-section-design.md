# DeFi Section — Full Design Spec

## Overview

Standalone `/defi` route in main navigation with three sub-tabs: Explore, My Positions, Yield Calculator. Dedicated deposit page at `/defi/deposit/[investmentId]`. Trade tab retains only Swap.

Design system: `#09090b` bg, `#fafafa` text, `border-white/[0.06]`, `#06b6d4` accent cyan, Geist Sans + Mono, `text-xs`/`font-mono` for data, no shadows, max-w `1400px`.

---

## 1. Routing & Navigation

### New Routes
- `/defi` — main DeFi page with sub-tab navigation
- `/defi/deposit/[investmentId]` — dedicated deposit page

### Navigation Changes
- Add "DeFi" to `NavLinks` component (between Portfolio and Trade)
- Remove "DeFi" sub-tab from Trade page (Trade keeps only Swap)
- Trade tabs component (`trade-tabs.tsx`) simplified to Swap-only or removed

### Sub-Tab Navigation
Tabs rendered at top of `/defi` page: **Explore · My Positions · Yield Calculator**
- URL params: `/defi?tab=explore` (default), `/defi?tab=positions`, `/defi?tab=calculator`
- Same pattern as existing `TradeTabs` component

---

## 2. Explore Tab (Enhanced Table)

### Filter Bar
- **Type chips**: All (default) / Staking / LP / Lending — toggle filter, `productGroup` maps to onchainos values (`SINGLE_EARN`, `DEX_POOL`, `LENDING`)
- **Search input**: debounced (300ms), filters by pool name or token symbol (client-side from loaded data)
- **Sort**: clickable column headers — APY (desc default), TVL, Pool name

### Table Columns
| Column | Content | Alignment |
|--------|---------|-----------|
| Pool | Pool name + token pair | left |
| Protocol | Platform name | left |
| Type | Badge: LP (cyan `#06b6d4`), Stake (amber `#f59e0b`), Lend (purple `#a855f7`) | left |
| APY | Percentage + sparkline (inline SVG, ~60px wide, last 7 data points) | right |
| TVL | Formatted USD (`$1.2M`, `$45.3K`) | right |
| Action | "Deposit" button → navigates to `/defi/deposit/[investmentId]` | right |

### Data Sources
- Primary: `fetchDefiProducts(page)` — onchainos DeFi products with pagination
- Secondary: `fetchYields()` — DefiLlama top Uniswap pools, merged + deduplicated (existing logic)
- Sparkline data: from yields API historical data if available, otherwise static current APY point

### Pagination
- Load more button at bottom (API supports `?page=N`)
- Or infinite scroll with intersection observer

### States
- **Loading**: skeleton rows (6 rows, pulsing `bg-white/[0.04]` bars)
- **Empty**: "No DeFi products available" centered message
- **Error**: "Failed to load products. Retry" with retry button

---

## 3. Deposit Page (`/defi/deposit/[investmentId]`)

### Layout
Full page, max-w `800px` centered. Back button at top-left → `/defi`.

### Pool Info Header
- Pool name, protocol, type badge
- Stats row: APY, TVL, token symbol
- Data from `fetchDefiDetail(investmentId)`

### Adaptive Content by Type

#### LP Pools (Uniswap V3 style)
1. **Tick Range Selector**
   - Presets: Narrow (±5%), Medium (±15%), Wide (±25%), Full Range
   - Custom: two number inputs for lower/upper price
   - Range visualizer: horizontal bar showing selected range vs current price
   - Data: `onchainosDefi.prepare(investmentId)` returns tick spacing, current tick
   - Amounts auto-calculated: `onchainosDefi.calculateEntry(investmentId, address, inputToken, amount, decimal, tickLower, tickUpper)`

2. **Token Amounts**
   - Two amount displays showing calculated token0/token1 amounts
   - Based on selected range and input amount

#### Staking / Lending
- Simple amount input only (no tick range)
- Token symbol from detail data

### Common Elements

#### Amount Input
- Input field with token symbol label
- Wallet balance display below (via wagmi `useBalance`)
- "Max" button to fill balance
- Validation: positive number, not exceeding balance

#### Slippage Selector
- Presets: 0.1%, 0.5%, 1%, 3%
- Default: 0.5%

#### Preview Summary
- Expected APY
- Estimated gas (from `fetchGas()` or `gateway/simulate`)
- Input amount → expected position value
- For LP: token0 amount + token1 amount

#### Action Flow
```
1. User enters amount, configures range/slippage
2. Click "Deposit" button
3. Check ERC20 allowance (read via viem)
4. If insufficient → "Approve" TX (user signs via wagmi)
5. Wait for approval confirmation
6. Generate deposit calldata: onchainosDefi.deposit(investmentId, address, userInput, slippage, tickLower?, tickUpper?)
7. User signs deposit TX via wagmi sendTransaction with calldata
8. Wait for TX confirmation
9. Show success: TX hash + explorer link (oklink.com/xlayer/tx/...)
10. "View Position" button → /defi?tab=positions
```

#### Button States
- Default: "Deposit" (cyan bg)
- No wallet: "Connect Wallet" (disabled style)
- Approving: "Approving..." (loading spinner)
- Depositing: "Confirm in Wallet..." (loading)
- Confirming: "Confirming..." (loading)
- Success: "Deposit Confirmed!" (emerald)
- Error: show error message below button

### New Server Endpoints Needed

#### `GET /api/defi/prepare/:investmentId`
- Calls `onchainosDefi.prepare(investmentId)`
- Returns: accepted tokens, tick spacing, current tick, V3 params

#### `GET /api/defi/calculate-entry`
- Query params: `investmentId`, `address`, `inputToken`, `amount`, `decimal`, `tickLower?`, `tickUpper?`
- Calls `onchainosDefi.calculateEntry(...)`
- Returns: calculated token amounts for the position

#### `POST /api/defi/deposit`
- Body: `{ investmentId, address, userInput, slippage, tickLower?, tickUpper? }`
- Calls `onchainosDefi.deposit(...)`
- Returns: `{ tx: { to, data, value, gas } }` — calldata for user to sign

### New API Client Functions
```typescript
fetchDefiPrepare(investmentId: string): Promise<DefiPrepareResult>
fetchDefiCalculateEntry(params: CalculateEntryParams): Promise<CalculateEntryResult>
fetchDefiDepositCalldata(params: DepositParams): Promise<{ tx: TxCalldata }>
```

---

## 4. My Positions Tab

### Summary Row (4 stat cards)
| Card | Value | Color |
|------|-------|-------|
| Total Value | Sum of all positions USD | `#fafafa` |
| Total Earned | Sum of earned fees/rewards | `#34d399` (emerald) |
| Active Positions | Count | `#fafafa` |
| Avg APY | Weighted average | `#34d399` |

### Position List
Each position is a row with expand/collapse on click.

#### Collapsed Row
- Pool name + type badge (LP/Stake/Lend)
- Status badge: "In Range" (emerald), "Out of Range" (red), "Active" (emerald)
- Current value (right-aligned)
- Earned amount (right-aligned, emerald)

#### Expanded Content
- **For LP**: range bar visualization (lower/upper price, current price marker, in/out range coloring)
- Opened date
- PnL breakdown
- **Actions**:
  - "Collect Fees" button (calls `POST /api/manage/collect-all` or per-position endpoint)
  - "Exit" button (calls `POST /api/manage/exit/:investmentId` with ratio=1)
  - "Partial Exit" — optional slider for ratio (0.25, 0.5, 0.75, 1.0)

### Global Actions
- **"Collect All"** button at top-right — collects fees from all positions at once

### Data Source
- New endpoint needed: `GET /api/defi/positions/:address` — calls `onchainosDefi.positions(address)`
- Existing: `collectAllRewards()`, `exitPosition(investmentId, ratio)`

### New Server Endpoint

#### `GET /api/defi/positions/:address`
- Calls `onchainosDefi.positions(address, "xlayer")` (or multi-chain)
- Returns: array of position objects with value, earned, APY, range, status

### New API Client Function
```typescript
fetchDefiPositions(address: string): Promise<DefiPosition[]>
```

### States
- **Loading**: skeleton stat cards + skeleton rows
- **No wallet**: "Connect wallet to view your positions"
- **Empty**: "No positions yet" + link to Explore tab
- **Error**: retry UI

---

## 5. Yield Calculator Tab

### Layout
Two sections: inputs at top, results below.

### Inputs
- **Amount**: USD input field, default empty placeholder "1000"
- **Period selector**: chips — 7d / 30d / 90d / 1y (default: 30d)

### Compounding Growth Chart
- SVG-based line chart (no external chart library — keep bundle small)
- X axis: time (0 to selected period)
- Y axis: USD value
- Lines: top 5 pools by APY, each with distinct color
- Legend: pool names with colored dots
- Hover/tooltip: show exact value at time point (optional, nice-to-have)
- Calculation: compound interest formula `P * (1 + APY/365)^days`

### Results Table
| Column | Content |
|--------|---------|
| Pool | Pool name |
| Protocol | Platform name |
| APY | Current APY % |
| Projected Return | `+$XX.XX` (emerald) |
| Final Value | `$X,XXX.XX` |
| Risk | Badge: "IL Risk" (amber) for LP, "Low" (emerald) for staking/lending |
| Action | "Deposit →" link → `/defi/deposit/[investmentId]` |

### Data Source
- `fetchDefiProducts()` + `fetchYields()` — same as Explore tab
- Calculations: client-side, no new endpoints needed

### States
- **Loading**: skeleton chart + skeleton rows
- **No products**: "No yield data available"

---

## 6. New Components

| Component | File | Purpose |
|-----------|------|---------|
| `DefiPage` | `app/defi/page.tsx` | Main DeFi page with sub-tab routing |
| `DefiTabs` | `components/defi-tabs.tsx` | Sub-tab navigation (Explore/Positions/Calculator) |
| `DefiExplore` | `components/defi-explore.tsx` | Enhanced table with filters, search, sort |
| `DefiFilterBar` | `components/defi-filter-bar.tsx` | Type chips + search input |
| `DefiPositions` | `components/defi-positions.tsx` | Summary cards + expandable position list |
| `PositionRow` | `components/position-row.tsx` | Single expandable position row |
| `YieldCalculator` | `components/yield-calculator.tsx` | Calculator with chart + results |
| `YieldChart` | `components/yield-chart.tsx` | SVG compounding growth chart |
| `DepositPage` | `app/defi/deposit/[investmentId]/page.tsx` | Dedicated deposit page |
| `TickRangeSelector` | `components/tick-range-selector.tsx` | LP tick range presets + custom + visualizer |
| `RangeBar` | `components/range-bar.tsx` | Horizontal range visualization (reused in positions) |
| `SkeletonTable` | `components/skeleton-table.tsx` | Skeleton loader for tables |
| `SkeletonCards` | `components/skeleton-cards.tsx` | Skeleton loader for stat cards |
| `TypeBadge` | `components/type-badge.tsx` | LP/Stake/Lend badge with consistent colors |
| `StatusBadge` | `components/status-badge.tsx` | In Range/Out of Range/Active badge |

## 7. Modified Files

| File | Change |
|------|--------|
| `components/nav-links.tsx` | Add "DeFi" link between Portfolio and Trade |
| `app/trade/page.tsx` | Remove DeFi tab, keep Swap only |
| `components/trade-tabs.tsx` | Remove "DeFi" tab option (or delete if Swap-only needs no tabs) |
| `lib/api.ts` | Add: `fetchDefiPrepare`, `fetchDefiCalculateEntry`, `fetchDefiDepositCalldata`, `fetchDefiPositions` |
| `server/src/service-router.ts` | Add: `/defi/prepare/:id`, `/defi/calculate-entry`, `/defi/deposit` (POST), `/defi/positions/:address` |

## 8. Design Tokens (consistent across all new components)

```
Background:        #09090b
Surface:           bg-white/[0.04]
Border:            border-white/[0.06]
Text primary:      #fafafa
Text secondary:    #a1a1aa
Text muted:        #52525b
Accent cyan:       #06b6d4
Accent emerald:    #34d399
Accent amber:      #f59e0b
Accent purple:     #a855f7
Accent red:        #ef4444
Font data:         font-mono text-xs
Font labels:       font-mono text-[11px] text-[#52525b]
Button primary:    bg-[#06b6d4] text-[#09090b]
Button secondary:  bg-white/[0.06] text-[#a1a1aa]
Hover:             hover:bg-white/[0.02]
Border radius:     rounded (4px) for small, rounded-lg (8px) for cards
Skeleton:          bg-white/[0.04] animate-pulse rounded
```

## 9. Number Formatting

All monetary values use consistent formatting:
- `< $1`: `$0.42`
- `$1 - $999`: `$123.45`
- `$1K - $999K`: `$45.3K`
- `$1M+`: `$1.2M`
- APY: `24.52%` (2 decimal places)
- Use existing `formatUsd()` from `lib/api.ts`, extend if needed

## 10. Responsive Behavior

- **Desktop (>1024px)**: full table, all columns visible
- **Tablet (768-1024px)**: table horizontally scrollable, stat cards 2x2 grid
- **Mobile (<768px)**: stat cards stack vertically, table scrollable, deposit page full-width
