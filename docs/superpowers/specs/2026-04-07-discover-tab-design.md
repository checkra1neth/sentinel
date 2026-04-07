# Discover Tab + Token Profile — Design Spec

## Goal

Build the Discover tab (hybrid screener) and Token Profile page (drill-down) for the Sentinel frontend. Expose all backend intelligence endpoints in a professional Arkham/Nansen-style UI, using the existing design system.

## Architecture

Two new pages (`/discover` and `/token/[address]`) replacing the current `/feed` page. The Discover page aggregates data from 6+ backend endpoints into a unified screener table with live signal bar and leaderboard. Token Profile is a sub-tabbed deep-dive page loading data lazily per tab.

## Tech Stack

- Next.js 16 (App Router, existing setup)
- React 19 + TypeScript
- Tailwind CSS v4 (existing theme: `#09090b` bg, `#fafafa` fg, `#06b6d4` accent)
- Geist Sans + Geist Mono fonts
- React Query (`@tanstack/react-query`, already installed)
- WebSocket for live signal bar (existing `useAgentEvents` hook)
- No new dependencies

---

## Page 1: Discover `/discover`

### Layout (top to bottom)

1. **Live Signal Bar** — horizontal strip below nav, real-time whale/smart money/KOL activity
2. **Source Filters** — pill buttons: All | Whale | Smart Money | Trending | Scanner | KOL + search input
3. **Screener Table** — main content, sortable columns, click row → Token Profile
4. **Leaderboard Panel** — top traders by PnL, separated by `border-top`

### Live Signal Bar

- Data: WebSocket events from existing `/api/events` (type: `new-token`, `verdict`, signal events)
- Displays: green dot + "LIVE" label + scrolling recent signals
- Format per signal: `{action} {tokenSymbol} ${amount} — {timeAgo}`
- Color by type: whale=#34d399, smart money=#a78bfa, KOL=#f59e0b, scanner=#06b6d4
- Styling: `font-mono text-[11px] text-[#52525b]`, border-bottom `border-white/[0.06]`

### Source Filters

- Pill buttons with `active` state: `text-[#fafafa] bg-white/[0.06]` vs `text-[#52525b] border-white/[0.06]`
- Clicking a filter updates the screener table client-side (no API call — filter from merged data)
- Search input: filters by token name/symbol/address, debounced 300ms
- Styling: `text-xs font-medium`, 4px 10px padding, border-radius 4px

### Screener Table

#### Data Sources (fetched in parallel on mount, polled every 15s)

| Source | Endpoint | Maps to Source badge |
|--------|----------|---------------------|
| Scanner discoveries | `GET /discover/feed` | SCANNER |
| Whale/Smart Money/KOL signals | `GET /discover/whales` | WHALE / SMART $ / KOL (from `tracker` field) |
| DexScreener trending | `GET /dex/trending` | TRENDING |
| Existing verdicts | `GET /verdicts?limit=50` | (enriches rows with risk score) |

#### Merge Logic

All sources merged into a single array, deduplicated by token address (latest signal wins). Each row stores a `source` tag from the originating endpoint. If a verdict exists for the token, the risk score and verdict badge are shown; otherwise risk column shows "—".

#### Columns

| Column | Source | Align | Responsive |
|--------|--------|-------|------------|
| Token (symbol + truncated address) | All sources | left | always |
| Price | `/market/price` or DexScreener | right, mono | always |
| 24h % | DexScreener `priceChange.h24` | right, mono, green/red | always |
| MCap | DexScreener `marketCap` | right, mono, muted | hidden < md |
| Liquidity | DexScreener `liquidity.usd` | right, mono, muted | hidden < md |
| Volume | DexScreener `volume.h24` | right, mono, muted | hidden < sm |
| Risk | Verdict `riskScore` | right | always |
| Smart $ | `/token/holders` smart money count in top 100 | center, mono, cyan | hidden < sm |
| Source | Internal tag | left | always |
| Age | Signal timestamp | right, mono, dim | always |

