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
