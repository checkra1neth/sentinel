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
  const metrics: { label: string; value: React.ReactNode; cyan?: boolean }[] = [
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