#### Risk Badge Styling

- 0-35: `text-[#34d399] bg-[rgba(52,211,153,0.08)]` (SAFE)
- 36-65: `text-[#f59e0b] bg-[rgba(245,158,11,0.08)]` (CAUTION)
- 66-100: `text-[#ef4444] bg-[rgba(239,68,68,0.08)]` (DANGER)
- Font: `text-[10px] font-mono font-medium`, padding 1px 6px, border-radius 3px

#### Source Badge Styling

- All: `text-[9px] font-mono font-medium uppercase`
- WHALE: `text-[#34d399]`
- SMART $: `text-[#a78bfa]`
- TRENDING: `text-[#f59e0b]`
- SCANNER: `text-[#06b6d4]`
- KOL: `text-[#f59e0b]`

#### Sorting

- Default sort: by Age (newest first)
- Clickable column headers toggle sort (asc/desc)
- Client-side sorting only (data already in memory)

#### Row Click

- Navigates to `/token/{address}` (Token Profile page)

### Leaderboard Panel

- Data: `GET /leaderboard?timeFrame=3&sortBy=1` (7d, sorted by PnL)
- Separated from table by `border-top border-white/[0.06]` + section header
- Layout: horizontal flex of 4 leader cards, each showing: truncated address, PnL ($), win rate %, trade count
- Font: `font-mono text-[11px]`
- "View all →" link (future: dedicated leaderboard page)

---

## Page 2: Token Profile `/token/[address]`

### Layout (top to bottom)

1. **Breadcrumb** — `Discover / {SYMBOL}`
2. **Hero** — token name, symbol, verdict badge, address, 6 key metrics
3. **Sub-tabs** — Overview | Holders | Traders | Security | Dev Intel
4. **Tab Content** — lazy-loaded per tab

### Hero Section

- Token name (20px font-semibold) + symbol (14px muted) + verdict badge
- Address: full, mono, `text-[11px] text-[#52525b]`, with "X Layer" label
- 6 metrics in a row: Price (+24h%), Market Cap, Liquidity, Volume 24h, Holders, Smart Money count
- Metric label: `text-[10px] text-[#52525b] uppercase tracking-wider`
- Metric value: `font-mono text-[12px] text-[#fafafa]`

#### Data Sources for Hero

| Metric | Endpoint |
|--------|----------|
| Price, 24h%, MCap, Liq, Volume | `GET /dex/pairs/{address}` (DexScreener) |
| Verdict + Risk Score | `GET /analyze/{address}` (cached verdict) |
| Holders count | `GET /token/holders/{address}` (array length) |
| Smart Money count | `GET /token/holders/{address}?tag=3` (filtered count) |

### Sub-tabs

- Tabs: `text-[12px] font-medium`, inactive `text-[#52525b]`, active `text-[#fafafa]` with `border-bottom: 2px solid #06b6d4`
- Content loads lazily — only fetch when tab is activated
- Active tab state managed via `useState`

### Overview Tab

Two-column grid (`grid-cols-2`, single column on mobile).

**Left column:**

1. **Risk Breakdown** — risk bar (4px height, colored fill) + score label + key-value list:
   - Honeypot (Yes/No), Mintable, Proxy, Buy Tax %, Sell Tax %, Holder Concentration %, LP Locked
   - Data: from verdict (already fetched for hero)

2. **Cluster Analysis** — key-value list:
   - Rug Pull %, New Address %, Same Fund Source %
   - Data: `GET /token/cluster/{address}`

**Right column:**

3. **Top Holders** (preview, 5 rows) — mini table: Address, Tag (whale/smart$/kol/normal badge), Balance, %
   - Data: `GET /token/holders/{address}`

4. **Top Traders PnL** (preview, 3 rows) — mini table: Address, Tag, PnL ($), Trades
   - Average PnL line below table
   - Data: `GET /token/top-traders/{address}`

### Holders Tab

