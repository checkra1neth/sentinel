"use client";

import { forwardRef, useState, useRef, useEffect } from "react";
import { ExternalLink, ChevronDown, RefreshCw, TrendingUp, TrendingDown } from "lucide-react";
import gsap from "gsap";

interface Verdict {
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
  defiPool?: {
    name: string;
    platform: string;
    apr: string;
    tvl: string;
    investmentId: number;
    poolAddress: string;
  };
}

const VERDICT_COLORS: Record<string, string> = {
  SAFE: "#34d399",
  CAUTION: "#f59e0b",
  DANGEROUS: "#ef4444",
};

const VERDICT_BG: Record<string, string> = {
  SAFE: "rgba(52, 211, 153, 0.08)",
  CAUTION: "rgba(245, 158, 11, 0.08)",
  DANGEROUS: "rgba(239, 68, 68, 0.08)",
};

function getTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

function formatUsd(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  if (value >= 1) return `$${value.toFixed(2)}`;
  if (value >= 0.01) return `$${value.toFixed(4)}`;
  return `$${value.toFixed(8)}`;
}

function formatCompact(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(Math.round(value));
}

function StatCell({ label, value, color }: { label: string; value: string; color?: string }): React.ReactNode {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-[0.12em] text-[#7a7f8a]/60">{label}</span>
      <span className="text-xs font-mono tabular-nums" style={{ color: color ?? "#e8eaed" }}>{value}</span>
    </div>
  );
}

export const VerdictRow = forwardRef<
  HTMLDivElement,
  { verdict: Verdict; onScanAgain?: (token: string) => void }
