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
