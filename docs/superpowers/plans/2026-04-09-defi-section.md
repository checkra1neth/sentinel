# DeFi Section Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a full standalone `/defi` page with Explore (enhanced table), My Positions (summary + expandable list), Yield Calculator (interactive chart), and a dedicated `/defi/deposit/[investmentId]` page with real onchainos calldata integration.

**Architecture:** New `/defi` route in main nav with sub-tab state via `useState`. Explore fetches from existing `/defi/products` + `/yields` endpoints. Deposit page calls 3 new server endpoints (`prepare`, `calculate-entry`, `deposit`) that proxy onchainos CLI. Positions tab calls a new `/defi/positions/:address` endpoint. Yield Calculator is client-side math from existing product data. All components use wagmi for connected wallet, TanStack Query for caching, existing design tokens.

**Tech Stack:** Next.js 16, React 19, TypeScript, TanStack Query, wagmi 3, viem, Tailwind CSS 4, SVG charts (no external chart library).

**Design spec:** `docs/superpowers/specs/2026-04-09-defi-section-design.md`

---

### Task 1: Server — Add DeFi prepare/calculate/deposit/positions endpoints

**Files:**
- Modify: `server/src/router/service-router.ts`

This task adds 4 new endpoints that proxy onchainos CLI DeFi commands to the frontend.

- [ ] **Step 1: Add GET /defi/prepare/:investmentId endpoint**

Add after the existing `/defi/detail/:investmentId` handler (around line 1448):

```typescript
router.get("/defi/prepare/:investmentId", (_req: Request, res: Response): void => {
  try {
    const result = onchainosDefi.prepare(Number(_req.params.investmentId));
    res.json({ success: result.success, data: result.data });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
  }
});
```

- [ ] **Step 2: Add GET /defi/calculate-entry endpoint**

```typescript
router.get("/defi/calculate-entry", (_req: Request, res: Response): void => {
  try {
    const { investmentId, address, inputToken, amount, decimal, tickLower, tickUpper } = _req.query;
    if (!investmentId || !address || !inputToken || !amount || !decimal) {
      res.status(400).json({ error: "Missing required params: investmentId, address, inputToken, amount, decimal" });
      return;
    }
    const result = onchainosDefi.calculateEntry(
      Number(investmentId),
      String(address),
      String(inputToken),
      String(amount),
      Number(decimal),
      tickLower ? Number(tickLower) : undefined,
      tickUpper ? Number(tickUpper) : undefined,
    );
    res.json({ success: result.success, data: result.data });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
  }
});
```

- [ ] **Step 3: Add POST /defi/deposit endpoint**

```typescript
router.post("/defi/deposit", (_req: Request, res: Response): void => {
  try {
    const { investmentId, address, userInput, slippage, tickLower, tickUpper } = _req.body;
    if (!investmentId || !address || !userInput) {
      res.status(400).json({ error: "Missing required: investmentId, address, userInput" });
      return;
    }
    const result = onchainosDefi.deposit(
      Number(investmentId),
      String(address),
      typeof userInput === "string" ? userInput : JSON.stringify(userInput),
      slippage ? String(slippage) : undefined,
      tickLower !== undefined ? Number(tickLower) : undefined,
      tickUpper !== undefined ? Number(tickUpper) : undefined,
    );
    res.json({ success: result.success, data: result.data });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
  }
});
```

- [ ] **Step 4: Add GET /defi/positions/:address endpoint**

```typescript
router.get("/defi/positions/:address", (_req: Request, res: Response): void => {
  try {
    const chains = String(_req.query.chains ?? "xlayer");
    const result = onchainosDefi.positions(_req.params.address, chains);
    res.json({ success: result.success, data: result.data });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
  }
});
```

- [ ] **Step 5: Verify server compiles**

Run: `cd /Users/pavelmackevic/Projects/agentra/server && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 6: Commit**

```bash
cd /Users/pavelmackevic/Projects/agentra
git add server/src/router/service-router.ts
git commit -m "feat(server): add defi prepare, calculate-entry, deposit, positions endpoints"
```

---

### Task 2: API Client — Add DeFi fetch functions

**Files:**
- Modify: `web/src/lib/api.ts`

- [ ] **Step 1: Add fetchDefiPrepare function**

Add after `fetchDefiDetail` in api.ts:

```typescript
export async function fetchDefiPrepare(investmentId: string): Promise<Record<string, unknown>> {
  const data = await get<Record<string, unknown>>(`/defi/prepare/${investmentId}`);
  return data ?? {};
}
```

- [ ] **Step 2: Add fetchDefiCalculateEntry function**

```typescript
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
```

- [ ] **Step 3: Add fetchDefiDepositCalldata function**

```typescript
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
```

- [ ] **Step 4: Add fetchDefiPositions function**

```typescript
export async function fetchDefiPositions(address: string, chains = "xlayer"): Promise<Record<string, unknown>> {
  const data = await get<Record<string, unknown>>(`/defi/positions/${address}?chains=${chains}`);
  return data ?? {};
}
```

- [ ] **Step 5: Commit**

```bash
cd /Users/pavelmackevic/Projects/agentra
git add web/src/lib/api.ts
git commit -m "feat(api): add defi prepare, calculate-entry, deposit, positions client functions"
```

---

### Task 3: Navigation — Add DeFi link, simplify Trade

**Files:**
- Modify: `web/src/components/nav-links.tsx`
- Modify: `web/src/app/trade/page.tsx`
- Modify: `web/src/components/trade-tabs.tsx`

- [ ] **Step 1: Add DeFi to navigation links**

In `nav-links.tsx`, add DeFi between Portfolio and Trade in the LINKS array:

```typescript
const LINKS = [
  { href: "/discover", label: "Discover" },
  { href: "/analyze", label: "Analyze" },
  { href: "/portfolio", label: "Portfolio" },
  { href: "/defi", label: "DeFi" },
  { href: "/trade", label: "Trade" },
  { href: "/agents", label: "Agents" },
];
```

- [ ] **Step 2: Simplify Trade page — remove DeFi tab**

Replace `web/src/app/trade/page.tsx` with Swap-only:

```typescript
"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { SwapPanel } from "../../components/swap-panel";

function TradeContent(): React.ReactNode {
  const searchParams = useSearchParams();
  const initialToken = searchParams.get("token") ?? undefined;

  return (
    <div className="mx-auto max-w-[1400px] px-6 lg:px-10 py-8">
      <h1 className="text-lg font-semibold tracking-wide mb-6">Trade</h1>
      <SwapPanel initialToToken={initialToken} />
    </div>
  );
}

export default function TradePage(): React.ReactNode {
  return (
    <Suspense>
      <TradeContent />
    </Suspense>
  );
}
```

- [ ] **Step 3: Delete trade-tabs.tsx (no longer used)**

Remove the file since Trade is now Swap-only.

- [ ] **Step 4: Verify build**

Run: `cd /Users/pavelmackevic/Projects/agentra/web && npx next build 2>&1 | tail -20`
Expected: build succeeds (or at least no import errors)

- [ ] **Step 5: Commit**

```bash
cd /Users/pavelmackevic/Projects/agentra
git add web/src/components/nav-links.tsx web/src/app/trade/page.tsx
git rm web/src/components/trade-tabs.tsx
git commit -m "feat(nav): add DeFi to main nav, simplify Trade to Swap-only"
```

---

### Task 4: Shared components — TypeBadge, StatusBadge, SkeletonTable

**Files:**
- Create: `web/src/components/type-badge.tsx`
- Create: `web/src/components/status-badge.tsx`
- Create: `web/src/components/skeleton-rows.tsx`

These are small reusable primitives used across Explore, Positions, and Deposit.

- [ ] **Step 1: Create TypeBadge component**

```typescript
// web/src/components/type-badge.tsx
"use client";

