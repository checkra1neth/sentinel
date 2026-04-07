# Discover Tab + Token Profile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Discover screener page and Token Profile drill-down page, exposing all backend intelligence endpoints in Arkham/Nansen-style UI.

**Architecture:** Two new Next.js pages (`/discover` and `/token/[address]`) with 13 new components. Discover aggregates 4 API sources into a merged, filterable screener table with live WebSocket signal bar and leaderboard panel. Token Profile uses lazy-loaded sub-tabs (Overview, Holders, Traders, Security, Dev Intel) to show deep token analytics.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS v4, React Query, WebSocket (existing hook)

---

### Task 1: API Client Library

**Files:**
- Create: `web/src/lib/api.ts`

- [ ] **Step 1: Create the typed API fetch helpers**

```typescript
// web/src/lib/api.ts
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

export interface LeaderEntry {
  address: string;
  pnl: string;
  winRate?: string;
  tradeCount?: string;
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
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /Users/pavelmackevic/Projects/agentra/web && npx tsc --noEmit 2>&1 | head -20`
Expected: 0 errors (or only pre-existing ones)

- [ ] **Step 3: Commit**

```bash
cd /Users/pavelmackevic/Projects/agentra
git add web/src/lib/api.ts
git commit -m "feat(web): add typed API client for discover + token profile"
```

---

### Task 2: Signal Bar Component

**Files:**
- Create: `web/src/components/signal-bar.tsx`

- [ ] **Step 1: Create signal-bar.tsx**

```typescript
// web/src/components/signal-bar.tsx
"use client";

import { useAgentEvents } from "../lib/ws";
import { timeAgo } from "../lib/api";

const SIGNAL_COLORS: Record<string, string> = {
  whale: "#34d399",
  smart_money: "#a78bfa",
  kol: "#f59e0b",
  scanner: "#06b6d4",
  signal_smart_money: "#a78bfa",
  signal_kol: "#f59e0b",
  signal_whale: "#34d399",
};

function getSignalLabel(tracker: string): string {
  if (tracker.includes("whale")) return "whale";
  if (tracker.includes("smart")) return "smart money";
  if (tracker.includes("kol")) return "kol";
  return tracker;
}

export function SignalBar(): React.ReactNode {
  const { events, connected } = useAgentEvents();

  const signals = events
    .filter((e) => ["new-token", "verdict", "signal"].some((t) => e.type.includes(t)))
    .slice(-10)
    .reverse();

  return (
    <div className="border-b border-white/[0.06] py-1.5 font-mono text-[11px] text-[#52525b] overflow-hidden whitespace-nowrap flex items-center gap-1.5">
      <span
        className="inline-block w-[5px] h-[5px] rounded-full flex-shrink-0"
        style={{ background: connected ? "#34d399" : "#ef4444" }}
      />
      <span className="text-[10px] text-[#a1a1aa] uppercase tracking-wider mr-2">live</span>
      {signals.length === 0 && <span>Waiting for signals...</span>}
      {signals.map((evt, i) => (
        <span key={`${evt.timestamp}-${i}`}>
          {i > 0 && <span className="mx-3" style={{ color: "rgba(255,255,255,0.06)" }}>|</span>}
          <span style={{ color: SIGNAL_COLORS[String(evt.details?.tracker ?? "scanner")] ?? "#a1a1aa" }}>
            {getSignalLabel(String(evt.details?.tracker ?? evt.type))}
          </span>{" "}
          <span className="text-[#fafafa]">{String(evt.details?.tokenSymbol ?? evt.details?.token ?? "").slice(0, 10)}</span>{" "}
          <span>{evt.details?.amount ? `$${Number(evt.details.amount).toLocaleString()}` : ""}</span>
          <span className="ml-1">&mdash; {timeAgo(evt.timestamp)}</span>
        </span>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Verify compile**

Run: `cd /Users/pavelmackevic/Projects/agentra/web && npx tsc --noEmit 2>&1 | head -20`

- [ ] **Step 3: Commit**

```bash
git add web/src/components/signal-bar.tsx
git commit -m "feat(web): add live signal bar component"
```

---

### Task 3: Source Filters Component

**Files:**
- Create: `web/src/components/source-filters.tsx`

- [ ] **Step 1: Create source-filters.tsx**

```typescript
// web/src/components/source-filters.tsx
"use client";

import { useState, useEffect, useRef } from "react";

const SOURCES = ["All", "Whale", "Smart Money", "Trending", "Scanner", "KOL"] as const;
export type SourceFilter = (typeof SOURCES)[number];

interface SourceFiltersProps {
  active: SourceFilter;
  onFilterChange: (source: SourceFilter) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export function SourceFilters({
  active,
  onFilterChange,
  searchQuery,
  onSearchChange,
}: SourceFiltersProps): React.ReactNode {
  const [localQuery, setLocalQuery] = useState(searchQuery);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => onSearchChange(localQuery), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [localQuery, onSearchChange]);

  return (
    <div className="flex gap-1.5 py-3 items-center flex-wrap">
      {SOURCES.map((src) => (
        <button
          key={src}
          onClick={() => onFilterChange(src)}
          className={`px-2.5 py-1 text-[11px] font-medium rounded transition-colors cursor-pointer ${
            active === src
              ? "text-[#fafafa] bg-white/[0.06]"
              : "text-[#52525b] border border-white/[0.06] hover:text-[#a1a1aa] hover:border-white/[0.1]"
          }`}
        >
          {src}
        </button>
      ))}
      <input
        type="text"
        value={localQuery}
        onChange={(e) => setLocalQuery(e.target.value)}
        placeholder="Search token..."
        className="ml-auto px-2.5 py-1 text-[11px] font-mono text-[#fafafa] bg-transparent border border-white/[0.06] rounded outline-none w-[150px] placeholder:text-[#52525b] focus:border-[#06b6d4]/40 transition-colors"
      />
    </div>
  );
}
```

- [ ] **Step 2: Verify compile**

Run: `cd /Users/pavelmackevic/Projects/agentra/web && npx tsc --noEmit 2>&1 | head -20`

- [ ] **Step 3: Commit**

```bash
git add web/src/components/source-filters.tsx
git commit -m "feat(web): add source filter pills component"
```

---

### Task 4: Screener Table Component

**Files:**
- Create: `web/src/components/screener-table.tsx`

- [ ] **Step 1: Create screener-table.tsx**

```typescript
// web/src/components/screener-table.tsx
"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { type DiscoverToken, formatUsd, timeAgo, truncAddr } from "../lib/api";

type SortKey = "price" | "change" | "mcap" | "liq" | "vol" | "risk" | "smart" | "age";
type SortDir = "asc" | "desc";

const RISK_STYLE: Record<string, string> = {
  safe: "text-[#34d399] bg-[rgba(52,211,153,0.08)]",
  caution: "text-[#f59e0b] bg-[rgba(245,158,11,0.08)]",
  danger: "text-[#ef4444] bg-[rgba(239,68,68,0.08)]",
};

const SOURCE_COLOR: Record<string, string> = {
  WHALE: "text-[#34d399]",
  "SMART $": "text-[#a78bfa]",
  TRENDING: "text-[#f59e0b]",
  SCANNER: "text-[#06b6d4]",
  KOL: "text-[#f59e0b]",
};

