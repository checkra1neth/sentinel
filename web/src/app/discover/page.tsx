"use client";

import { useState, useCallback, useMemo } from "react";
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
  STALE_FAST,
  STALE_NORMAL,
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
    staleTime: STALE_FAST,
    refetchInterval: 15_000,
  });

  const { data: whaleSignals } = useQuery({
    queryKey: ["discover-whales"],
    queryFn: fetchWhaleSignals,
    staleTime: STALE_FAST,
    refetchInterval: 15_000,
  });

  const { data: trending } = useQuery({
    queryKey: ["discover-trending"],
    queryFn: fetchTrending,
    staleTime: STALE_NORMAL,
    refetchInterval: 30_000,
  });

  const { data: verdicts } = useQuery({
    queryKey: ["verdicts"],
    queryFn: () => fetchVerdicts(50),
    staleTime: STALE_FAST,
    refetchInterval: 15_000,
  });

  const mergedTokens = useMemo((): DiscoverToken[] => {
    const byAddr = new Map<string, DiscoverToken>();

    // 1. Verdicts FIRST — richest data (price, mcap, liq, risk, holders)
    for (const v of verdicts ?? []) {
      const addr = v.token.toLowerCase();
      byAddr.set(addr, {
        token: addr,
        tokenSymbol: v.tokenSymbol,
        tokenName: v.tokenName,
        priceUsd: v.priceUsd || undefined,
        priceChange24h: v.priceChange24H ?? undefined,
        marketCap: v.marketCap || undefined,
        liquidityUsd: v.liquidityUsd || undefined,
        volume24h: v.volume24H ?? undefined,
        riskScore: v.riskScore,
        verdict: v.verdict,
        smartMoneyCount: (v as unknown as Record<string, unknown>).holderInsight
          ? Number(((v as unknown as Record<string, unknown>).holderInsight as Record<string, unknown>)?.smartMoneyCount ?? 0) || undefined
          : undefined,
        source: "SCANNER",
        timestamp: v.timestamp,
      });
    }

    // 2. Whale/Smart Money/KOL signals — tracker activities have tokenPrice/marketCap at top level
    for (const s of whaleSignals ?? []) {
      const tok = s.token as Record<string, unknown> | undefined;
      const addr = String(s.tokenContractAddress ?? tok?.tokenAddress ?? s.tokenAddress ?? s.address ?? "").toLowerCase();
      if (!addr || addr === "undefined" || addr === "") continue;
      const existing = byAddr.get(addr);
      const ts = Number(s.tradeTime ?? s.timestamp ?? s.blockTimestamp ?? Date.now());
      byAddr.set(addr, {
        ...(existing ?? { token: addr, timestamp: ts }),
        token: addr,
        tokenSymbol: String(s.tokenSymbol ?? tok?.symbol ?? existing?.tokenSymbol ?? ""),
        tokenName: String(tok?.name ?? existing?.tokenName ?? ""),
        priceUsd: Number(s.tokenPrice ?? s.price ?? existing?.priceUsd ?? 0) || undefined,
        marketCap: Number(s.marketCap ?? tok?.marketCapUsd ?? existing?.marketCap ?? 0) || undefined,
        riskScore: existing?.riskScore,
        verdict: existing?.verdict,
        priceChange24h: existing?.priceChange24h,
        liquidityUsd: existing?.liquidityUsd,
        volume24h: existing?.volume24h,
        smartMoneyCount: existing?.smartMoneyCount,
        source: mapSource(String(s.tracker ?? "")),
        timestamp: ts,
      });
    }

    // 3. Scanner feed — enriched with market data from backend
    for (const t of scannerTokens ?? []) {
      const addr = String(t.address ?? t.token ?? t.tokenContractAddress ?? "").toLowerCase();
      if (!addr) continue;
      const existing = byAddr.get(addr);
      const name = String(t.symbol ?? t.tokenSymbol ?? t.name ?? "");
      byAddr.set(addr, {
        ...(existing ?? { token: addr, timestamp: Number(t.timestamp ?? Date.now()) }),
        token: addr,
        tokenSymbol: name || existing?.tokenSymbol,
        tokenName: String(t.name ?? t.tokenName ?? name) || existing?.tokenName,
        priceUsd: Number(t.priceUsd ?? t.price ?? 0) || existing?.priceUsd,
        priceChange24h: Number(t.priceChange24h ?? t.change ?? 0) || existing?.priceChange24h,
        marketCap: Number(t.marketCap ?? 0) || existing?.marketCap,
        liquidityUsd: Number(t.liquidityUsd ?? t.liquidity ?? 0) || existing?.liquidityUsd,
        volume24h: Number(t.volume24h ?? t.volume ?? 0) || existing?.volume24h,
        riskScore: existing?.riskScore,
        verdict: existing?.verdict,
        smartMoneyCount: existing?.smartMoneyCount,
        source: existing?.source ?? "SCANNER",
        timestamp: existing?.timestamp ?? Number(t.timestamp ?? Date.now()),
      });
    }

    // 4. Trending — only X Layer, only new tokens
    for (const t of trending ?? []) {
      const chain = String(t.chainId ?? "");
      if (chain !== "xlayer" && chain !== "196") continue;
      const addr = String(t.tokenAddress ?? t.address ?? "").toLowerCase();
      if (!addr || byAddr.has(addr)) continue;
      byAddr.set(addr, {
        token: addr,
        tokenSymbol: String(t.symbol ?? t.tokenSymbol ?? ""),
        source: "TRENDING",
        timestamp: Date.now(),
      });
    }

    // Sort: tokens with data first (have price or riskScore), empty scanner tokens last
    const result = Array.from(byAddr.values());
    result.sort((a, b) => {
      const aHasData = a.priceUsd || a.riskScore != null ? 1 : 0;
      const bHasData = b.priceUsd || b.riskScore != null ? 1 : 0;
      if (aHasData !== bHasData) return bHasData - aHasData;
      return b.timestamp - a.timestamp;
    });
    return result;
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
        tokens={mergedTokens}
      />
      <ScreenerTable tokens={filtered} />
      <LeaderboardPanel />
    </div>
  );
}