const STYLES: Record<string, string> = {
  LP: "text-[#06b6d4] bg-[#06b6d4]/10",
  Stake: "text-[#f59e0b] bg-[#f59e0b]/10",
  Lend: "text-[#a855f7] bg-[#a855f7]/10",
};

interface TypeBadgeProps {
  type: string;
}

export function TypeBadge({ type }: TypeBadgeProps): React.ReactNode {
  const label = type === "DEX_POOL" ? "LP" : type === "SINGLE_EARN" ? "Stake" : type === "LENDING" ? "Lend" : type;
  const style = STYLES[label] ?? "text-[#a1a1aa] bg-white/[0.04]";
  return (
    <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold ${style}`}>
      {label}
    </span>
  );
}
```

- [ ] **Step 2: Create StatusBadge component**

```typescript
// web/src/components/status-badge.tsx
"use client";

const STYLES: Record<string, string> = {
  "In Range": "text-[#34d399] bg-[#34d399]/10",
  "Out of Range": "text-[#ef4444] bg-[#ef4444]/10",
  Active: "text-[#34d399] bg-[#34d399]/10",
  Closed: "text-[#52525b] bg-white/[0.04]",
};

interface StatusBadgeProps {
  status: string;
}

export function StatusBadge({ status }: StatusBadgeProps): React.ReactNode {
  const style = STYLES[status] ?? "text-[#a1a1aa] bg-white/[0.04]";
  return (
    <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${style}`}>
      {status}
    </span>
  );
}
```

- [ ] **Step 3: Create SkeletonRows component**

```typescript
// web/src/components/skeleton-rows.tsx
"use client";

interface SkeletonRowsProps {
  rows?: number;
  columns?: number;
}

