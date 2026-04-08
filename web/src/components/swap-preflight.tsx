"use client";

import { type Verdict } from "../lib/api";

interface SwapPreFlightProps {
  token: string;
  verdict: Verdict | null;
  loading: boolean;
}

export function SwapPreFlight({ token, verdict, loading }: SwapPreFlightProps): React.ReactNode {
  if (loading) {
    return (
      <div className="flex items-center gap-2 bg-white/[0.02] border border-white/[0.06] rounded px-3 py-2">
        <span className="inline-block w-2 h-2 rounded-full bg-[#52525b] animate-pulse" />
        <span className="text-[11px] font-mono text-[#52525b]">
          Scanning {token.slice(0, 6)}...{token.slice(-4)}
        </span>
      </div>
    );
  }

  if (!verdict) {
    return (
      <div className="flex items-center gap-2 bg-white/[0.02] border border-white/[0.06] rounded px-3 py-2">
        <span className="inline-block w-2 h-2 rounded-full bg-[#52525b]" />
        <span className="text-[11px] font-mono text-[#52525b]">No analysis data</span>
      </div>
    );
  }

  const v = verdict.verdict;

  const badgeColor =
    v === "SAFE"
      ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/20"
      : v === "CAUTION"
        ? "bg-amber-500/15 text-amber-400 border-amber-500/20"
        : "bg-red-500/15 text-red-400 border-red-500/20";

  const icon =
    v === "SAFE" ? "\u2713" : v === "CAUTION" ? "\u26A0" : "\u2716";

  return (
    <div className={`border rounded px-3 py-2.5 space-y-1.5 ${
      v === "SAFE"
        ? "bg-emerald-500/[0.04] border-emerald-500/20"
        : v === "CAUTION"
          ? "bg-amber-500/[0.04] border-amber-500/20"
          : "bg-red-500/[0.04] border-red-500/20"
    }`}>
      <div className="flex items-center gap-2">
        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold border ${badgeColor}`}>
          <span>{icon}</span>
          {v}
        </span>
        <span className="text-[11px] font-mono text-[#a1a1aa]">
          {verdict.tokenSymbol || token.slice(0, 8)}
        </span>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] font-mono text-[#a1a1aa]">
        {verdict.isHoneypot && (
          <span className="text-red-400">Honeypot detected</span>
        )}
        {(verdict.buyTax > 0 || verdict.sellTax > 0) && (
          <span>
            Tax: {verdict.buyTax}% buy / {verdict.sellTax}% sell
          </span>
        )}
        {verdict.riskScore != null && (
          <span>Risk: {verdict.riskScore}/100</span>
        )}
      </div>
    </div>
  );
}
