"use client";

import Link from "next/link";
import { type Verdict, formatUsd } from "../lib/api";

const VERDICT_COLOR: Record<string, string> = {
  SAFE: "#34d399",
  CAUTION: "#f59e0b",
  DANGEROUS: "#ef4444",
};

const VERDICT_BG: Record<string, string> = {
  SAFE: "rgba(52,211,153,0.08)",
  CAUTION: "rgba(245,158,11,0.08)",
  DANGEROUS: "rgba(239,68,68,0.08)",
};

interface VerdictCardProps {
  verdict: Verdict;
  loading?: boolean;
  onRescan: () => void;
}

export function VerdictCard({ verdict, loading, onRescan }: VerdictCardProps): React.ReactNode {
  const score = verdict.riskScore ?? 0;
  const barColor = score <= 35 ? "#34d399" : score <= 65 ? "#f59e0b" : "#ef4444";
  const vColor = VERDICT_COLOR[verdict.verdict] ?? "#a1a1aa";
  const vBg = VERDICT_BG[verdict.verdict] ?? "transparent";

  const metrics: { label: string; value: string }[] = [
    { label: "Price", value: verdict.priceUsd ? formatUsd(verdict.priceUsd) : "—" },
    {
      label: "24h%",
      value: verdict.priceChange24H != null ? `${verdict.priceChange24H >= 0 ? "+" : ""}${verdict.priceChange24H.toFixed(1)}%` : "—",
    },
    { label: "MCap", value: verdict.marketCap ? formatUsd(verdict.marketCap) : "—" },
    { label: "Liquidity", value: verdict.liquidityUsd ? formatUsd(verdict.liquidityUsd) : "—" },
    { label: "Volume", value: verdict.volume24H ? formatUsd(verdict.volume24H) : "—" },
    { label: "Holders", value: verdict.holders?.toLocaleString() ?? "—" },
  ];

  return (
    <div className="border border-white/[0.06] rounded-lg p-5">
      {/* Header: name + verdict badge */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <span className="text-sm font-semibold text-[#fafafa]">
          {verdict.tokenName || verdict.tokenSymbol || "Unknown"}
        </span>
        <span className="text-xs text-[#a1a1aa] font-mono">{verdict.tokenSymbol}</span>
        <span
          className="px-2 py-px rounded text-[11px] font-mono font-medium"
          style={{ color: vColor, background: vBg }}
        >
          {verdict.verdict}
        </span>
        {loading && (
          <span className="text-[11px] text-[#52525b] font-mono animate-pulse">scanning...</span>
        )}
      </div>

      {/* Risk score bar */}
      <div className="mb-4">
        <div className="text-[10px] font-medium text-[#52525b] uppercase tracking-wider mb-1.5">
          Risk Score
        </div>
        <div className="h-1.5 bg-white/[0.04] rounded-sm relative">
          <div
            className="h-1.5 rounded-sm absolute top-0 left-0 transition-all duration-300"
            style={{ width: `${score}%`, background: barColor }}
          />
        </div>
        <div className="text-[11px] text-[#52525b] font-mono mt-1">{score} / 100</div>
      </div>

      {/* 6 metrics */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-4 mb-5">
        {metrics.map((m) => (
          <div key={m.label}>
            <div className="text-[10px] font-medium text-[#52525b] uppercase tracking-wider mb-0.5">
              {m.label}
            </div>
            <div className="font-mono text-xs text-[#fafafa]">{m.value}</div>
          </div>
        ))}
      </div>

      {/* Action buttons */}
      <div className="flex gap-2">
        <button
          onClick={onRescan}
          disabled={loading}
          className="px-3 py-1.5 rounded text-[11px] font-medium bg-white/[0.06] text-[#a1a1aa] hover:bg-white/[0.1] hover:text-[#fafafa] disabled:opacity-40 transition-colors"
        >
          Rescan
        </button>
        <Link
          href={`/token/${verdict.token}`}
          className="px-3 py-1.5 rounded text-[11px] font-medium bg-white/[0.06] text-[#a1a1aa] hover:bg-white/[0.1] hover:text-[#fafafa] transition-colors"
        >
          Full Profile
        </Link>
        <Link
          href={`/trade?token=${verdict.token}`}
          className="px-3 py-1.5 rounded text-[11px] font-medium bg-white/[0.06] text-[#a1a1aa] hover:bg-white/[0.1] hover:text-[#fafafa] transition-colors"
        >
          Trade
        </Link>
      </div>
    </div>
  );
}