export function SkeletonRows({ rows = 6, columns = 5 }: SkeletonRowsProps): React.ReactNode {
  return (
    <div className="space-y-0">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 py-2.5 border-b border-white/[0.04]"
        >
          {Array.from({ length: columns }).map((_, j) => (
            <div
              key={j}
              className="h-3 rounded bg-white/[0.04] animate-pulse"
              style={{ width: j === 0 ? "30%" : "15%" }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
cd /Users/pavelmackevic/Projects/agentra
git add web/src/components/type-badge.tsx web/src/components/status-badge.tsx web/src/components/skeleton-rows.tsx
git commit -m "feat(ui): add TypeBadge, StatusBadge, SkeletonRows shared components"
```

---

### Task 5: DeFi Explore tab — enhanced table with filters & sort

**Files:**
- Create: `web/src/components/defi-tabs.tsx`
- Create: `web/src/components/defi-explore.tsx`

- [ ] **Step 1: Create DefiTabs component**

```typescript
// web/src/components/defi-tabs.tsx
"use client";

const TABS = ["Explore", "My Positions", "Yield Calculator"] as const;
export type DefiTab = (typeof TABS)[number];

interface DefiTabsProps {
  active: DefiTab;
  onChange: (tab: DefiTab) => void;
}

export function DefiTabs({ active, onChange }: DefiTabsProps): React.ReactNode {
  return (
    <div className="flex gap-0 border-b border-white/[0.06] mt-1">
      {TABS.map((tab) => (
        <button
          key={tab}
          onClick={() => onChange(tab)}
          className={`px-4 py-2.5 text-xs font-medium transition-colors cursor-pointer border-b-2 ${
            active === tab
              ? "text-[#fafafa] border-[#06b6d4]"
              : "text-[#52525b] border-transparent hover:text-[#a1a1aa]"
          }`}
        >
          {tab}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Create DefiExplore component**

```typescript
// web/src/components/defi-explore.tsx
"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { fetchDefiProducts, fetchYields, formatUsd, REFETCH_SLOW, STALE_NORMAL } from "../lib/api";
import { TypeBadge } from "./type-badge";
import { SkeletonRows } from "./skeleton-rows";

type ProductType = "All" | "LP" | "Stake" | "Lend";
type SortKey = "apy" | "tvl" | "name";
type SortDir = "asc" | "desc";

interface Pool {
  investmentId: string;
  name: string;
  platform: string;
  apy: number;
  tvl: number;
  productType: string;
}

export function DefiExplore(): React.ReactNode {
  const router = useRouter();
  const [filter, setFilter] = useState<ProductType>("All");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("apy");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const { data: productsData, isLoading: productsLoading } = useQuery({
    queryKey: ["defi-products"],
    queryFn: () => fetchDefiProducts(),
    staleTime: STALE_NORMAL,
    refetchInterval: REFETCH_SLOW,
  });

  const { data: yieldsData } = useQuery({
    queryKey: ["yields"],
    queryFn: () => fetchYields(),
    staleTime: STALE_NORMAL,
    refetchInterval: REFETCH_SLOW,
  });

  const pools = useMemo((): Pool[] => {
    const raw = productsData as Record<string, unknown> | null;
    const dataObj = raw?.data as Record<string, unknown> | undefined;
    const list = dataObj?.list ?? raw?.list ?? raw?.products;
    const products = Array.isArray(list) ? (list as Record<string, unknown>[]) : [];

    const mapped: Pool[] = products.map((p) => ({
      investmentId: String(p.investmentId ?? p.id ?? ""),
      name: String(p.name ?? p.poolName ?? ""),
      platform: String(p.platformName ?? p.platform ?? p.protocol ?? ""),
      apy: Number(p.rate ?? p.apy ?? p.apr ?? 0) * (Number(p.rate ?? 0) < 1 ? 100 : 1),
      tvl: Number(p.tvl ?? p.totalValueLocked ?? 0),
      productType: String(p.investType ?? p.productGroup ?? p.type ?? "DEX_POOL"),
    }));

    const yieldsArr = (yieldsData as Record<string, unknown>)?.pools as Record<string, unknown>[] | undefined;
    if (yieldsArr) {
      for (const y of yieldsArr) {
        const id = String(y.investmentId ?? y.pool ?? "");
        if (!mapped.some((p) => p.investmentId === id)) {
          mapped.push({
            investmentId: id,
            name: String(y.name ?? y.symbol ?? ""),
            platform: String(y.project ?? y.platform ?? ""),
            apy: Number(y.apy ?? y.apyBase ?? 0),
            tvl: Number(y.tvlUsd ?? y.tvl ?? 0),
            productType: "DEX_POOL",
          });
        }
      }
    }

    return mapped;
  }, [productsData, yieldsData]);

  const filtered = useMemo(() => {
    let result = pools;

    if (filter !== "All") {
      const typeMap: Record<string, string[]> = {
        LP: ["DEX_POOL"],
        Stake: ["SINGLE_EARN"],
        Lend: ["LENDING"],
      };
      const allowed = typeMap[filter] ?? [];
      result = result.filter((p) => allowed.includes(p.productType));
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (p) => p.name.toLowerCase().includes(q) || p.platform.toLowerCase().includes(q),
      );
    }

    const dir = sortDir === "asc" ? 1 : -1;
    result.sort((a, b) => {
      switch (sortKey) {
        case "apy": return (a.apy - b.apy) * dir;
        case "tvl": return (a.tvl - b.tvl) * dir;
        case "name": return a.name.localeCompare(b.name) * dir;
        default: return 0;
      }
    });

    return result;
  }, [pools, filter, search, sortKey, sortDir]);

  const toggleSort = (key: SortKey): void => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const TYPES: ProductType[] = ["All", "LP", "Stake", "Lend"];
  const thClass = "pb-2 font-medium text-[10px] text-[#52525b] uppercase tracking-wider cursor-pointer hover:text-[#a1a1aa] transition-colors select-none";

  return (
    <div>
      {/* Filter bar */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {TYPES.map((t) => (
          <button
            key={t}
            onClick={() => setFilter(t)}
            className={`px-3 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer ${
              filter === t
                ? "bg-[#06b6d4]/10 text-[#06b6d4] border border-[#06b6d4]/20"
                : "bg-white/[0.04] text-[#a1a1aa] border border-white/[0.06] hover:text-[#fafafa]"
            }`}
          >
            {t}
          </button>
        ))}
        <input
          type="text"
          placeholder="Search pool or protocol..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="ml-auto bg-white/[0.04] border border-white/[0.06] rounded px-3 py-1 text-xs font-mono text-[#fafafa] placeholder:text-[#52525b] outline-none focus:border-[#06b6d4]/40 w-56"
        />
      </div>

      {/* Table */}
      {productsLoading ? (
        <SkeletonRows rows={8} columns={6} />
      ) : filtered.length === 0 ? (
        <div className="py-12 text-center text-xs font-mono text-[#52525b]">
          {search || filter !== "All" ? "No products match your filters" : "No DeFi products available"}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="text-left border-b border-white/[0.06]">
                <th className={thClass} onClick={() => toggleSort("name")}>
                  Pool {sortKey === "name" ? (sortDir === "asc" ? "↑" : "↓") : ""}
                </th>
                <th className={thClass}>Protocol</th>
                <th className={thClass}>Type</th>
                <th className={`${thClass} text-right`} onClick={() => toggleSort("apy")}>
                  APY {sortKey === "apy" ? (sortDir === "asc" ? "↑" : "↓") : ""}
                </th>
                <th className={`${thClass} text-right`} onClick={() => toggleSort("tvl")}>
                  TVL {sortKey === "tvl" ? (sortDir === "asc" ? "↑" : "↓") : ""}
                </th>
                <th className={`${thClass} text-right`} />
              </tr>
            </thead>
            <tbody>
              {filtered.map((pool) => (
                <tr
                  key={pool.investmentId}
                  className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors"
                >
                  <td className="py-2.5 pr-4 text-[#fafafa]">{pool.name}</td>
                  <td className="py-2.5 pr-4 text-[#a1a1aa]">{pool.platform}</td>
                  <td className="py-2.5 pr-4">
                    <TypeBadge type={pool.productType} />
                  </td>
                  <td className="py-2.5 pr-4 text-right text-emerald-400">
                    {pool.apy.toFixed(2)}%
                  </td>
                  <td className="py-2.5 pr-4 text-right text-[#a1a1aa]">
                    {formatUsd(pool.tvl)}
                  </td>
                  <td className="py-2.5 text-right">
                    <button
                      type="button"
                      onClick={() => router.push(`/defi/deposit/${pool.investmentId}`)}
                      className="px-3 py-1 rounded text-[10px] font-semibold bg-[#06b6d4]/10 text-[#06b6d4] border border-[#06b6d4]/20 hover:bg-[#06b6d4]/20 transition-colors cursor-pointer"
                    >
                      Deposit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
cd /Users/pavelmackevic/Projects/agentra
git add web/src/components/defi-tabs.tsx web/src/components/defi-explore.tsx
git commit -m "feat(defi): add DefiTabs and DefiExplore components with filters and sort"
```

---

### Task 6: DeFi page — main route with sub-tabs

**Files:**
- Create: `web/src/app/defi/page.tsx`

- [ ] **Step 1: Create /defi page**

```typescript
// web/src/app/defi/page.tsx
"use client";

import { useState } from "react";
import { DefiTabs, type DefiTab } from "../../components/defi-tabs";
import { DefiExplore } from "../../components/defi-explore";
import { DefiPositions } from "../../components/defi-positions";
import { YieldCalculator } from "../../components/yield-calculator";

export default function DefiPage(): React.ReactNode {
  const [activeTab, setActiveTab] = useState<DefiTab>("Explore");

  return (
    <div className="mx-auto max-w-[1400px] px-6 lg:px-10 py-8">
      <h1 className="text-lg font-semibold tracking-wide mb-4">DeFi</h1>

      <DefiTabs active={activeTab} onChange={setActiveTab} />

      <div className="mt-6">
        {activeTab === "Explore" && <DefiExplore />}
        {activeTab === "My Positions" && <DefiPositions />}
        {activeTab === "Yield Calculator" && <YieldCalculator />}
      </div>
    </div>
  );
}
```

Note: `DefiPositions` and `YieldCalculator` are created in subsequent tasks. For now this file will have import errors — that's fine, they'll be resolved in Tasks 8 and 9.

- [ ] **Step 2: Commit**

```bash
cd /Users/pavelmackevic/Projects/agentra
git add web/src/app/defi/page.tsx
git commit -m "feat(defi): add /defi page with sub-tab routing"
```

---

### Task 7: Deposit page — dedicated route with real onchainos integration

**Files:**
- Create: `web/src/app/defi/deposit/[investmentId]/page.tsx`
- Create: `web/src/components/tick-range-selector.tsx`
- Create: `web/src/components/range-bar.tsx`

This is the largest task — the full deposit flow with tick range selector for LP and real calldata.

- [ ] **Step 1: Create RangeBar component (reused in deposit and positions)**

```typescript
// web/src/components/range-bar.tsx
"use client";

interface RangeBarProps {
  lower: number;
  upper: number;
  current: number;
  min?: number;
  max?: number;
}

export function RangeBar({ lower, upper, current, min, max }: RangeBarProps): React.ReactNode {
  const lo = min ?? lower * 0.8;
  const hi = max ?? upper * 1.2;
  const range = hi - lo || 1;
  const leftPct = ((lower - lo) / range) * 100;
  const widthPct = ((upper - lower) / range) * 100;
  const currentPct = ((current - lo) / range) * 100;
  const inRange = current >= lower && current <= upper;

  return (
    <div className="relative h-2 bg-white/[0.06] rounded-full">
      {/* Selected range */}
      <div
        className={`absolute h-full rounded-full ${inRange ? "bg-[#34d399]/40" : "bg-[#ef4444]/30"}`}
        style={{ left: `${Math.max(0, leftPct)}%`, width: `${Math.min(100, widthPct)}%` }}
      />
      {/* Current price marker */}
      <div
        className="absolute top-[-2px] w-1 h-3 bg-[#fafafa] rounded-sm"
        style={{ left: `${Math.min(100, Math.max(0, currentPct))}%` }}
      />
    </div>
  );
}
```

- [ ] **Step 2: Create TickRangeSelector component**

```typescript
// web/src/components/tick-range-selector.tsx
"use client";

import { useState, useEffect } from "react";
import { RangeBar } from "./range-bar";

interface TickRangeSelectorProps {
  currentPrice: number;
  tickSpacing: number;
  onChange: (lower: number, upper: number) => void;
}

type Preset = "narrow" | "medium" | "wide" | "full" | "custom";

const PRESETS: { key: Preset; label: string; range: number }[] = [
  { key: "narrow", label: "Narrow ±5%", range: 0.05 },
  { key: "medium", label: "Medium ±15%", range: 0.15 },
  { key: "wide", label: "Wide ±25%", range: 0.25 },
  { key: "full", label: "Full Range", range: 1 },
];

export function TickRangeSelector({ currentPrice, tickSpacing, onChange }: TickRangeSelectorProps): React.ReactNode {
  const [preset, setPreset] = useState<Preset>("medium");
  const [customLower, setCustomLower] = useState("");
  const [customUpper, setCustomUpper] = useState("");

  const lower = preset === "custom"
    ? Number(customLower) || currentPrice * 0.85
    : currentPrice * (1 - (PRESETS.find((p) => p.key === preset)?.range ?? 0.15));

  const upper = preset === "full"
    ? currentPrice * 2
    : preset === "custom"
      ? Number(customUpper) || currentPrice * 1.15
      : currentPrice * (1 + (PRESETS.find((p) => p.key === preset)?.range ?? 0.15));

  useEffect(() => {
    onChange(lower, upper);
  }, [lower, upper, onChange]);

  return (
    <div className="space-y-3">
      <div className="text-[11px] font-mono text-[#52525b]">Price Range</div>

      {/* Presets */}
      <div className="flex gap-2 flex-wrap">
        {PRESETS.map((p) => (
          <button
            key={p.key}
            onClick={() => setPreset(p.key)}
            className={`px-3 py-1 rounded text-[10px] font-medium transition-colors cursor-pointer ${
              preset === p.key
                ? "bg-[#06b6d4]/10 text-[#06b6d4] border border-[#06b6d4]/20"
                : "bg-white/[0.04] text-[#a1a1aa] border border-white/[0.06] hover:text-[#fafafa]"
            }`}
          >
            {p.label}
          </button>
        ))}
        <button
          onClick={() => {
            setPreset("custom");
            setCustomLower(String((currentPrice * 0.85).toFixed(6)));
            setCustomUpper(String((currentPrice * 1.15).toFixed(6)));
          }}
          className={`px-3 py-1 rounded text-[10px] font-medium transition-colors cursor-pointer ${
            preset === "custom"
              ? "bg-[#06b6d4]/10 text-[#06b6d4] border border-[#06b6d4]/20"
              : "bg-white/[0.04] text-[#a1a1aa] border border-white/[0.06] hover:text-[#fafafa]"
          }`}
        >
          Custom
        </button>
      </div>

      {/* Custom inputs */}
      {preset === "custom" && (
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="block text-[10px] text-[#52525b] font-mono mb-1">Min Price</label>
            <input
              type="text"
              inputMode="decimal"
              value={customLower}
              onChange={(e) => setCustomLower(e.target.value)}
              className="w-full bg-white/[0.04] border border-white/[0.06] rounded px-3 py-1.5 text-xs font-mono text-[#fafafa] placeholder:text-[#52525b] outline-none focus:border-[#06b6d4]/40"
            />
          </div>
          <div className="flex-1">
            <label className="block text-[10px] text-[#52525b] font-mono mb-1">Max Price</label>
            <input
              type="text"
              inputMode="decimal"
              value={customUpper}
              onChange={(e) => setCustomUpper(e.target.value)}
              className="w-full bg-white/[0.04] border border-white/[0.06] rounded px-3 py-1.5 text-xs font-mono text-[#fafafa] placeholder:text-[#52525b] outline-none focus:border-[#06b6d4]/40"
            />
          </div>
        </div>
      )}

      {/* Range visualization */}
      <div>
        <RangeBar lower={lower} upper={upper} current={currentPrice} />
        <div className="flex justify-between mt-1 text-[9px] font-mono text-[#52525b]">
          <span>{lower.toFixed(4)}</span>
          <span className="text-[#fafafa]">Current: {currentPrice.toFixed(4)}</span>
          <span>{upper.toFixed(4)}</span>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create Deposit page**

```typescript
// web/src/app/defi/deposit/[investmentId]/page.tsx
"use client";

import { useState, useCallback, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useAccount, useBalance, useSendTransaction, useWaitForTransactionReceipt, useReadContract } from "wagmi";
import { parseUnits, type Address, encodeFunctionData, maxUint256 } from "viem";
import {
  fetchDefiDetail,
  fetchDefiPrepare,
  fetchDefiCalculateEntry,
  fetchDefiDepositCalldata,
  formatUsd,
  STALE_NORMAL,
} from "../../../../lib/api";
import { TypeBadge } from "../../../../components/type-badge";
import { TickRangeSelector } from "../../../../components/tick-range-selector";

const ERC20_APPROVE_ABI = [
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
  {
    name: "allowance",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ type: "uint256" }],
  },
] as const;

type Step = "input" | "approving" | "depositing" | "confirming" | "success" | "error";

export default function DepositPage(): React.ReactNode {
  const { investmentId } = useParams<{ investmentId: string }>();
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const [amount, setAmount] = useState("");
  const [slippage, setSlippage] = useState("0.5");
  const [tickLower, setTickLower] = useState<number | undefined>();
  const [tickUpper, setTickUpper] = useState<number | undefined>();
  const [step, setStep] = useState<Step>("input");
  const [errorMsg, setErrorMsg] = useState("");

  // Pool detail
  const { data: detail, isLoading: detailLoading } = useQuery({
    queryKey: ["defi-detail", investmentId],
    queryFn: () => fetchDefiDetail(investmentId),
    staleTime: STALE_NORMAL,
  });

  // Prepare (tick info for LP)
  const { data: prepareData } = useQuery({
    queryKey: ["defi-prepare", investmentId],
    queryFn: () => fetchDefiPrepare(investmentId),
    staleTime: STALE_NORMAL,
  });

  // Unwrap detail
  const detailInner = ((detail as Record<string, unknown>)?.data ?? detail) as Record<string, unknown> | undefined;
  const poolName = String(detailInner?.name ?? detailInner?.poolName ?? "");
  const platform = String(detailInner?.platformName ?? detailInner?.platform ?? "");
  const apy = Number(detailInner?.rate ?? detailInner?.apy ?? 0) * (Number(detailInner?.rate ?? 0) < 1 ? 100 : 1);
  const tvl = Number(detailInner?.tvl ?? 0);
  const tokenAddr = String(detailInner?.tokenAddress ?? detailInner?.token ?? "");
  const tokenSymbol = String(detailInner?.tokenSymbol ?? detailInner?.symbol ?? "");
  const decimals = Number(detailInner?.decimal ?? detailInner?.tokenDecimal ?? 18);
  const productType = String(detailInner?.investType ?? detailInner?.productGroup ?? "DEX_POOL");
  const isLP = productType === "DEX_POOL";

  // Prepare data
  const prepInner = ((prepareData as Record<string, unknown>)?.data ?? prepareData) as Record<string, unknown> | undefined;
  const currentTick = Number(prepInner?.currentTick ?? prepInner?.tick ?? 0);
  const tickSpacing = Number(prepInner?.tickSpacing ?? 60);
  // Approximate current price from tick (simplified)
  const currentPrice = currentTick ? Math.pow(1.0001, currentTick) : 1;

  // Wallet balance
  const { data: walletBalance } = useBalance({ address });
  const balanceDisplay = walletBalance
    ? `${(Number(walletBalance.value) / 10 ** walletBalance.decimals).toFixed(6)} ${walletBalance.symbol}`
    : "0";

  // TX hooks
  const { data: txHash, sendTransaction, isPending: isSending, error: sendError, reset: resetSend } = useSendTransaction();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash: txHash });

  // Handle deposit
  const handleDeposit = useCallback(async () => {
    if (!isConnected || !address || !amount || Number(amount) <= 0) return;

    setStep("depositing");
    setErrorMsg("");

    try {
      // Build userInput JSON for onchainos
      const userInput = JSON.stringify([{
        tokenAddress: tokenAddr,
        tokenAmount: amount,
        decimal: String(decimals),
      }]);

      const result = await fetchDefiDepositCalldata({
        investmentId,
        address,
        userInput,
        slippage: (Number(slippage) / 100).toString(),
        tickLower: isLP ? tickLower : undefined,
        tickUpper: isLP ? tickUpper : undefined,
      });

      const data = (result?.data ?? result) as Record<string, unknown>;
      const txData = (data?.tx ?? data?.calldata ?? data) as Record<string, unknown>;
      const to = String(txData?.to ?? txData?.toAddress ?? "");
      const calldata = String(txData?.data ?? txData?.callData ?? "");
      const value = String(txData?.value ?? "0");

      if (!to || !calldata) {
        setStep("error");
        setErrorMsg("Failed to generate deposit calldata");
        return;
      }

      sendTransaction({
        to: to as Address,
        data: calldata as `0x${string}`,
        value: BigInt(value),
      });
    } catch (err) {
      setStep("error");
      setErrorMsg(err instanceof Error ? err.message : "Deposit failed");
    }
  }, [isConnected, address, amount, tokenAddr, decimals, investmentId, slippage, isLP, tickLower, tickUpper, sendTransaction]);

  // Track TX state
  useEffect(() => {
    if (isSending) setStep("depositing");
    if (isConfirming) setStep("confirming");
    if (isConfirmed) setStep("success");
    if (sendError) {
      setStep("error");
      setErrorMsg(sendError.message.includes("rejected") ? "Transaction rejected" : sendError.message.slice(0, 120));
    }
  }, [isSending, isConfirming, isConfirmed, sendError]);

  const handleRangeChange = useCallback((lower: number, upper: number) => {
    setTickLower(Math.floor(Math.log(lower) / Math.log(1.0001)));
    setTickUpper(Math.floor(Math.log(upper) / Math.log(1.0001)));
  }, []);

  const SLIPPAGES = ["0.1", "0.5", "1", "3"];

  if (detailLoading) {
    return (
      <div className="mx-auto max-w-[800px] px-6 lg:px-10 py-8">
        <div className="h-4 w-16 bg-white/[0.04] animate-pulse rounded mb-6" />
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-10 bg-white/[0.04] animate-pulse rounded" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[800px] px-6 lg:px-10 py-8">
      {/* Back button */}
      <button
        onClick={() => router.push("/defi")}
        className="text-xs font-mono text-[#52525b] hover:text-[#fafafa] transition-colors cursor-pointer mb-6 flex items-center gap-1"
      >
        ← Back to DeFi
      </button>

      {/* Pool header */}
      <div className="border border-white/[0.06] rounded-lg p-5 mb-6">
        <div className="flex items-center gap-3 mb-3">
          <h1 className="text-base font-semibold text-[#fafafa]">{poolName}</h1>
          <TypeBadge type={productType} />
        </div>
        <div className="flex gap-6 text-[11px] font-mono">
          <div>
            <span className="text-[#52525b]">Protocol </span>
            <span className="text-[#a1a1aa]">{platform}</span>
          </div>
          <div>
            <span className="text-[#52525b]">APY </span>
            <span className="text-emerald-400">{apy.toFixed(2)}%</span>
          </div>
          <div>
            <span className="text-[#52525b]">TVL </span>
            <span className="text-[#a1a1aa]">{formatUsd(tvl)}</span>
          </div>
          {tokenSymbol && (
            <div>
              <span className="text-[#52525b]">Token </span>
              <span className="text-[#a1a1aa]">{tokenSymbol}</span>
            </div>
          )}
        </div>
      </div>

      {/* Tick range selector (LP only) */}
      {isLP && currentPrice > 0 && (
        <div className="border border-white/[0.06] rounded-lg p-5 mb-6">
          <TickRangeSelector
            currentPrice={currentPrice}
            tickSpacing={tickSpacing}
            onChange={handleRangeChange}
          />
        </div>
      )}

      {/* Amount input */}
      <div className="border border-white/[0.06] rounded-lg p-5 mb-6">
        <label className="block text-[11px] text-[#52525b] font-mono mb-2">Deposit Amount</label>
        <input
          type="text"
          inputMode="decimal"
          placeholder="0.0"
          value={amount}
          onChange={(e) => { setAmount(e.target.value); resetSend(); setStep("input"); }}
          className="w-full bg-white/[0.04] border border-white/[0.06] rounded px-3 py-2.5 text-sm font-mono text-[#fafafa] placeholder:text-[#52525b] outline-none focus:border-[#06b6d4]/40"
        />
        <div className="flex justify-between mt-1.5">
          <span className="text-[10px] font-mono text-[#52525b]">Balance: {balanceDisplay}</span>
          <button
            type="button"
            onClick={() => {
              if (walletBalance) setAmount((Number(walletBalance.value) / 10 ** walletBalance.decimals).toString());
            }}
            className="text-[10px] font-mono text-[#06b6d4] hover:text-[#06b6d4]/80 cursor-pointer"
          >
            Max
          </button>
        </div>
      </div>

      {/* Slippage */}
      <div className="border border-white/[0.06] rounded-lg p-5 mb-6">
        <div className="text-[11px] text-[#52525b] font-mono mb-2">Slippage Tolerance</div>
        <div className="flex gap-2">
          {SLIPPAGES.map((s) => (
            <button
              key={s}
              onClick={() => setSlippage(s)}
              className={`px-3 py-1 rounded text-[10px] font-medium transition-colors cursor-pointer ${
                slippage === s
                  ? "bg-[#06b6d4]/10 text-[#06b6d4] border border-[#06b6d4]/20"
                  : "bg-white/[0.04] text-[#a1a1aa] border border-white/[0.06] hover:text-[#fafafa]"
              }`}
            >
              {s}%
            </button>
          ))}
        </div>
      </div>

      {/* Preview */}
      {amount && Number(amount) > 0 && (
        <div className="border border-white/[0.06] rounded-lg p-5 mb-6">
          <div className="text-[11px] text-[#52525b] font-mono mb-2">Preview</div>
          <div className="flex flex-col gap-1.5 text-xs font-mono">
            <div className="flex justify-between">
              <span className="text-[#52525b]">Deposit</span>
              <span className="text-[#fafafa]">{amount} {tokenSymbol}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#52525b]">Expected APY</span>
              <span className="text-emerald-400">{apy.toFixed(2)}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#52525b]">Slippage</span>
              <span className="text-[#a1a1aa]">{slippage}%</span>
            </div>
          </div>
        </div>
      )}

      {/* Action button */}
      {!isConnected ? (
        <div className="px-3 py-2.5 border border-[#f59e0b]/30 rounded text-[11px] font-mono text-[#f59e0b] text-center">
          Connect wallet to deposit
        </div>
      ) : (
        <button
          type="button"
          disabled={!amount || Number(amount) <= 0 || step === "depositing" || step === "confirming"}
          onClick={handleDeposit}
          className={`w-full py-3 rounded text-xs font-semibold transition-colors cursor-pointer ${
            step === "success"
              ? "bg-[#34d399] text-[#09090b]"
              : amount && Number(amount) > 0
                ? "bg-[#06b6d4] text-[#09090b] hover:bg-[#06b6d4]/80"
                : "bg-white/[0.06] text-[#52525b] cursor-not-allowed"
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {step === "depositing" ? "Confirm in Wallet..." :
           step === "confirming" ? "Confirming..." :
           step === "success" ? "Deposit Confirmed!" :
           "Confirm Deposit"}
        </button>
      )}

      {/* TX hash */}
      {step === "success" && txHash && (
        <p className="text-[11px] font-mono text-emerald-400 text-center mt-3">
          TX:{" "}
          <a href={`https://www.oklink.com/xlayer/tx/${txHash}`} target="_blank" rel="noopener noreferrer" className="underline">
            {txHash.slice(0, 10)}...{txHash.slice(-6)}
          </a>
        </p>
      )}

      {/* Error */}
      {step === "error" && errorMsg && (
        <p className="text-[11px] font-mono text-red-400 text-center mt-3">{errorMsg}</p>
      )}

      {/* View position link */}
      {step === "success" && (
        <button
          onClick={() => router.push("/defi?tab=positions")}
          className="w-full mt-3 py-2 rounded text-xs font-mono text-[#06b6d4] border border-[#06b6d4]/20 hover:bg-[#06b6d4]/10 transition-colors cursor-pointer"
        >
          View My Positions →
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
cd /Users/pavelmackevic/Projects/agentra
git add web/src/app/defi/deposit/ web/src/components/tick-range-selector.tsx web/src/components/range-bar.tsx
git commit -m "feat(defi): add deposit page with tick range selector and real onchainos calldata"
```

---

### Task 8: My Positions tab — summary cards + expandable list

**Files:**
- Create: `web/src/components/defi-positions.tsx`

- [ ] **Step 1: Create DefiPositions component**

```typescript
// web/src/components/defi-positions.tsx
"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { fetchDefiPositions, collectAllRewards, exitPosition, formatUsd, REFETCH_NORMAL, STALE_NORMAL } from "../lib/api";
import { TypeBadge } from "./type-badge";
import { StatusBadge } from "./status-badge";
import { RangeBar } from "./range-bar";

interface Position {
  investmentId: string;
  name: string;
  platform: string;
  productType: string;
  value: number;
  earned: number;
  apy: number;
  status: string;
  lower?: number;
  upper?: number;
  current?: number;
  openedAt?: string;
}

function parsePositions(raw: Record<string, unknown>): Position[] {
  const data = (raw?.data ?? raw) as Record<string, unknown>;
  const list = data?.investments ?? data?.positions ?? data?.list;
  if (!Array.isArray(list)) return [];

  return (list as Record<string, unknown>[]).map((p) => ({
    investmentId: String(p.investmentId ?? p.id ?? ""),
    name: String(p.name ?? p.poolName ?? p.tokenSymbol ?? ""),
    platform: String(p.platformName ?? p.platform ?? ""),
    productType: String(p.investType ?? p.productGroup ?? "DEX_POOL"),
    value: Number(p.totalValue ?? p.value ?? p.holdingAmount ?? 0),
    earned: Number(p.earnedAmount ?? p.earned ?? p.claimableAmount ?? 0),
    apy: Number(p.rate ?? p.apy ?? 0) * (Number(p.rate ?? 0) < 1 ? 100 : 1),
    status: p.isInRange === false ? "Out of Range" : p.isInRange === true ? "In Range" : "Active",
    lower: Number(p.lowerPrice ?? p.tickLower ?? 0) || undefined,
    upper: Number(p.upperPrice ?? p.tickUpper ?? 0) || undefined,
    current: Number(p.currentPrice ?? p.price ?? 0) || undefined,
    openedAt: p.openedAt ? String(p.openedAt) : undefined,
  }));
}

export function DefiPositions(): React.ReactNode {
  const { address, isConnected } = useAccount();
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data: rawPositions, isLoading } = useQuery({
    queryKey: ["defi-positions", address],
    queryFn: () => fetchDefiPositions(address!),
    enabled: !!address,
    staleTime: STALE_NORMAL,
    refetchInterval: REFETCH_NORMAL,
  });

  const positions = useMemo(() => parsePositions(rawPositions ?? {}), [rawPositions]);

  const totalValue = positions.reduce((s, p) => s + p.value, 0);
  const totalEarned = positions.reduce((s, p) => s + p.earned, 0);
  const avgApy = positions.length > 0
    ? positions.reduce((s, p) => s + p.apy * p.value, 0) / (totalValue || 1)
    : 0;

  const collectMutation = useMutation({
    mutationFn: collectAllRewards,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["defi-positions"] }),
  });

  const exitMutation = useMutation({
    mutationFn: ({ id, ratio }: { id: string; ratio: number }) => exitPosition(id, ratio),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["defi-positions"] }),
  });

  if (!isConnected) {
    return (
      <div className="py-16 text-center text-xs font-mono text-[#52525b]">
        Connect wallet to view your positions
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex-1 h-16 bg-white/[0.04] animate-pulse rounded-lg" />
          ))}
        </div>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-14 bg-white/[0.04] animate-pulse rounded-lg" />
        ))}
      </div>
    );
  }

  if (positions.length === 0) {
    return (
      <div className="py-16 text-center text-xs font-mono text-[#52525b]">
        No positions yet — explore DeFi products in the Explore tab
      </div>
    );
  }

  return (
    <div>
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard label="Total Value" value={formatUsd(totalValue)} />
        <StatCard label="Total Earned" value={`+${formatUsd(totalEarned)}`} color="#34d399" />
        <StatCard label="Positions" value={String(positions.length)} />
        <StatCard label="Avg APY" value={`${avgApy.toFixed(2)}%`} color="#34d399" />
      </div>

      {/* Collect All */}
      {totalEarned > 0 && (
        <div className="flex justify-end mb-4">
          <button
            onClick={() => collectMutation.mutate()}
            disabled={collectMutation.isPending}
            className="px-4 py-1.5 rounded text-[11px] font-semibold bg-[#34d399]/10 text-[#34d399] border border-[#34d399]/20 hover:bg-[#34d399]/20 transition-colors cursor-pointer disabled:opacity-50"
          >
            {collectMutation.isPending ? "Collecting..." : `Collect All (${formatUsd(totalEarned)})`}
          </button>
        </div>
      )}

      {/* Position list */}
      <div className="space-y-2">
        {positions.map((pos) => {
          const isOpen = expanded === pos.investmentId;
          return (
            <div key={pos.investmentId} className="border border-white/[0.06] rounded-lg overflow-hidden">
              {/* Collapsed row */}
              <button
                onClick={() => setExpanded(isOpen ? null : pos.investmentId)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/[0.02] transition-colors cursor-pointer text-left"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-semibold text-[#fafafa]">{pos.name}</span>
                  <TypeBadge type={pos.productType} />
                  <StatusBadge status={pos.status} />
                </div>
                <div className="flex items-center gap-6 text-xs font-mono">
                  <span className="text-[#fafafa]">{formatUsd(pos.value)}</span>
                  <span className="text-[#34d399]">+{formatUsd(pos.earned)}</span>
                  <span className="text-[#52525b]">{isOpen ? "▲" : "▼"}</span>
                </div>
              </button>

              {/* Expanded content */}
              {isOpen && (
                <div className="px-4 pb-4 pt-1 border-t border-white/[0.04] space-y-3">
                  {/* Range bar for LP */}
                  {pos.lower && pos.upper && pos.current && (
                    <div>
                      <div className="text-[10px] font-mono text-[#52525b] mb-1">
                        Range: {pos.lower.toFixed(4)} — {pos.upper.toFixed(4)}
                      </div>
                      <RangeBar lower={pos.lower} upper={pos.upper} current={pos.current} />
                    </div>
                  )}

                  {/* Details */}
                  <div className="flex gap-6 text-[11px] font-mono">
                    <div>
                      <span className="text-[#52525b]">Platform </span>
                      <span className="text-[#a1a1aa]">{pos.platform}</span>
                    </div>
                    <div>
                      <span className="text-[#52525b]">APY </span>
                      <span className="text-emerald-400">{pos.apy.toFixed(2)}%</span>
                    </div>
                    {pos.openedAt && (
                      <div>
                        <span className="text-[#52525b]">Opened </span>
                        <span className="text-[#a1a1aa]">{pos.openedAt}</span>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    {pos.earned > 0 && (
                      <button
                        onClick={() => collectMutation.mutate()}
                        disabled={collectMutation.isPending}
                        className="px-3 py-1.5 rounded text-[10px] font-semibold bg-[#34d399]/10 text-[#34d399] border border-[#34d399]/20 hover:bg-[#34d399]/20 transition-colors cursor-pointer disabled:opacity-50"
                      >
                        Collect {formatUsd(pos.earned)}
                      </button>
                    )}
                    <button
                      onClick={() => exitMutation.mutate({ id: pos.investmentId, ratio: 1 })}
                      disabled={exitMutation.isPending}
                      className="px-3 py-1.5 rounded text-[10px] font-semibold bg-white/[0.04] text-[#a1a1aa] border border-white/[0.06] hover:text-[#fafafa] transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {exitMutation.isPending ? "Exiting..." : "Exit Position"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color?: string }): React.ReactNode {
  return (
    <div className="border border-white/[0.06] rounded-lg px-4 py-3">
      <div className="text-[10px] font-medium text-[#52525b] uppercase tracking-wider">{label}</div>
      <div className="text-sm font-mono font-semibold mt-1" style={{ color: color ?? "#fafafa" }}>{value}</div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/pavelmackevic/Projects/agentra
git add web/src/components/defi-positions.tsx
git commit -m "feat(defi): add My Positions tab with summary cards and expandable list"
```

---

### Task 9: Yield Calculator tab — interactive chart + results

**Files:**
- Create: `web/src/components/yield-chart.tsx`
- Create: `web/src/components/yield-calculator.tsx`

- [ ] **Step 1: Create YieldChart SVG component**

```typescript
// web/src/components/yield-chart.tsx
"use client";

const COLORS = ["#34d399", "#06b6d4", "#a855f7", "#f59e0b", "#ef4444"];

interface YieldChartProps {
  lines: { name: string; apy: number }[];
  amount: number;
  days: number;
}

export function YieldChart({ lines, amount, days }: YieldChartProps): React.ReactNode {
  if (lines.length === 0 || amount <= 0) return null;

  const WIDTH = 600;
  const HEIGHT = 200;
  const PAD = { top: 20, right: 20, bottom: 30, left: 60 };
  const plotW = WIDTH - PAD.left - PAD.right;
  const plotH = HEIGHT - PAD.top - PAD.bottom;

  // Calculate max value for Y axis
  const maxVal = Math.max(
    ...lines.map((l) => amount * Math.pow(1 + l.apy / 100 / 365, days)),
  );
  const minVal = amount;
  const yRange = maxVal - minVal || 1;

  // Generate points for each line
  const paths = lines.slice(0, 5).map((line, idx) => {
    const points: string[] = [];
    const steps = Math.min(days, 60);
    for (let i = 0; i <= steps; i++) {
      const d = (i / steps) * days;
      const val = amount * Math.pow(1 + line.apy / 100 / 365, d);
      const x = PAD.left + (i / steps) * plotW;
      const y = PAD.top + plotH - ((val - minVal) / yRange) * plotH;
      points.push(`${x},${y}`);
    }
    return { name: line.name, color: COLORS[idx % COLORS.length], points: points.join(" ") };
  });

  // Y axis labels
  const yLabels = [0, 0.25, 0.5, 0.75, 1].map((pct) => ({
    value: minVal + yRange * pct,
    y: PAD.top + plotH - pct * plotH,
  }));

  // X axis labels
  const xLabels = [0, 0.25, 0.5, 0.75, 1].map((pct) => ({
    day: Math.round(days * pct),
    x: PAD.left + pct * plotW,
  }));

  return (
    <div>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full h-auto">
        {/* Grid lines */}
        {yLabels.map((yl, i) => (
          <line key={i} x1={PAD.left} y1={yl.y} x2={WIDTH - PAD.right} y2={yl.y} stroke="rgba(255,255,255,0.04)" />
        ))}

        {/* Y labels */}
        {yLabels.map((yl, i) => (
          <text key={i} x={PAD.left - 8} y={yl.y + 3} textAnchor="end" fill="#52525b" fontSize="9" fontFamily="monospace">
            ${yl.value >= 1000 ? `${(yl.value / 1000).toFixed(1)}K` : yl.value.toFixed(0)}
          </text>
        ))}

        {/* X labels */}
        {xLabels.map((xl, i) => (
          <text key={i} x={xl.x} y={HEIGHT - 8} textAnchor="middle" fill="#52525b" fontSize="9" fontFamily="monospace">
            {xl.day}d
          </text>
        ))}

        {/* Lines with gradient fill */}
        {paths.map((path, idx) => (
          <g key={idx}>
            <defs>
              <linearGradient id={`grad-${idx}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={path.color} stopOpacity="0.15" />
                <stop offset="100%" stopColor={path.color} stopOpacity="0" />
              </linearGradient>
            </defs>
            <polygon
              points={`${path.points} ${PAD.left + plotW},${PAD.top + plotH} ${PAD.left},${PAD.top + plotH}`}
              fill={`url(#grad-${idx})`}
            />
            <polyline
              points={path.points}
              fill="none"
              stroke={path.color}
              strokeWidth="1.5"
            />
          </g>
        ))}
      </svg>

      {/* Legend */}
      <div className="flex gap-4 mt-2 flex-wrap">
        {paths.map((path, idx) => (
          <div key={idx} className="flex items-center gap-1.5 text-[10px] font-mono">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: path.color }} />
            <span className="text-[#a1a1aa]">{path.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create YieldCalculator component**

```typescript
// web/src/components/yield-calculator.tsx
"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { fetchDefiProducts, fetchYields, formatUsd, STALE_NORMAL, REFETCH_SLOW } from "../lib/api";
import { TypeBadge } from "./type-badge";
import { YieldChart } from "./yield-chart";

type Period = "7" | "30" | "90" | "365";
const PERIODS: { key: Period; label: string }[] = [
  { key: "7", label: "7d" },
  { key: "30", label: "30d" },
  { key: "90", label: "90d" },
  { key: "365", label: "1y" },
];

interface Pool {
  investmentId: string;
  name: string;
  platform: string;
  apy: number;
  productType: string;
}

export function YieldCalculator(): React.ReactNode {
  const router = useRouter();
  const [amountStr, setAmountStr] = useState("1000");
  const [period, setPeriod] = useState<Period>("30");
  const amount = Number(amountStr) || 0;
  const days = Number(period);

  const { data: productsData, isLoading } = useQuery({
    queryKey: ["defi-products"],
    queryFn: () => fetchDefiProducts(),
    staleTime: STALE_NORMAL,
    refetchInterval: REFETCH_SLOW,
  });

  const { data: yieldsData } = useQuery({
    queryKey: ["yields"],
    queryFn: () => fetchYields(),
    staleTime: STALE_NORMAL,
    refetchInterval: REFETCH_SLOW,
  });

  const pools = useMemo((): Pool[] => {
    const raw = productsData as Record<string, unknown> | null;
    const dataObj = raw?.data as Record<string, unknown> | undefined;
    const list = dataObj?.list ?? raw?.list ?? raw?.products;
    const products = Array.isArray(list) ? (list as Record<string, unknown>[]) : [];

    const mapped: Pool[] = products.map((p) => ({
      investmentId: String(p.investmentId ?? p.id ?? ""),
      name: String(p.name ?? p.poolName ?? ""),
      platform: String(p.platformName ?? p.platform ?? p.protocol ?? ""),
      apy: Number(p.rate ?? p.apy ?? p.apr ?? 0) * (Number(p.rate ?? 0) < 1 ? 100 : 1),
      productType: String(p.investType ?? p.productGroup ?? "DEX_POOL"),
    }));

    const yieldsArr = (yieldsData as Record<string, unknown>)?.pools as Record<string, unknown>[] | undefined;
    if (yieldsArr) {
      for (const y of yieldsArr) {
        const id = String(y.investmentId ?? y.pool ?? "");
        if (!mapped.some((p) => p.investmentId === id)) {
          mapped.push({
            investmentId: id,
            name: String(y.name ?? y.symbol ?? ""),
            platform: String(y.project ?? y.platform ?? ""),
            apy: Number(y.apy ?? y.apyBase ?? 0),
            productType: "DEX_POOL",
          });
        }
      }
    }

    mapped.sort((a, b) => b.apy - a.apy);
    return mapped.slice(0, 10);
  }, [productsData, yieldsData]);

  const results = useMemo(() => {
    return pools.map((pool) => {
      const finalValue = amount * Math.pow(1 + pool.apy / 100 / 365, days);
      const returnAmt = finalValue - amount;
      return { ...pool, finalValue, returnAmt };
    });
  }, [pools, amount, days]);

  const chartLines = pools.slice(0, 5).map((p) => ({ name: p.name, apy: p.apy }));

  return (
    <div>
      {/* Inputs */}
      <div className="flex items-end gap-4 mb-6 flex-wrap">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-[11px] text-[#52525b] font-mono mb-1">Amount (USD)</label>
          <input
            type="text"
            inputMode="decimal"
            placeholder="1000"
            value={amountStr}
            onChange={(e) => setAmountStr(e.target.value)}
            className="w-full bg-white/[0.04] border border-white/[0.06] rounded px-3 py-2 text-sm font-mono text-[#fafafa] placeholder:text-[#52525b] outline-none focus:border-[#06b6d4]/40"
          />
        </div>
        <div className="flex gap-1.5">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={`px-3 py-2 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                period === p.key
                  ? "bg-[#06b6d4]/10 text-[#06b6d4] border border-[#06b6d4]/20"
                  : "bg-white/[0.04] text-[#a1a1aa] border border-white/[0.06] hover:text-[#fafafa]"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      {amount > 0 && chartLines.length > 0 && (
        <div className="border border-white/[0.06] rounded-lg p-4 mb-6">
          <YieldChart lines={chartLines} amount={amount} days={days} />
        </div>
      )}

      {/* Results table */}
      {isLoading ? (
        <div className="py-12 text-center text-xs font-mono text-[#52525b]">Loading yield data...</div>
      ) : results.length === 0 ? (
        <div className="py-12 text-center text-xs font-mono text-[#52525b]">No yield data available</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="text-left border-b border-white/[0.06]">
                <th className="pb-2 font-medium text-[10px] text-[#52525b] uppercase tracking-wider">Pool</th>
                <th className="pb-2 font-medium text-[10px] text-[#52525b] uppercase tracking-wider">Protocol</th>
                <th className="pb-2 font-medium text-[10px] text-[#52525b] uppercase tracking-wider text-right">APY</th>
                <th className="pb-2 font-medium text-[10px] text-[#52525b] uppercase tracking-wider text-right">Return ({PERIODS.find((p) => p.key === period)?.label})</th>
                <th className="pb-2 font-medium text-[10px] text-[#52525b] uppercase tracking-wider text-right">Final Value</th>
                <th className="pb-2 font-medium text-[10px] text-[#52525b] uppercase tracking-wider text-right">Risk</th>
                <th className="pb-2 font-medium text-[10px] text-[#52525b] uppercase tracking-wider text-right" />
              </tr>
            </thead>
            <tbody>
              {results.map((r) => (
                <tr key={r.investmentId} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                  <td className="py-2.5 pr-4 text-[#fafafa]">{r.name}</td>
                  <td className="py-2.5 pr-4 text-[#a1a1aa]">{r.platform}</td>
                  <td className="py-2.5 pr-4 text-right text-emerald-400">{r.apy.toFixed(2)}%</td>
                  <td className="py-2.5 pr-4 text-right text-emerald-400">+{formatUsd(r.returnAmt)}</td>
                  <td className="py-2.5 pr-4 text-right text-[#fafafa]">{formatUsd(r.finalValue)}</td>
                  <td className="py-2.5 pr-4 text-right">
                    {r.productType === "DEX_POOL" ? (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-medium text-[#f59e0b] bg-[#f59e0b]/10">IL Risk</span>
                    ) : (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-medium text-[#34d399] bg-[#34d399]/10">Low</span>
                    )}
                  </td>
                  <td className="py-2.5 text-right">
                    <button
                      onClick={() => router.push(`/defi/deposit/${r.investmentId}`)}
                      className="text-[10px] font-semibold text-[#06b6d4] hover:text-[#06b6d4]/80 transition-colors cursor-pointer"
                    >
                      Deposit →
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
cd /Users/pavelmackevic/Projects/agentra
git add web/src/components/yield-chart.tsx web/src/components/yield-calculator.tsx
git commit -m "feat(defi): add Yield Calculator with interactive SVG chart and results table"
```

---

### Task 10: Cleanup — remove old DeFi components, verify build

**Files:**
- Delete: `web/src/components/defi-products.tsx` (replaced by defi-explore.tsx)
- Delete: `web/src/components/defi-deposit-modal.tsx` (replaced by deposit page)

- [ ] **Step 1: Remove old components**

Delete `defi-products.tsx` and `defi-deposit-modal.tsx` — they are no longer imported anywhere after Trade page simplification in Task 3.

- [ ] **Step 2: Verify no stale imports**

Run: `cd /Users/pavelmackevic/Projects/agentra/web && grep -r "defi-products\|defi-deposit-modal\|DefiProducts\|DefiDepositModal\|trade-tabs\|TradeTabs" src/ --include="*.tsx" --include="*.ts"`

Expected: no matches (all references were removed in Tasks 3 and 6).

- [ ] **Step 3: Run build**

Run: `cd /Users/pavelmackevic/Projects/agentra/web && npx next build 2>&1 | tail -30`

Expected: build succeeds. If there are errors, fix them before committing.

- [ ] **Step 4: Commit**

```bash
cd /Users/pavelmackevic/Projects/agentra
git rm web/src/components/defi-products.tsx web/src/components/defi-deposit-modal.tsx
git commit -m "refactor(defi): remove old DeFi components replaced by new section"
```

---

### Task 11: Polish — responsive, empty states, number formatting

**Files:**
- Modify: `web/src/components/defi-explore.tsx`
- Modify: `web/src/components/defi-positions.tsx`
- Modify: `web/src/components/yield-calculator.tsx`

This task adds finishing touches across all new components.

- [ ] **Step 1: Add responsive table classes to DefiExplore**

In `defi-explore.tsx`, add `hidden md:table-cell` to Protocol and Type columns for mobile:

Change the `<th>` for Protocol:
```typescript
<th className={`${thClass} hidden md:table-cell`}>Protocol</th>
```

Change the `<th>` for Type:
```typescript
<th className={`${thClass} hidden sm:table-cell`}>Type</th>
```

And matching `<td>` cells:
```typescript
<td className="py-2.5 pr-4 text-[#a1a1aa] hidden md:table-cell">{pool.platform}</td>
<td className="py-2.5 pr-4 hidden sm:table-cell">
```

- [ ] **Step 2: Add formatPercent helper to api.ts**

In `web/src/lib/api.ts`, add after `formatUsd`:

```typescript
export function formatPercent(v: number): string {
  if (v >= 1000) return `${(v / 1000).toFixed(1)}K%`;
  return `${v.toFixed(2)}%`;
}
```

- [ ] **Step 3: Commit**

```bash
cd /Users/pavelmackevic/Projects/agentra
git add web/src/components/defi-explore.tsx web/src/components/defi-positions.tsx web/src/components/yield-calculator.tsx web/src/lib/api.ts
git commit -m "style(defi): add responsive breakpoints and formatPercent helper"
```

---

### Task 12: Final verification

- [ ] **Step 1: Run full build**

Run: `cd /Users/pavelmackevic/Projects/agentra/web && npx next build 2>&1 | tail -30`

Expected: build succeeds with no errors.

- [ ] **Step 2: Verify all new routes exist**

Run: `ls -la /Users/pavelmackevic/Projects/agentra/web/src/app/defi/`

Expected: `page.tsx` and `deposit/[investmentId]/page.tsx`

- [ ] **Step 3: Verify server endpoints compile**

Run: `cd /Users/pavelmackevic/Projects/agentra/server && npx tsc --noEmit 2>&1 | tail -10`

Expected: no errors.

- [ ] **Step 4: Verify git is clean**

Run: `cd /Users/pavelmackevic/Projects/agentra && git status`

Expected: clean working tree, all changes committed.