- Full holders table (up to 100 rows) from `GET /token/holders/{address}`
- Columns: Rank, Address, Tag, Balance, %, Cluster ID
- Cluster top holders: `GET /token/cluster-holders/{address}?range=3`

### Traders Tab

- Top traders table from `GET /token/top-traders/{address}`
- Columns: Address, Tag, PnL, Buy Vol, Sell Vol, Trades, Last Active
- Recent trades: `GET /token/trades/{address}?limit=20`
- Columns: Type (buy/sell), Address, Amount, Price, Time

### Security Tab

- Token scan results from verdict data (already fetched)
- Key-value grid: Honeypot, Mintable, Proxy, Self-destruct, External Call, Hidden Owner, Buy Tax, Sell Tax, Owner Can Change Balance, Can Take Back Ownership
- Each value colored: safe=green, danger=red, neutral=muted

### Dev Intel Tab

- Dev info: `GET /trenches/dev-info/{address}`
  - Key-values: Rug Pull Count, Total Tokens, Migrated Count, Holding Info
  - Serial launcher flag if rugPullCount > 2

- Similar tokens by dev: `GET /trenches/similar/{address}`
  - Mini table: Token Name, Status (MIGRATED/NEW/MIGRATING), Created At

- Bundle info: `GET /trenches/bundle/{address}`
  - Bundle analysis data

- Aped wallets: `GET /trenches/aped/{address}`
  - Wallets that aped into this token early

---

## Navigation Changes

Update `nav-links.tsx` to replace Feed with Discover:

```
[{ href: "/discover", label: "Discover" },
 { href: "/portfolio", label: "Portfolio" },
 { href: "/agents", label: "Agents" }]
```

Home page CTA button: `/feed` → `/discover`.

---

## File Structure

```
web/src/
├── app/
│   ├── discover/
│   │   └── page.tsx              # Discover screener page
│   ├── token/
│   │   └── [address]/
│   │       └── page.tsx          # Token Profile page
│   └── feed/
│       └── page.tsx              # Keep for backwards compat (redirect to /discover)
├── components/
│   ├── signal-bar.tsx            # Live signal bar
│   ├── source-filters.tsx        # Filter pill buttons
│   ├── screener-table.tsx        # Main screener table
│   ├── leaderboard-panel.tsx     # Top traders panel
│   ├── token-hero.tsx            # Token profile hero section
│   ├── token-tabs.tsx            # Sub-tab navigation
│   ├── tab-overview.tsx          # Overview tab content
│   ├── tab-holders.tsx           # Holders tab content
│   ├── tab-traders.tsx           # Traders tab content
│   ├── tab-security.tsx          # Security tab content
│   └── tab-dev-intel.tsx         # Dev Intel tab content
└── lib/
    └── api.ts                    # API fetch helpers (typed)
```

---

## Data Fetching Strategy

- **React Query** for all API calls — auto-caching, deduplication, background refetch
- **Polling**: Discover screener data refetches every 15 seconds
- **Lazy loading**: Token Profile tabs only fetch data when activated
- **WebSocket**: Live signal bar uses existing `useAgentEvents` hook
- **Error handling**: Graceful degradation — show "—" for unavailable data, no error modals

---

## Styling Rules (existing design system)

- Background: `#09090b`, foreground: `#fafafa`
- Muted text: `#a1a1aa`, dim text: `#52525b`
- Accent: `#06b6d4` (cyan)
- Safe: `#34d399`, Caution: `#f59e0b`, Danger: `#ef4444`
- Borders: `border-white/[0.06]`
- Hover rows: `hover:bg-white/[0.02]`
- Section headers: `text-[10px] font-medium text-[#52525b] uppercase tracking-wider`
- All numeric data: `font-mono`
- No shadows, no cards with backgrounds, no border-radius > 4px
- Tables: minimal borders (`border-white/[0.03]` between rows)
- Container: `mx-auto max-w-[1400px] px-6 lg:px-10`
