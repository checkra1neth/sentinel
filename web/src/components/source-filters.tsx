"use client";

import { useState, useEffect, useRef } from "react";
import { type DiscoverToken } from "../lib/api";

const SOURCES = ["All", "Whale", "Smart Money", "Trending", "Scanner", "KOL"] as const;
export type SourceFilter = (typeof SOURCES)[number];

const SOURCE_MAP: Record<string, DiscoverToken["source"]> = {
  Whale: "WHALE",
  "Smart Money": "SMART $",
  Trending: "TRENDING",
  Scanner: "SCANNER",
  KOL: "KOL",
};

interface SourceFiltersProps {
  active: SourceFilter;
  onFilterChange: (source: SourceFilter) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  tokens: DiscoverToken[];
}

export function SourceFilters({
  active,
  onFilterChange,
  searchQuery,
  onSearchChange,
  tokens,
}: SourceFiltersProps): React.ReactNode {
  const [localQuery, setLocalQuery] = useState(searchQuery);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => onSearchChange(localQuery), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [localQuery, onSearchChange]);

  // Count per source — hide filters with 0 items
  const counts = new Map<string, number>();
  for (const t of tokens) {
    counts.set(t.source, (counts.get(t.source) ?? 0) + 1);
  }

  return (
    <div className="flex gap-1.5 py-3 items-center flex-wrap">
      {SOURCES.map((src) => {
        const count = src === "All" ? tokens.length : (counts.get(SOURCE_MAP[src] ?? "") ?? 0);
        if (src !== "All" && count === 0) return null;
        return (
          <button
            key={src}
            onClick={() => onFilterChange(src)}
            className={`px-2.5 py-1 text-[11px] font-medium rounded transition-colors cursor-pointer ${
              active === src
                ? "text-[#fafafa] bg-white/[0.06]"
                : "text-[#52525b] border border-white/[0.06] hover:text-[#a1a1aa] hover:border-white/[0.1]"
            }`}
          >
            {src} <span className="text-[#52525b] ml-0.5">{count}</span>
          </button>
        );
      })}
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