function riskLevel(score: number): string {
  if (score <= 35) return "safe";
  if (score <= 65) return "caution";
  return "danger";
}

interface ScreenerTableProps {
  tokens: DiscoverToken[];
}

export function ScreenerTable({ tokens }: ScreenerTableProps): React.ReactNode {
  const router = useRouter();
  const [sortKey, setSortKey] = useState<SortKey>("age");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const toggleSort = (key: SortKey): void => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const sorted = useMemo(() => {
    const arr = [...tokens];
    const dir = sortDir === "asc" ? 1 : -1;
    arr.sort((a, b) => {
      switch (sortKey) {
        case "price": return ((a.priceUsd ?? 0) - (b.priceUsd ?? 0)) * dir;
        case "change": return ((a.priceChange24h ?? 0) - (b.priceChange24h ?? 0)) * dir;
        case "mcap": return ((a.marketCap ?? 0) - (b.marketCap ?? 0)) * dir;
        case "liq": return ((a.liquidityUsd ?? 0) - (b.liquidityUsd ?? 0)) * dir;
        case "vol": return ((a.volume24h ?? 0) - (b.volume24h ?? 0)) * dir;
        case "risk": return ((a.riskScore ?? 999) - (b.riskScore ?? 999)) * dir;
        case "smart": return ((a.smartMoneyCount ?? 0) - (b.smartMoneyCount ?? 0)) * dir;
        case "age": return (a.timestamp - b.timestamp) * dir;
        default: return 0;
      }
    });
    return arr;
  }, [tokens, sortKey, sortDir]);

  const thClass = "pb-2 font-medium text-[10px] text-[#52525b] uppercase tracking-wider cursor-pointer hover:text-[#a1a1aa] transition-colors select-none";

  return (
    <table className="w-full text-xs font-mono">
      <thead>
        <tr className="text-left border-b border-white/[0.06]">
          <th className={thClass}>Token</th>
          <th className={`${thClass} text-right`} onClick={() => toggleSort("price")}>Price</th>
          <th className={`${thClass} text-right`} onClick={() => toggleSort("change")}>24h</th>
          <th className={`${thClass} text-right hidden md:table-cell`} onClick={() => toggleSort("mcap")}>MCap</th>
          <th className={`${thClass} text-right hidden md:table-cell`} onClick={() => toggleSort("liq")}>Liquidity</th>
          <th className={`${thClass} text-right hidden sm:table-cell`} onClick={() => toggleSort("vol")}>Volume</th>
          <th className={`${thClass} text-right`} onClick={() => toggleSort("risk")}>Risk</th>
          <th className={`${thClass} text-center hidden sm:table-cell`} onClick={() => toggleSort("smart")}>Smart $</th>
          <th className={thClass}>Source</th>
          <th className={`${thClass} text-right`} onClick={() => toggleSort("age")}>Age</th>
        </tr>
      </thead>
      <tbody>
        {sorted.length === 0 && (
          <tr><td colSpan={10} className="py-8 text-center text-[#52525b]">No tokens discovered yet. Waiting for scanner...</td></tr>
        )}
        {sorted.map((t) => (
          <tr
            key={t.token}
            onClick={() => router.push(`/token/${t.token}`)}
            className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors cursor-pointer"
          >
            <td className="py-2">
              <div className="font-medium text-[#fafafa]">{t.tokenSymbol ?? "???"}</div>
              <div className="text-[10px] text-[#52525b]">{truncAddr(t.token)}</div>
            </td>
            <td className="py-2 text-right text-[#fafafa]">{t.priceUsd ? formatUsd(t.priceUsd) : "—"}</td>
            <td className={`py-2 text-right ${(t.priceChange24h ?? 0) >= 0 ? "text-[#34d399]" : "text-[#ef4444]"}`}>
              {t.priceChange24h != null ? `${t.priceChange24h >= 0 ? "+" : ""}${t.priceChange24h.toFixed(1)}%` : "—"}
            </td>
            <td className="py-2 text-right text-[#a1a1aa] hidden md:table-cell">{t.marketCap ? formatUsd(t.marketCap) : "—"}</td>
            <td className="py-2 text-right text-[#a1a1aa] hidden md:table-cell">{t.liquidityUsd ? formatUsd(t.liquidityUsd) : "—"}</td>
            <td className="py-2 text-right text-[#a1a1aa] hidden sm:table-cell">{t.volume24h ? formatUsd(t.volume24h) : "—"}</td>
            <td className="py-2 text-right">
              {t.riskScore != null ? (
                <span className={`inline-block px-1.5 py-px rounded text-[10px] font-medium ${RISK_STYLE[riskLevel(t.riskScore)]}`}>
                  {t.riskScore}
                </span>
              ) : (
                <span className="text-[#52525b]">&mdash;</span>
              )}
            </td>
            <td className="py-2 text-center text-[#06b6d4] hidden sm:table-cell">{t.smartMoneyCount ?? "—"}</td>
            <td className="py-2">
              <span className={`text-[9px] font-medium uppercase ${SOURCE_COLOR[t.source] ?? "text-[#52525b]"}`}>
                {t.source}
              </span>
            </td>
            <td className="py-2 text-right text-[#52525b] text-[11px]">{timeAgo(t.timestamp)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

- [ ] **Step 2: Verify compile**

Run: `cd /Users/pavelmackevic/Projects/agentra/web && npx tsc --noEmit 2>&1 | head -20`

- [ ] **Step 3: Commit**

```bash
git add web/src/components/screener-table.tsx
git commit -m "feat(web): add screener table with sortable columns"
```

---

### Task 5: Leaderboard Panel Component

**Files:**
- Create: `web/src/components/leaderboard-panel.tsx`

- [ ] **Step 1: Create leaderboard-panel.tsx**

```typescript
// web/src/components/leaderboard-panel.tsx
"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchLeaderboard, truncAddr } from "../lib/api";

export function LeaderboardPanel(): React.ReactNode {
  const { data } = useQuery({
    queryKey: ["leaderboard"],
    queryFn: fetchLeaderboard,
    refetchInterval: 30_000,
  });

  const leaders = Array.isArray(data?.data) ? (data.data as Record<string, unknown>[]).slice(0, 4) : [];

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between py-3 border-t border-white/[0.06]">
        <span className="text-[10px] font-medium text-[#52525b] uppercase tracking-wider">Top Traders — 7d</span>
        <span className="text-[10px] text-[#a1a1aa] cursor-pointer hover:text-[#fafafa] transition-colors">
          View all &rarr;
        </span>
      </div>
      {leaders.length === 0 ? (
        <p className="text-xs text-[#52525b] font-mono">No leaderboard data.</p>
      ) : (
        <div className="flex font-mono text-[11px]">
          {leaders.map((l, i) => (
            <div
              key={i}
              className={`flex-1 py-2 ${i < leaders.length - 1 ? "border-r border-white/[0.04]" : ""}`}
            >
              <div className="text-[10px] text-[#52525b]">{truncAddr(String(l.address ?? l.walletAddress ?? ""))}</div>
              <div className="text-[#34d399] font-medium">
                {l.pnl ?? l.realizedPnlUsd ? `+$${Number(l.pnl ?? l.realizedPnlUsd).toLocaleString()}` : "—"}
              </div>
              <div className="text-[9px] text-[#52525b] mt-0.5">
                {l.winRate ? `${l.winRate}% win` : ""}{l.tradeCount ? ` · ${l.tradeCount} trades` : ""}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify compile**

Run: `cd /Users/pavelmackevic/Projects/agentra/web && npx tsc --noEmit 2>&1 | head -20`

- [ ] **Step 3: Commit**

```bash
git add web/src/components/leaderboard-panel.tsx
git commit -m "feat(web): add leaderboard panel component"
```

---

### Task 6: Discover Page (assembles components)

**Files:**
- Create: `web/src/app/discover/page.tsx`
- Modify: `web/src/components/nav-links.tsx`
- Modify: `web/src/app/page.tsx`
- Modify: `web/src/app/feed/page.tsx`

- [ ] **Step 1: Create discover/page.tsx**

```typescript
// web/src/app/discover/page.tsx
"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { SignalBar } from "../../components/signal-bar";
import { SourceFilters, type SourceFilter } from "../../components/source-filters";
import { ScreenerTable } from "../../components/screener-table";
import { LeaderboardPanel } from "../../components/leaderboard-panel";
import {
  type DiscoverToken,
  fetchDiscoverFeed,
  fetchWhaleSignals,
  fetchTrending,
  fetchVerdicts,
} from "../../lib/api";

function mapSource(tracker: string): DiscoverToken["source"] {
  const t = tracker.toLowerCase();
  if (t.includes("whale")) return "WHALE";
  if (t.includes("smart")) return "SMART $";
  if (t.includes("kol")) return "KOL";
  return "SCANNER";
}

function matchesFilter(token: DiscoverToken, filter: SourceFilter): boolean {
  if (filter === "All") return true;
  const map: Record<string, DiscoverToken["source"]> = {
    Whale: "WHALE",
    "Smart Money": "SMART $",
    Trending: "TRENDING",
    Scanner: "SCANNER",
    KOL: "KOL",
  };
  return token.source === map[filter];
}

function matchesSearch(token: DiscoverToken, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  return (
    token.token.toLowerCase().includes(q) ||
    (token.tokenSymbol ?? "").toLowerCase().includes(q) ||
    (token.tokenName ?? "").toLowerCase().includes(q)
  );
}

export default function DiscoverPage(): React.ReactNode {
  const [filter, setFilter] = useState<SourceFilter>("All");
  const [search, setSearch] = useState("");

  const { data: scannerTokens } = useQuery({
    queryKey: ["discover-feed"],
    queryFn: fetchDiscoverFeed,
    refetchInterval: 15_000,
  });

  const { data: whaleSignals } = useQuery({
    queryKey: ["discover-whales"],
    queryFn: fetchWhaleSignals,
    refetchInterval: 15_000,
  });

  const { data: trending } = useQuery({
    queryKey: ["discover-trending"],
    queryFn: fetchTrending,
    refetchInterval: 30_000,
  });

  const { data: verdicts } = useQuery({
    queryKey: ["verdicts"],
    queryFn: () => fetchVerdicts(50),
    refetchInterval: 15_000,
  });

  const mergedTokens = useMemo((): DiscoverToken[] => {
    const byAddr = new Map<string, DiscoverToken>();

    // Scanner feed
    for (const t of scannerTokens ?? []) {
      const addr = String(t.token ?? t.address ?? t.tokenContractAddress ?? "").toLowerCase();
      if (!addr) continue;
      byAddr.set(addr, {
        token: addr,
        tokenSymbol: String(t.tokenSymbol ?? t.symbol ?? ""),
        tokenName: String(t.tokenName ?? t.name ?? ""),
        priceUsd: Number(t.priceUsd ?? t.price ?? 0) || undefined,
        marketCap: Number(t.marketCap ?? 0) || undefined,
        liquidityUsd: Number(t.liquidityUsd ?? t.liquidity ?? 0) || undefined,
        volume24h: Number(t.volume24h ?? t.volume ?? 0) || undefined,
        source: "SCANNER",
        timestamp: Number(t.timestamp ?? Date.now()),
      });
    }

    // Whale/Smart Money/KOL signals
    for (const s of whaleSignals ?? []) {
      const addr = String(s.tokenContractAddress ?? s.token ?? s.address ?? "").toLowerCase();
      if (!addr) continue;
      const existing = byAddr.get(addr);
      const ts = Number(s.timestamp ?? s.blockTimestamp ?? Date.now());
      if (!existing || ts > existing.timestamp) {
        byAddr.set(addr, {
          ...(existing ?? {}),
          token: addr,
          tokenSymbol: String(s.tokenSymbol ?? s.symbol ?? existing?.tokenSymbol ?? ""),
          tokenName: String(s.tokenName ?? existing?.tokenName ?? ""),
          priceUsd: Number(s.price ?? s.priceUsd ?? existing?.priceUsd ?? 0) || undefined,
          source: mapSource(String(s.tracker ?? "")),
          timestamp: ts,
        });
      }
    }

    // Trending
    for (const t of trending ?? []) {
      const addr = String(t.tokenAddress ?? t.address ?? "").toLowerCase();
      if (!addr) continue;
      if (!byAddr.has(addr)) {
        byAddr.set(addr, {
          token: addr,
          tokenSymbol: String(t.symbol ?? t.tokenSymbol ?? ""),
          source: "TRENDING",
          timestamp: Date.now(),
        });
      }
    }

    // Enrich with verdicts
    const verdictMap = new Map<string, (typeof verdicts extends (infer U)[] ? U : never)>();
    for (const v of verdicts ?? []) {
      verdictMap.set(v.token.toLowerCase(), v);
    }

    for (const [addr, token] of byAddr) {
      const v = verdictMap.get(addr);
      if (v) {
        token.riskScore = v.riskScore;
        token.verdict = v.verdict;
        token.priceUsd = token.priceUsd ?? v.priceUsd;
        token.marketCap = token.marketCap ?? v.marketCap;
        token.liquidityUsd = token.liquidityUsd ?? v.liquidityUsd;
        token.tokenSymbol = token.tokenSymbol || v.tokenSymbol;
        token.tokenName = token.tokenName || v.tokenName;
        token.priceChange24h = token.priceChange24h ?? v.priceChange24H;
        token.volume24h = token.volume24h ?? v.volume24H;
      }
    }

    return Array.from(byAddr.values());
  }, [scannerTokens, whaleSignals, trending, verdicts]);

  const filtered = useMemo(
    () => mergedTokens.filter((t) => matchesFilter(t, filter) && matchesSearch(t, search)),
    [mergedTokens, filter, search],
  );

  const handleSearchChange = useCallback((q: string) => setSearch(q), []);

  return (
    <div className="mx-auto max-w-[1400px] px-6 lg:px-10">
      <SignalBar />
      <SourceFilters
        active={filter}
        onFilterChange={setFilter}
        searchQuery={search}
        onSearchChange={handleSearchChange}
      />
      <ScreenerTable tokens={filtered} />
      <LeaderboardPanel />
    </div>
  );
}
```

- [ ] **Step 2: Update nav-links.tsx — replace Feed with Discover**

In `web/src/components/nav-links.tsx`, change the LINKS array:

```typescript
const LINKS = [
  { href: "/discover", label: "Discover" },
  { href: "/portfolio", label: "Portfolio" },
  { href: "/agents", label: "Agents" },
];
```

- [ ] **Step 3: Update home page CTA — /feed → /discover**

In `web/src/app/page.tsx`, change the Link href from `/feed` to `/discover`:

```typescript
          <Link
            href="/discover"
            className="inline-block text-sm font-medium text-[#09090b] bg-[#06b6d4] px-6 py-2.5 rounded hover:opacity-90 transition-opacity"
          >
            Open Dashboard
          </Link>
```

- [ ] **Step 4: Add redirect in feed/page.tsx**

Replace the entire content of `web/src/app/feed/page.tsx`:

```typescript
import { redirect } from "next/navigation";

export default function FeedPage(): never {
  redirect("/discover");
}
```

- [ ] **Step 5: Verify compile**

Run: `cd /Users/pavelmackevic/Projects/agentra/web && npx tsc --noEmit 2>&1 | head -20`

- [ ] **Step 6: Commit**

```bash
git add web/src/app/discover/page.tsx web/src/components/nav-links.tsx web/src/app/page.tsx web/src/app/feed/page.tsx
git commit -m "feat(web): add Discover page with screener, signals, leaderboard"
```

---

### Task 7: Token Hero Component

**Files:**
- Create: `web/src/components/token-hero.tsx`

- [ ] **Step 1: Create token-hero.tsx**

```typescript
// web/src/components/token-hero.tsx
"use client";

import { formatUsd } from "../lib/api";

const VERDICT_STYLE: Record<string, string> = {
  SAFE: "text-[#34d399] bg-[rgba(52,211,153,0.08)]",
  CAUTION: "text-[#f59e0b] bg-[rgba(245,158,11,0.08)]",
  DANGEROUS: "text-[#ef4444] bg-[rgba(239,68,68,0.08)]",
};

interface TokenHeroProps {
  address: string;
  name: string;
  symbol: string;
  verdict?: "SAFE" | "CAUTION" | "DANGEROUS";
  riskScore?: number;
  priceUsd?: number;
  priceChange24h?: number;
  marketCap?: number;
  liquidityUsd?: number;
  volume24h?: number;
  holdersCount?: number;
  smartMoneyCount?: number;
}

export function TokenHero(props: TokenHeroProps): React.ReactNode {
  const metrics = [
    {
      label: "Price",
      value: props.priceUsd ? (
        <>
          {formatUsd(props.priceUsd)}{" "}
          {props.priceChange24h != null && (
            <span className={`text-[11px] ${props.priceChange24h >= 0 ? "text-[#34d399]" : "text-[#ef4444]"}`}>
              {props.priceChange24h >= 0 ? "+" : ""}{props.priceChange24h.toFixed(1)}%
            </span>
          )}
        </>
      ) : "—",
    },
    { label: "Market Cap", value: props.marketCap ? formatUsd(props.marketCap) : "—" },
    { label: "Liquidity", value: props.liquidityUsd ? formatUsd(props.liquidityUsd) : "—" },
    { label: "Volume 24h", value: props.volume24h ? formatUsd(props.volume24h) : "—" },
    { label: "Holders", value: props.holdersCount?.toLocaleString() ?? "—" },
    { label: "Smart Money", value: props.smartMoneyCount != null ? String(props.smartMoneyCount) : "—", cyan: true },
  ];

  return (
    <div className="py-4 border-b border-white/[0.06]">
      <div className="flex items-baseline gap-3 mb-1.5 flex-wrap">
        <span className="text-xl font-semibold">{props.name || props.symbol || "Unknown"}</span>
        <span className="text-sm text-[#a1a1aa] font-medium">{props.symbol}</span>
        {props.verdict && props.riskScore != null && (
          <span className={`px-2 py-px rounded text-[11px] font-mono font-medium ${VERDICT_STYLE[props.verdict] ?? ""}`}>
            {props.verdict} {props.riskScore}
          </span>
        )}
      </div>
      <div className="text-[11px] text-[#52525b] font-mono mb-3">
        {props.address} &bull; X Layer
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-2">
        {metrics.map((m) => (
          <div key={m.label}>
            <div className="text-[10px] text-[#52525b] uppercase tracking-wider mb-0.5">{m.label}</div>
            <div className={`font-mono text-xs ${m.cyan ? "text-[#06b6d4]" : "text-[#fafafa]"}`}>{m.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify compile**

Run: `cd /Users/pavelmackevic/Projects/agentra/web && npx tsc --noEmit 2>&1 | head -20`

- [ ] **Step 3: Commit**

```bash
git add web/src/components/token-hero.tsx
git commit -m "feat(web): add token hero component"
```

---

### Task 8: Token Tab Components (Overview, Holders, Traders, Security, Dev Intel)

**Files:**
- Create: `web/src/components/token-tabs.tsx`
- Create: `web/src/components/tab-overview.tsx`
- Create: `web/src/components/tab-holders.tsx`
- Create: `web/src/components/tab-traders.tsx`
- Create: `web/src/components/tab-security.tsx`
- Create: `web/src/components/tab-dev-intel.tsx`

- [ ] **Step 1: Create token-tabs.tsx**

```typescript
// web/src/components/token-tabs.tsx
"use client";

const TABS = ["Overview", "Holders", "Traders", "Security", "Dev Intel"] as const;
export type TokenTab = (typeof TABS)[number];

interface TokenTabsProps {
  active: TokenTab;
  onChange: (tab: TokenTab) => void;
}

export function TokenTabs({ active, onChange }: TokenTabsProps): React.ReactNode {
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

- [ ] **Step 2: Create tab-overview.tsx**

```typescript
// web/src/components/tab-overview.tsx
"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchTokenCluster, fetchTokenHolders, fetchTopTraders, truncAddr } from "../lib/api";
import { type Verdict } from "../lib/api";

const TAG_STYLE: Record<string, string> = {
  "3": "text-[#a78bfa] bg-[rgba(167,139,250,0.08)]",
  "4": "text-[#34d399] bg-[rgba(52,211,153,0.08)]",
  "1": "text-[#f59e0b] bg-[rgba(245,158,11,0.08)]",
};

function tagLabel(tag: string | number): string {
  const t = String(tag);
  if (t === "3") return "smart $";
  if (t === "4") return "whale";
  if (t === "1") return "kol";
  return "normal";
}

interface KVRowProps { label: string; value: React.ReactNode; }
function KVRow({ label, value }: KVRowProps): React.ReactNode {
  return (
    <div className="flex justify-between py-1 text-xs border-b border-white/[0.03]">
      <span className="text-[#52525b]">{label}</span>
      <span className="font-mono text-[#a1a1aa]">{value}</span>
    </div>
  );
}

interface TabOverviewProps {
  address: string;
  verdict: Verdict | null;
}

export function TabOverview({ address, verdict }: TabOverviewProps): React.ReactNode {
  const { data: clusterData } = useQuery({
    queryKey: ["cluster", address],
    queryFn: () => fetchTokenCluster(address),
  });

  const { data: holdersData } = useQuery({
    queryKey: ["holders", address],
    queryFn: () => fetchTokenHolders(address),
  });

  const { data: tradersData } = useQuery({
    queryKey: ["top-traders", address],
    queryFn: () => fetchTopTraders(address),
  });

  const cluster = (clusterData?.data ?? clusterData) as Record<string, unknown> | undefined;
  const holders = Array.isArray(holdersData?.data) ? (holdersData.data as Record<string, unknown>[]).slice(0, 5) : [];
  const traders = Array.isArray(tradersData?.data) ? (tradersData.data as Record<string, unknown>[]).slice(0, 3) : [];

  const riskPct = verdict?.riskScore ?? 0;
  const riskColor = riskPct <= 35 ? "#34d399" : riskPct <= 65 ? "#f59e0b" : "#ef4444";

  return (
    <div className="py-5 grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Left */}
      <div>
        <div className="mb-5">
          <div className="text-[10px] font-medium text-[#52525b] uppercase tracking-wider mb-2">Risk Breakdown</div>
          <div className="h-1 bg-white/[0.04] rounded-sm mb-1 relative">
            <div className="h-1 rounded-sm absolute top-0 left-0" style={{ width: `${riskPct}%`, background: riskColor }} />
          </div>
          <div className="text-[11px] text-[#52525b] font-mono mb-3">{riskPct} / 100</div>
          <KVRow label="Honeypot" value={<span className={verdict?.isHoneypot ? "text-[#ef4444]" : "text-[#34d399]"}>{verdict?.isHoneypot ? "Yes" : "No"}</span>} />
          <KVRow label="Mintable" value={<span className={verdict?.hasMint ? "text-[#ef4444]" : "text-[#34d399]"}>{verdict?.hasMint ? "Yes" : "No"}</span>} />
          <KVRow label="Proxy" value={verdict?.isProxy ? "Yes" : "No"} />
          <KVRow label="Buy Tax" value={`${verdict?.buyTax ?? 0}%`} />
          <KVRow label="Sell Tax" value={`${verdict?.sellTax ?? 0}%`} />
          <KVRow label="Holder Concentration" value={`${verdict?.holderConcentration ?? 0}%`} />
        </div>

        <div>
          <div className="text-[10px] font-medium text-[#52525b] uppercase tracking-wider mb-2">Cluster Analysis</div>
          <KVRow label="Rug Pull %" value={cluster?.rugPullPercent != null ? `${cluster.rugPullPercent}%` : "—"} />
          <KVRow label="New Address %" value={cluster?.holderNewAddressPercent != null ? `${cluster.holderNewAddressPercent}%` : "—"} />
          <KVRow label="Same Fund Source %" value={cluster?.holderSameFundSourcePercent != null ? `${cluster.holderSameFundSourcePercent}%` : "—"} />
        </div>
      </div>

      {/* Right */}
      <div>
        <div className="mb-5">
          <div className="text-[10px] font-medium text-[#52525b] uppercase tracking-wider mb-2">Top Holders</div>
          <table className="w-full text-[11px] font-mono">
            <thead>
              <tr className="text-[#52525b] text-left border-b border-white/[0.06]">
                <th className="pb-1.5 font-medium text-[10px] uppercase">Address</th>
                <th className="pb-1.5 font-medium text-[10px] uppercase">Tag</th>
                <th className="pb-1.5 font-medium text-[10px] uppercase text-right">Balance</th>
                <th className="pb-1.5 font-medium text-[10px] uppercase text-right">%</th>
              </tr>
            </thead>
            <tbody>
              {holders.map((h, i) => (
                <tr key={i} className="border-b border-white/[0.03]">
                  <td className="py-1.5 text-[#52525b]">{truncAddr(String(h.holderAddress ?? h.address ?? ""))}</td>
                  <td className="py-1.5">
                    <span className={`inline-block px-1 py-px rounded text-[9px] font-medium ${TAG_STYLE[String(h.tag ?? "")] ?? "text-[#52525b] bg-white/[0.04]"}`}>
                      {tagLabel(h.tag ?? "")}
                    </span>
                  </td>
                  <td className="py-1.5 text-right text-[#a1a1aa]">{h.amount ?? h.balance ?? "—"}</td>
                  <td className="py-1.5 text-right text-[#a1a1aa]">{h.valuePercent ?? h.percent ?? "—"}</td>
                </tr>
              ))}
              {holders.length === 0 && <tr><td colSpan={4} className="py-2 text-[#52525b]">No data</td></tr>}
            </tbody>
          </table>
        </div>

        <div>
          <div className="text-[10px] font-medium text-[#52525b] uppercase tracking-wider mb-2">Top Traders PnL</div>
          <table className="w-full text-[11px] font-mono">
            <thead>
              <tr className="text-[#52525b] text-left border-b border-white/[0.06]">
                <th className="pb-1.5 font-medium text-[10px] uppercase">Address</th>
                <th className="pb-1.5 font-medium text-[10px] uppercase">Tag</th>
                <th className="pb-1.5 font-medium text-[10px] uppercase text-right">PnL</th>
                <th className="pb-1.5 font-medium text-[10px] uppercase text-right">Trades</th>
              </tr>
            </thead>
            <tbody>
              {traders.map((t, i) => {
                const pnl = Number(t.pnl ?? t.profit ?? 0);
                return (
                  <tr key={i} className="border-b border-white/[0.03]">
                    <td className="py-1.5 text-[#52525b]">{truncAddr(String(t.traderAddress ?? t.address ?? ""))}</td>
                    <td className="py-1.5">
                      <span className={`inline-block px-1 py-px rounded text-[9px] font-medium ${TAG_STYLE[String(t.tag ?? "")] ?? "text-[#52525b] bg-white/[0.04]"}`}>
                        {tagLabel(t.tag ?? "")}
                      </span>
                    </td>
                    <td className={`py-1.5 text-right ${pnl >= 0 ? "text-[#34d399]" : "text-[#ef4444]"}`}>
                      {pnl >= 0 ? "+" : ""}${Math.abs(pnl).toLocaleString()}
                    </td>
                    <td className="py-1.5 text-right text-[#a1a1aa]">{t.tradeCount ?? t.txCount ?? "—"}</td>
                  </tr>
                );
              })}
              {traders.length === 0 && <tr><td colSpan={4} className="py-2 text-[#52525b]">No data</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create tab-holders.tsx**

```typescript
// web/src/components/tab-holders.tsx
"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchTokenHolders, fetchClusterHolders, truncAddr } from "../lib/api";

const TAG_STYLE: Record<string, string> = {
  "3": "text-[#a78bfa] bg-[rgba(167,139,250,0.08)]",
  "4": "text-[#34d399] bg-[rgba(52,211,153,0.08)]",
  "1": "text-[#f59e0b] bg-[rgba(245,158,11,0.08)]",
};

function tagLabel(tag: string | number): string {
  const t = String(tag);
  if (t === "3") return "smart $";
  if (t === "4") return "whale";
  if (t === "1") return "kol";
  return "normal";
}

export function TabHolders({ address }: { address: string }): React.ReactNode {
  const { data: holdersData } = useQuery({
    queryKey: ["holders-full", address],
    queryFn: () => fetchTokenHolders(address),
  });

  const { data: clusterData } = useQuery({
    queryKey: ["cluster-holders", address],
    queryFn: () => fetchClusterHolders(address),
  });

  const holders = Array.isArray(holdersData?.data) ? (holdersData.data as Record<string, unknown>[]) : [];
  const clusterHolders = Array.isArray(clusterData?.data) ? (clusterData.data as Record<string, unknown>[]) : [];

  return (
    <div className="py-5">
      <div className="text-[10px] font-medium text-[#52525b] uppercase tracking-wider mb-2">
        All Holders ({holders.length})
      </div>
      <table className="w-full text-[11px] font-mono">
        <thead>
          <tr className="text-[#52525b] text-left border-b border-white/[0.06]">
            <th className="pb-1.5 font-medium text-[10px] uppercase">#</th>
            <th className="pb-1.5 font-medium text-[10px] uppercase">Address</th>
            <th className="pb-1.5 font-medium text-[10px] uppercase">Tag</th>
            <th className="pb-1.5 font-medium text-[10px] uppercase text-right">Balance</th>
            <th className="pb-1.5 font-medium text-[10px] uppercase text-right">%</th>
          </tr>
        </thead>
        <tbody>
          {holders.map((h, i) => (
            <tr key={i} className="border-b border-white/[0.03]">
              <td className="py-1.5 text-[#52525b]">{i + 1}</td>
              <td className="py-1.5 text-[#52525b]">{truncAddr(String(h.holderAddress ?? h.address ?? ""))}</td>
              <td className="py-1.5">
                <span className={`inline-block px-1 py-px rounded text-[9px] font-medium ${TAG_STYLE[String(h.tag ?? "")] ?? "text-[#52525b] bg-white/[0.04]"}`}>
                  {tagLabel(h.tag ?? "")}
                </span>
              </td>
              <td className="py-1.5 text-right text-[#a1a1aa]">{h.amount ?? h.balance ?? "—"}</td>
              <td className="py-1.5 text-right text-[#a1a1aa]">{h.valuePercent ?? h.percent ?? "—"}</td>
            </tr>
          ))}
          {holders.length === 0 && <tr><td colSpan={5} className="py-4 text-[#52525b]">No holder data available.</td></tr>}
        </tbody>
      </table>

      {clusterHolders.length > 0 && (
        <div className="mt-6">
          <div className="text-[10px] font-medium text-[#52525b] uppercase tracking-wider mb-2">
            Cluster Top Holders
          </div>
          <table className="w-full text-[11px] font-mono">
            <thead>
              <tr className="text-[#52525b] text-left border-b border-white/[0.06]">
                <th className="pb-1.5 font-medium text-[10px] uppercase">Address</th>
                <th className="pb-1.5 font-medium text-[10px] uppercase">Cluster</th>
                <th className="pb-1.5 font-medium text-[10px] uppercase text-right">Rank</th>
              </tr>
            </thead>
            <tbody>
              {clusterHolders.map((c, i) => (
                <tr key={i} className="border-b border-white/[0.03]">
                  <td className="py-1.5 text-[#52525b]">{truncAddr(String(c.address ?? c.holderAddress ?? ""))}</td>
                  <td className="py-1.5 text-[#a1a1aa]">{String(c.clusterId ?? c.clusterTag ?? "—")}</td>
                  <td className="py-1.5 text-right text-[#a1a1aa]">{String(c.addressRank ?? c.rank ?? "—")}</td>
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

- [ ] **Step 4: Create tab-traders.tsx**

```typescript
// web/src/components/tab-traders.tsx
"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchTopTraders, fetchTokenTrades, truncAddr, timeAgo, formatUsd } from "../lib/api";

const TAG_STYLE: Record<string, string> = {
  "3": "text-[#a78bfa] bg-[rgba(167,139,250,0.08)]",
  "4": "text-[#34d399] bg-[rgba(52,211,153,0.08)]",
  "1": "text-[#f59e0b] bg-[rgba(245,158,11,0.08)]",
};

function tagLabel(tag: string | number): string {
  const t = String(tag);
  if (t === "3") return "smart $";
  if (t === "4") return "whale";
  if (t === "1") return "kol";
  return "normal";
}

export function TabTraders({ address }: { address: string }): React.ReactNode {
  const { data: tradersData } = useQuery({
    queryKey: ["traders-full", address],
    queryFn: () => fetchTopTraders(address),
  });

  const { data: tradesData } = useQuery({
    queryKey: ["trades", address],
    queryFn: () => fetchTokenTrades(address, 20),
  });

  const traders = Array.isArray(tradersData?.data) ? (tradersData.data as Record<string, unknown>[]) : [];
  const trades = Array.isArray(tradesData?.data) ? (tradesData.data as Record<string, unknown>[]) : [];

  return (
    <div className="py-5 space-y-6">
      <div>
        <div className="text-[10px] font-medium text-[#52525b] uppercase tracking-wider mb-2">Top Traders</div>
        <table className="w-full text-[11px] font-mono">
          <thead>
            <tr className="text-[#52525b] text-left border-b border-white/[0.06]">
              <th className="pb-1.5 font-medium text-[10px] uppercase">Address</th>
              <th className="pb-1.5 font-medium text-[10px] uppercase">Tag</th>
              <th className="pb-1.5 font-medium text-[10px] uppercase text-right">PnL</th>
              <th className="pb-1.5 font-medium text-[10px] uppercase text-right hidden sm:table-cell">Buy Vol</th>
              <th className="pb-1.5 font-medium text-[10px] uppercase text-right hidden sm:table-cell">Sell Vol</th>
              <th className="pb-1.5 font-medium text-[10px] uppercase text-right">Trades</th>
            </tr>
          </thead>
          <tbody>
            {traders.map((t, i) => {
              const pnl = Number(t.pnl ?? t.profit ?? 0);
              return (
                <tr key={i} className="border-b border-white/[0.03]">
                  <td className="py-1.5 text-[#52525b]">{truncAddr(String(t.traderAddress ?? t.address ?? ""))}</td>
                  <td className="py-1.5">
                    <span className={`inline-block px-1 py-px rounded text-[9px] font-medium ${TAG_STYLE[String(t.tag ?? "")] ?? "text-[#52525b] bg-white/[0.04]"}`}>
                      {tagLabel(t.tag ?? "")}
                    </span>
                  </td>
                  <td className={`py-1.5 text-right ${pnl >= 0 ? "text-[#34d399]" : "text-[#ef4444]"}`}>
                    {pnl >= 0 ? "+" : ""}${Math.abs(pnl).toLocaleString()}
                  </td>
                  <td className="py-1.5 text-right text-[#a1a1aa] hidden sm:table-cell">{t.buyVolume ?? "—"}</td>
                  <td className="py-1.5 text-right text-[#a1a1aa] hidden sm:table-cell">{t.sellVolume ?? "—"}</td>
                  <td className="py-1.5 text-right text-[#a1a1aa]">{t.tradeCount ?? t.txCount ?? "—"}</td>
                </tr>
              );
            })}
            {traders.length === 0 && <tr><td colSpan={6} className="py-4 text-[#52525b]">No trader data.</td></tr>}
          </tbody>
        </table>
      </div>

      <div>
        <div className="text-[10px] font-medium text-[#52525b] uppercase tracking-wider mb-2">Recent Trades</div>
        <table className="w-full text-[11px] font-mono">
          <thead>
            <tr className="text-[#52525b] text-left border-b border-white/[0.06]">
              <th className="pb-1.5 font-medium text-[10px] uppercase">Type</th>
              <th className="pb-1.5 font-medium text-[10px] uppercase">Address</th>
              <th className="pb-1.5 font-medium text-[10px] uppercase text-right">Amount</th>
              <th className="pb-1.5 font-medium text-[10px] uppercase text-right hidden sm:table-cell">Price</th>
              <th className="pb-1.5 font-medium text-[10px] uppercase text-right">Time</th>
            </tr>
          </thead>
          <tbody>
            {trades.map((t, i) => {
              const isBuy = String(t.type ?? t.side ?? "").toLowerCase().includes("buy");
              return (
                <tr key={i} className="border-b border-white/[0.03]">
                  <td className={`py-1.5 ${isBuy ? "text-[#34d399]" : "text-[#ef4444]"}`}>{isBuy ? "BUY" : "SELL"}</td>
                  <td className="py-1.5 text-[#52525b]">{truncAddr(String(t.traderAddress ?? t.address ?? ""))}</td>
                  <td className="py-1.5 text-right text-[#a1a1aa]">{t.amount ? formatUsd(Number(t.amount)) : "—"}</td>
                  <td className="py-1.5 text-right text-[#a1a1aa] hidden sm:table-cell">{t.price ? formatUsd(Number(t.price)) : "—"}</td>
                  <td className="py-1.5 text-right text-[#52525b]">{t.timestamp ? timeAgo(Number(t.timestamp)) : "—"}</td>
                </tr>
              );
            })}
            {trades.length === 0 && <tr><td colSpan={5} className="py-4 text-[#52525b]">No trade data.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Create tab-security.tsx**

```typescript
// web/src/components/tab-security.tsx
"use client";

import { type Verdict } from "../lib/api";

interface TabSecurityProps {
  verdict: Verdict | null;
}

function SecurityRow({ label, value, danger }: { label: string; value: string; danger?: boolean }): React.ReactNode {
  const color = danger ? "text-[#ef4444]" : value === "No" || value === "0%" ? "text-[#34d399]" : "text-[#a1a1aa]";
  return (
    <div className="flex justify-between py-1.5 text-xs border-b border-white/[0.03]">
      <span className="text-[#52525b]">{label}</span>
      <span className={`font-mono ${color}`}>{value}</span>
    </div>
  );
}

export function TabSecurity({ verdict }: TabSecurityProps): React.ReactNode {
  if (!verdict) {
    return <div className="py-5 text-xs text-[#52525b] font-mono">No security data. Run a scan first.</div>;
  }

  return (
    <div className="py-5 max-w-lg">
      <div className="text-[10px] font-medium text-[#52525b] uppercase tracking-wider mb-2">Token Security Scan</div>
      <SecurityRow label="Honeypot" value={verdict.isHoneypot ? "Yes" : "No"} danger={verdict.isHoneypot} />
      <SecurityRow label="Mintable" value={verdict.hasMint ? "Yes" : "No"} danger={verdict.hasMint} />
      <SecurityRow label="Proxy Contract" value={verdict.isProxy ? "Yes" : "No"} danger={verdict.isProxy} />
      <SecurityRow label="Rug Pull History" value={verdict.hasRug ? "Yes" : "No"} danger={verdict.hasRug} />
      <SecurityRow label="Buy Tax" value={`${verdict.buyTax}%`} danger={verdict.buyTax > 5} />
      <SecurityRow label="Sell Tax" value={`${verdict.sellTax}%`} danger={verdict.sellTax > 5} />
      <SecurityRow label="Holder Concentration" value={`${verdict.holderConcentration}%`} danger={verdict.holderConcentration > 50} />
      {verdict.risks.length > 0 && (
        <div className="mt-4">
          <div className="text-[10px] font-medium text-[#52525b] uppercase tracking-wider mb-2">Risks Detected</div>
          <div className="space-y-1">
            {verdict.risks.map((r, i) => (
              <div key={i} className="text-[11px] font-mono text-[#ef4444]">&bull; {r}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 6: Create tab-dev-intel.tsx**

```typescript
// web/src/components/tab-dev-intel.tsx
"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchDevInfo, fetchSimilarTokens, fetchBundleInfo, fetchApedWallets, truncAddr, timeAgo } from "../lib/api";

function KV({ label, value }: { label: string; value: React.ReactNode }): React.ReactNode {
  return (
    <div className="flex justify-between py-1.5 text-xs border-b border-white/[0.03]">
      <span className="text-[#52525b]">{label}</span>
      <span className="font-mono text-[#a1a1aa]">{value}</span>
    </div>
  );
}

export function TabDevIntel({ address }: { address: string }): React.ReactNode {
  const { data: devData } = useQuery({
    queryKey: ["dev-info", address],
    queryFn: () => fetchDevInfo(address),
  });

  const { data: similarData } = useQuery({
    queryKey: ["similar-tokens", address],
    queryFn: () => fetchSimilarTokens(address),
  });

  const { data: bundleData } = useQuery({
    queryKey: ["bundle-info", address],
    queryFn: () => fetchBundleInfo(address),
  });

  const { data: apedData } = useQuery({
    queryKey: ["aped-wallets", address],
    queryFn: () => fetchApedWallets(address),
  });

  const dev = (devData?.data ?? devData) as Record<string, unknown> | undefined;
  const devInfo = (dev?.devLaunchedInfo ?? dev) as Record<string, unknown> | undefined;
  const similar = Array.isArray(similarData?.data) ? (similarData.data as Record<string, unknown>[]) : [];
  const bundle = (bundleData?.data ?? bundleData) as Record<string, unknown> | undefined;
  const aped = Array.isArray(apedData?.data) ? (apedData.data as Record<string, unknown>[]) : [];

  const rugCount = Number(devInfo?.rugPullCount ?? 0);
  const isSerialLauncher = rugCount > 2;

  return (
    <div className="py-5 space-y-6">
      <div>
        <div className="text-[10px] font-medium text-[#52525b] uppercase tracking-wider mb-2">
          Developer Info
          {isSerialLauncher && <span className="ml-2 text-[#ef4444] text-[9px] font-mono">SERIAL LAUNCHER</span>}
        </div>
        <KV label="Rug Pull Count" value={<span className={rugCount > 0 ? "text-[#ef4444]" : "text-[#34d399]"}>{rugCount}</span>} />
        <KV label="Total Tokens Launched" value={String(devInfo?.totalTokens ?? devInfo?.tokenCount ?? "—")} />
        <KV label="Migrated Count" value={String(devInfo?.migratedCount ?? "—")} />
        <KV label="Holding Info" value={String(devInfo?.holdingInfo ?? devInfo?.holding ?? "—")} />
      </div>

      {similar.length > 0 && (
        <div>
          <div className="text-[10px] font-medium text-[#52525b] uppercase tracking-wider mb-2">Similar Tokens by Dev</div>
          <table className="w-full text-[11px] font-mono">
            <thead>
              <tr className="text-[#52525b] text-left border-b border-white/[0.06]">
                <th className="pb-1.5 font-medium text-[10px] uppercase">Token</th>
                <th className="pb-1.5 font-medium text-[10px] uppercase">Status</th>
                <th className="pb-1.5 font-medium text-[10px] uppercase text-right">Created</th>
              </tr>
            </thead>
            <tbody>
              {similar.map((s, i) => (
                <tr key={i} className="border-b border-white/[0.03]">
                  <td className="py-1.5 text-[#a1a1aa]">{String(s.tokenSymbol ?? s.symbol ?? s.name ?? "—")}</td>
                  <td className="py-1.5 text-[#52525b]">{String(s.stage ?? s.status ?? "—")}</td>
                  <td className="py-1.5 text-right text-[#52525b]">{s.timestamp ? timeAgo(Number(s.timestamp)) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {bundle && (
        <div>
          <div className="text-[10px] font-medium text-[#52525b] uppercase tracking-wider mb-2">Bundle Info</div>
          <div className="text-[11px] font-mono text-[#a1a1aa] whitespace-pre-wrap">
            {JSON.stringify(bundle, null, 2).slice(0, 500)}
          </div>
        </div>
      )}

      {aped.length > 0 && (
        <div>
          <div className="text-[10px] font-medium text-[#52525b] uppercase tracking-wider mb-2">Aped Wallets</div>
          <table className="w-full text-[11px] font-mono">
            <thead>
              <tr className="text-[#52525b] text-left border-b border-white/[0.06]">
                <th className="pb-1.5 font-medium text-[10px] uppercase">Address</th>
                <th className="pb-1.5 font-medium text-[10px] uppercase text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {aped.map((a, i) => (
                <tr key={i} className="border-b border-white/[0.03]">
                  <td className="py-1.5 text-[#52525b]">{truncAddr(String(a.address ?? a.walletAddress ?? ""))}</td>
                  <td className="py-1.5 text-right text-[#a1a1aa]">{a.amount ?? a.value ?? "—"}</td>
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

- [ ] **Step 7: Verify compile**

Run: `cd /Users/pavelmackevic/Projects/agentra/web && npx tsc --noEmit 2>&1 | head -20`

- [ ] **Step 8: Commit**

```bash
git add web/src/components/token-tabs.tsx web/src/components/tab-overview.tsx web/src/components/tab-holders.tsx web/src/components/tab-traders.tsx web/src/components/tab-security.tsx web/src/components/tab-dev-intel.tsx
git commit -m "feat(web): add token profile tab components (overview, holders, traders, security, dev intel)"
```

---

### Task 9: Token Profile Page (assembles hero + tabs)

**Files:**
- Create: `web/src/app/token/[address]/page.tsx`

- [ ] **Step 1: Create token/[address]/page.tsx**

```typescript
// web/src/app/token/[address]/page.tsx
"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { TokenHero } from "../../../components/token-hero";
import { TokenTabs, type TokenTab } from "../../../components/token-tabs";
import { TabOverview } from "../../../components/tab-overview";
import { TabHolders } from "../../../components/tab-holders";
import { TabTraders } from "../../../components/tab-traders";
import { TabSecurity } from "../../../components/tab-security";
import { TabDevIntel } from "../../../components/tab-dev-intel";
import { fetchTokenPairs, fetchAnalysis, fetchTokenHolders } from "../../../lib/api";

export default function TokenProfilePage(): React.ReactNode {
  const params = useParams();
  const address = String(params.address ?? "");
  const [activeTab, setActiveTab] = useState<TokenTab>("Overview");

  const { data: pairs } = useQuery({
    queryKey: ["dex-pairs", address],
    queryFn: () => fetchTokenPairs(address),
    enabled: !!address,
  });

  const { data: verdict } = useQuery({
    queryKey: ["analysis", address],
    queryFn: () => fetchAnalysis(address),
    enabled: !!address,
  });

  const { data: holdersData } = useQuery({
    queryKey: ["holders-hero", address],
    queryFn: () => fetchTokenHolders(address),
    enabled: !!address,
  });

  const pair = pairs?.[0];
  const holdersArr = Array.isArray(holdersData?.data) ? (holdersData.data as Record<string, unknown>[]) : [];
  const smartMoneyCount = holdersArr.filter((h) => String(h.tag) === "3").length;

  return (
    <div className="mx-auto max-w-[1400px] px-6 lg:px-10">
      {/* Breadcrumb */}
      <div className="py-3 text-[11px] text-[#52525b] font-mono">
        <Link href="/discover" className="text-[#a1a1aa] hover:text-[#fafafa] transition-colors">Discover</Link>
        <span className="mx-1.5">/</span>
        {verdict?.tokenSymbol ?? pair?.baseToken?.symbol ?? address.slice(0, 8)}
      </div>

      <TokenHero
        address={address}
        name={verdict?.tokenName ?? pair?.baseToken?.name ?? ""}
        symbol={verdict?.tokenSymbol ?? pair?.baseToken?.symbol ?? ""}
        verdict={verdict?.verdict}
        riskScore={verdict?.riskScore}
        priceUsd={verdict?.priceUsd ?? (pair?.priceUsd ? Number(pair.priceUsd) : undefined)}
        priceChange24h={verdict?.priceChange24H ?? pair?.priceChange?.h24}
        marketCap={verdict?.marketCap ?? pair?.marketCap}
        liquidityUsd={verdict?.liquidityUsd ?? pair?.liquidity?.usd}
        volume24h={verdict?.volume24H ?? pair?.volume?.h24}
        holdersCount={holdersArr.length || verdict?.holders}
        smartMoneyCount={smartMoneyCount || undefined}
      />

      <TokenTabs active={activeTab} onChange={setActiveTab} />

      {activeTab === "Overview" && <TabOverview address={address} verdict={verdict} />}
      {activeTab === "Holders" && <TabHolders address={address} />}
      {activeTab === "Traders" && <TabTraders address={address} />}
      {activeTab === "Security" && <TabSecurity verdict={verdict} />}
      {activeTab === "Dev Intel" && <TabDevIntel address={address} />}
    </div>
  );
}
```

- [ ] **Step 2: Verify compile**

Run: `cd /Users/pavelmackevic/Projects/agentra/web && npx tsc --noEmit 2>&1 | head -20`

- [ ] **Step 3: Manual test**

Run: `cd /Users/pavelmackevic/Projects/agentra/web && npm run dev`

1. Open http://localhost:3000 — verify "Open Dashboard" links to /discover
2. Open http://localhost:3000/discover — verify screener table, signal bar, filters, leaderboard render
3. Open http://localhost:3000/feed — verify it redirects to /discover
4. Click any row in the screener (or navigate to /token/0x1234...) — verify Token Profile renders with hero, tabs
5. Click through each tab (Overview, Holders, Traders, Security, Dev Intel) — verify they load data

- [ ] **Step 4: Commit**

```bash
git add web/src/app/token/
git commit -m "feat(web): add Token Profile page with lazy-loaded tabs"
```

---

### Task 10: Final cleanup and integration commit

**Files:**
- Verify all files compile and run together

- [ ] **Step 1: Full TypeScript check**

Run: `cd /Users/pavelmackevic/Projects/agentra/web && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 2: Verify all pages load**

Run: `cd /Users/pavelmackevic/Projects/agentra/web && npm run build 2>&1 | tail -20`
Expected: Build succeeds with no errors

- [ ] **Step 3: Commit build verification**

```bash
git add -A
git commit -m "chore(web): verify discover + token profile build clean"
```
