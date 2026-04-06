"use client";

import { forwardRef, useState, useRef, useEffect } from "react";
import { ExternalLink, ChevronDown, RefreshCw } from "lucide-react";
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
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  if (value >= 1) return `$${value.toFixed(2)}`;
  return `$${value.toFixed(6)}`;
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

  const risks: string[] = [];
  if (verdict.isHoneypot) risks.push("Honeypot");
  if (verdict.hasRug) risks.push("Rug pull");
  if (verdict.hasMint) risks.push("Mintable");
  if (verdict.isProxy) risks.push("Proxy");
  if (verdict.buyTax > 5) risks.push(`Buy tax ${verdict.buyTax}%`);
  if (verdict.sellTax > 5) risks.push(`Sell tax ${verdict.sellTax}%`);
  if (verdict.holderConcentration > 50)
    risks.push(`${verdict.holderConcentration}% whale`);
  if (verdict.risks?.length) risks.push(...verdict.risks);

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
        className="flex items-center gap-4 py-3 px-4 cursor-pointer transition-colors hover:bg-[#0f1116]"
        style={{ borderLeft: `3px solid ${color}` }}
        onClick={() => setExpanded((prev) => !prev)}
      >
        {/* Severity badge */}
        <span
          className="shrink-0 w-[72px] text-[11px] font-semibold uppercase tracking-[0.12em] text-center rounded py-0.5"
          style={{ color, backgroundColor: bgColor }}
        >
          {verdict.verdict}
        </span>

        {/* Token info */}
        <div className="flex-1 min-w-0 flex items-center gap-2">
          <span className="font-semibold text-[#e8eaed] text-sm truncate">
            {verdict.tokenSymbol}
          </span>
          <span className="text-[#7a7f8a] text-sm hidden sm:inline truncate">
            {verdict.tokenName}
          </span>
          <span className="font-mono text-xs text-[#7a7f8a]/60 hidden md:inline">
            {verdict.token.slice(0, 6)}...{verdict.token.slice(-4)}
          </span>
        </div>

        {/* Risk score with inline bar */}
        <div className="shrink-0 flex items-center gap-2 w-28">
          <div className="h-1.5 w-14 bg-[#1a1d24] rounded-full overflow-hidden">
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
        <span className="shrink-0 text-xs text-[#7a7f8a] w-8 text-right tabular-nums">
          {getTimeAgo(verdict.timestamp)}
        </span>

        {/* Expand indicator */}
        <ChevronDown
          ref={chevronRef}
          className="h-3.5 w-3.5 text-[#7a7f8a]/40 shrink-0"
        />
      </div>

      {/* Expanded details - GSAP animated */}
      <div
        ref={detailRef}
        className="overflow-hidden"
        style={{ height: 0, opacity: 0 }}
      >
        <div
          className="px-4 pb-4 pt-2"
          style={{ borderLeft: `3px solid ${color}`, marginLeft: 0 }}
        >
          {/* Market data row */}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs mb-3">
            <div>
              <span className="text-[#7a7f8a]">Price </span>
              <span className="text-[#e8eaed] tabular-nums font-mono">
                {formatUsd(verdict.priceUsd)}
              </span>
            </div>
            <div>
              <span className="text-[#7a7f8a]">MCap </span>
              <span className="text-[#e8eaed] tabular-nums font-mono">
                {formatUsd(verdict.marketCap)}
              </span>
            </div>
            <div>
              <span className="text-[#7a7f8a]">Liquidity </span>
              <span className="text-[#e8eaed] tabular-nums font-mono">
                {formatUsd(verdict.liquidityUsd)}
              </span>
            </div>
            {verdict.lpInvested && (
              <div>
                <span className="text-[#7a7f8a]">LP </span>
                <span className="text-[#34d399] tabular-nums font-mono">
                  {verdict.lpInvested}
                </span>
              </div>
            )}
          </div>

          {/* Tax info */}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs mb-3">
            <div>
              <span className="text-[#7a7f8a]">Buy Tax </span>
              <span
                className="tabular-nums font-mono"
                style={{ color: verdict.buyTax > 5 ? "#ef4444" : "#e8eaed" }}
              >
                {verdict.buyTax}%
              </span>
            </div>
            <div>
              <span className="text-[#7a7f8a]">Sell Tax </span>
              <span
                className="tabular-nums font-mono"
                style={{ color: verdict.sellTax > 5 ? "#ef4444" : "#e8eaed" }}
              >
                {verdict.sellTax}%
              </span>
            </div>
            <div>
              <span className="text-[#7a7f8a]">Holders </span>
              <span
                className="tabular-nums font-mono"
                style={{
                  color:
                    verdict.holderConcentration > 50 ? "#f59e0b" : "#e8eaed",
                }}
              >
                {verdict.holderConcentration}% top
              </span>
            </div>
          </div>

          {/* Full risks list */}
          {risks.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap mb-3">
              {risks.map((risk) => (
                <span
                  key={risk}
                  className="rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wider"
                  style={{
                    color: "#7a7f8a",
                    backgroundColor: "#1a1d24",
                  }}
                >
                  {risk}
                </span>
              ))}
            </div>
          )}

          {/* Actions row */}
          <div className="flex items-center gap-4">
            {verdict.txHash && (
              <a
                href={`https://www.oklink.com/xlayer/tx/${verdict.txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-[#6366f1] hover:text-[#818cf8] transition-colors"
              >
                <span>View tx</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
            <a
              href={`https://www.oklink.com/xlayer/address/${verdict.token}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-[#6366f1] hover:text-[#818cf8] transition-colors"
            >
              <span>Contract</span>
              <ExternalLink className="h-3 w-3" />
            </a>
            {onScanAgain && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onScanAgain(verdict.token);
                }}
                className="inline-flex items-center gap-1 text-xs text-[#7a7f8a] hover:text-[#e8eaed] transition-colors cursor-pointer"
              >
                <RefreshCw className="h-3 w-3" />
                <span>Scan Again</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Subtle separator */}
      <div className="h-px bg-[#1a1d24]/50" />
    </div>
  );
});