>(function VerdictRow({ verdict, onScanAgain }, ref) {
  const [expanded, setExpanded] = useState(false);
  const detailRef = useRef<HTMLDivElement>(null);
  const chevronRef = useRef<SVGSVGElement>(null);
  const color = VERDICT_COLORS[verdict.verdict] ?? VERDICT_COLORS.CAUTION;
  const bgColor = VERDICT_BG[verdict.verdict] ?? VERDICT_BG.CAUTION;
  const change24 = verdict.priceChange24H ?? 0;
  const isUp = change24 > 0;

  useEffect(() => {
    const el = detailRef.current;
    const chevron = chevronRef.current;
    if (!el) return;

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    if (prefersReducedMotion) {
      el.style.height = expanded ? "auto" : "0px";
      el.style.opacity = expanded ? "1" : "0";
      return;
    }

    if (expanded) {
      gsap.set(el, { height: "auto", opacity: 1 });
      const endHeight = el.scrollHeight;
      gsap.fromTo(
        el,
        { height: 0, opacity: 0 },
        { height: endHeight, opacity: 1, duration: 0.3, ease: "power2.out" },
      );
      if (chevron) {
        gsap.to(chevron, { rotation: 180, duration: 0.2, ease: "power2.out" });
      }
    } else {
      gsap.to(el, {
        height: 0,
        opacity: 0,
        duration: 0.25,
        ease: "power2.in",
      });
      if (chevron) {
        gsap.to(chevron, { rotation: 0, duration: 0.2, ease: "power2.in" });
      }
    }
  }, [expanded]);

  return (
    <div ref={ref} className="group">
      {/* Main row */}
      <div
        className="flex items-center gap-3 py-3 px-4 cursor-pointer transition-colors hover:bg-[#0f1116]/80"
        style={{ borderLeft: `3px solid ${color}` }}
        onClick={() => setExpanded((prev) => !prev)}
      >
        {/* Severity badge */}
        <span
          className="shrink-0 w-[68px] text-[10px] font-semibold uppercase tracking-[0.15em] text-center rounded py-0.5"
          style={{ color, backgroundColor: bgColor }}
        >
          {verdict.verdict}
        </span>

        {/* Token info */}
        <div className="flex-1 min-w-0 flex items-center gap-2">
          <span className="font-semibold text-[#e8eaed] text-sm">
            {verdict.tokenSymbol}
          </span>
          <span className="text-[#7a7f8a]/50 text-xs hidden sm:inline truncate">
            {verdict.tokenName !== verdict.tokenSymbol ? verdict.tokenName : ""}
          </span>
        </div>

        {/* Price + 24h change inline */}
        <div className="shrink-0 hidden sm:flex items-center gap-1.5">
          <span className="text-xs font-mono tabular-nums text-[#e8eaed]">
            {formatUsd(verdict.priceUsd)}
          </span>
          {change24 !== 0 && (
            <span
              className="text-[11px] font-mono tabular-nums flex items-center gap-0.5"
              style={{ color: isUp ? "#34d399" : "#ef4444" }}
            >
              {isUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {isUp ? "+" : ""}{change24.toFixed(1)}%
            </span>
          )}
        </div>

        {/* Risk score with inline bar */}
        <div className="shrink-0 flex items-center gap-2 w-24">
          <div className="h-1 w-12 bg-[#1a1d24] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${Math.min(verdict.riskScore, 100)}%`,
                backgroundColor: color,
              }}
            />
          </div>
          <span
            className="text-xs font-semibold tabular-nums w-6 text-right"
            style={{ color }}
          >
            {verdict.riskScore}
          </span>
        </div>

        {/* Time ago */}
        <span className="shrink-0 text-[11px] text-[#7a7f8a]/50 w-7 text-right tabular-nums">
          {getTimeAgo(verdict.timestamp)}
        </span>

        {/* Expand indicator */}
        <ChevronDown
          ref={chevronRef}
          className="h-3 w-3 text-[#7a7f8a]/30 shrink-0"
        />
      </div>

      {/* Expanded details - GSAP animated */}
      <div
        ref={detailRef}
        className="overflow-hidden"
        style={{ height: 0, opacity: 0 }}
      >
        <div
          className="px-4 pb-3 pt-1.5 space-y-2"
          style={{ borderLeft: `3px solid ${color}`, marginLeft: 0 }}
        >
          {/* Row 1: all market stats inline */}
          <div className="flex items-baseline gap-x-5 gap-y-1 flex-wrap text-xs">
            <span><span className="text-[#7a7f8a]/60">Price </span><span className="font-mono tabular-nums text-[#e8eaed]">{formatUsd(verdict.priceUsd)}</span></span>
            <span><span className="text-[#7a7f8a]/60">MCap </span><span className="font-mono tabular-nums text-[#e8eaed]">{formatUsd(verdict.marketCap)}</span></span>
            <span><span className="text-[#7a7f8a]/60">Liq </span><span className="font-mono tabular-nums text-[#e8eaed]">{formatUsd(verdict.liquidityUsd)}</span></span>
            {(verdict.volume24H ?? 0) > 0 && (
              <span><span className="text-[#7a7f8a]/60">Vol </span><span className="font-mono tabular-nums text-[#e8eaed]">{formatUsd(verdict.volume24H ?? 0)}</span></span>
            )}
            {(verdict.holders ?? 0) > 0 && (
              <span><span className="text-[#7a7f8a]/60">Holders </span><span className="font-mono tabular-nums text-[#e8eaed]">{formatCompact(verdict.holders ?? 0)}</span></span>
            )}
            {verdict.holderConcentration > 0 && (
              <span><span className="text-[#7a7f8a]/60">Top10 </span><span className="font-mono tabular-nums" style={{ color: verdict.holderConcentration > 30 ? "#f59e0b" : "#e8eaed" }}>{verdict.holderConcentration.toFixed(1)}%</span></span>
            )}
            <span><span className="text-[#7a7f8a]/60">Tax </span><span className="font-mono tabular-nums" style={{ color: verdict.buyTax > 5 || verdict.sellTax > 5 ? "#ef4444" : "#e8eaed" }}>{verdict.buyTax}/{verdict.sellTax}%</span></span>
          </div>

          {/* Row 2: DeFi pool link */}
          {verdict.defiPool && (
            <div>
              <a
                href={verdict.defiPool.poolAddress
                  ? `https://app.uniswap.org/explore/pools/xlayer/${verdict.defiPool.poolAddress}`
                  : `https://app.uniswap.org/swap?chain=xlayer&outputCurrency=${verdict.token}`
                }
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded px-2 py-0.5 text-[11px] hover:bg-[#6366f1]/10 transition-colors"
                style={{ backgroundColor: "rgba(99, 102, 241, 0.06)", border: "1px solid rgba(99, 102, 241, 0.12)" }}
                onClick={(e) => e.stopPropagation()}
              >
                <span className="text-[9px] font-semibold uppercase tracking-[0.1em] text-[#6366f1]/70">{verdict.defiPool.platform}</span>
                <span className="text-[#e8eaed]/80 font-mono">{verdict.defiPool.name}</span>
                <span className="text-[#34d399] font-semibold tabular-nums">{(Number(verdict.defiPool.apr) * 100).toFixed(1)}%</span>
                <span className="text-[#7a7f8a]/40 tabular-nums font-mono">{formatUsd(Number(verdict.defiPool.tvl))}</span>
                <ExternalLink className="h-2.5 w-2.5 text-[#6366f1]/40" />
              </a>
            </div>
          )}

          {/* Row 3: actions */}
          <div className="flex items-center gap-3 pt-0.5">
            {verdict.txHash && (
              <a
                href={`https://www.oklink.com/xlayer/tx/${verdict.txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[11px] text-[#6366f1]/60 hover:text-[#818cf8] transition-colors"
              >
                Tx <ExternalLink className="h-2.5 w-2.5" />
              </a>
            )}
            <a
              href={`https://www.oklink.com/xlayer/address/${verdict.token}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[11px] text-[#6366f1]/60 hover:text-[#818cf8] transition-colors"
            >
              Contract <ExternalLink className="h-2.5 w-2.5" />
            </a>
            {onScanAgain && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onScanAgain(verdict.token);
                }}
                className="inline-flex items-center gap-1 text-[11px] text-[#7a7f8a]/40 hover:text-[#e8eaed] transition-colors cursor-pointer"
              >
                <RefreshCw className="h-2.5 w-2.5" />
                Rescan
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Subtle separator */}
      <div className="h-px bg-[#1a1d24]/30" />
    </div>
  );
});
