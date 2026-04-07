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

    // Whale/Smart Money/KOL signals — token data is nested in s.token object
    for (const s of whaleSignals ?? []) {
      const tok = s.token as Record<string, unknown> | undefined;
      const addr = String(tok?.tokenAddress ?? s.tokenContractAddress ?? s.address ?? "").toLowerCase();
      if (!addr || addr === "undefined") continue;
      const existing = byAddr.get(addr);
      const ts = Number(s.timestamp ?? s.blockTimestamp ?? Date.now());
      if (!existing || ts > existing.timestamp) {
        byAddr.set(addr, {
          ...(existing ?? {}),
          token: addr,
          tokenSymbol: String(tok?.symbol ?? s.tokenSymbol ?? existing?.tokenSymbol ?? ""),
          tokenName: String(tok?.name ?? s.tokenName ?? existing?.tokenName ?? ""),
          priceUsd: Number(s.price ?? s.priceUsd ?? existing?.priceUsd ?? 0) || undefined,
          marketCap: Number(tok?.marketCapUsd ?? existing?.marketCap ?? 0) || undefined,
          source: mapSource(String(s.tracker ?? "")),
          timestamp: ts,
        });
      }
    }

    // Trending — filter to X Layer only (chainId "xlayer" or 196)
    for (const t of trending ?? []) {
      const chain = String(t.chainId ?? "");
      if (chain !== "xlayer" && chain !== "196") continue;
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

    const verdictMap = new Map<string, NonNullable<typeof verdicts>[number]>();
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
