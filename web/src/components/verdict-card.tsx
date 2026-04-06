"use client";

import {
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ExternalLink,
  Coins,
} from "lucide-react";
import type { ComponentType } from "react";

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

interface VerdictStyle {
  bg: string;
  text: string;
  border: string;
  hoverBg: string;
  barColor: string;
  Icon: ComponentType<{ className?: string }>;
}

const VERDICT_STYLES: Record<string, VerdictStyle> = {
  SAFE: {
    bg: "bg-emerald-500/10",
    text: "text-emerald-400",
    border: "border-emerald-500/30",
    hoverBg: "hover:bg-emerald-500/5",
    barColor: "bg-emerald-500",
    Icon: ShieldCheck,
  },
  CAUTION: {
    bg: "bg-amber-500/10",
    text: "text-amber-400",
    border: "border-amber-500/30",
    hoverBg: "hover:bg-amber-500/5",
    barColor: "bg-amber-500",
    Icon: ShieldAlert,
  },
  DANGEROUS: {
    bg: "bg-red-500/10",
    text: "text-red-400",
    border: "border-red-500/30",
    hoverBg: "hover:bg-red-500/5",
    barColor: "bg-red-500",
    Icon: ShieldX,
  },
};

function getTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatUsd(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  if (value >= 1) return `$${value.toFixed(2)}`;
  return `$${value.toFixed(6)}`;
}

interface RiskCheckProps {
  label: string;
  isRisk: boolean;
}

function RiskCheck({ label, isRisk }: RiskCheckProps): React.ReactNode {
  if (isRisk) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-amber-400">
        <AlertTriangle className="h-3 w-3" />
        {label}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400/70">
      <CheckCircle2 className="h-3 w-3" />
      {label}
    </span>
  );
}

export function VerdictCard({
  verdict,
}: {
  verdict: Verdict;
}): React.ReactNode {
  const style = VERDICT_STYLES[verdict.verdict] ?? VERDICT_STYLES.CAUTION;
  const { Icon } = style;

  const riskColor =
    verdict.riskScore >= 70
      ? "text-red-400"
      : verdict.riskScore >= 40
        ? "text-amber-400"
        : "text-emerald-400";

  return (
    <div
      className={`rounded-xl border ${style.border} bg-[#111827] ${style.hoverBg} p-4 flex flex-col gap-3 transition-all duration-200 hover:-translate-y-0.5`}
    >
      {/* Header: icon + badge + token info + time */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <Icon className={`h-4 w-4 shrink-0 ${style.text}`} />
          <span
            className={`inline-flex items-center rounded-md ${style.bg} px-2 py-0.5 text-[11px] font-semibold ${style.text} ring-1 ring-inset ring-current/20`}
          >
            {verdict.verdict}
          </span>
          <span className="text-sm font-medium text-white truncate">
            {verdict.tokenName}
          </span>
          <span className="text-xs text-slate-500 shrink-0">
            ({verdict.tokenSymbol})
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0 ml-2">
          <Clock className="h-3 w-3 text-slate-600" />
          <span className="text-[11px] text-slate-500">
            {getTimeAgo(verdict.timestamp)}
          </span>
        </div>
      </div>

      {/* Address */}
      <span className="text-xs text-slate-600 font-mono">
        {verdict.token.slice(0, 6)}...{verdict.token.slice(-4)}
      </span>

      {/* Risk checks */}
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        <RiskCheck label="Honeypot" isRisk={verdict.isHoneypot} />
        <RiskCheck label="Mint" isRisk={verdict.hasMint} />
        <RiskCheck label="Proxy" isRisk={verdict.isProxy} />
        {verdict.buyTax > 5 && (
          <span className="inline-flex items-center gap-1 text-[11px] text-red-400">
            <AlertTriangle className="h-3 w-3" />
            Buy tax {verdict.buyTax}%
          </span>
        )}
        {verdict.sellTax > 5 && (
          <span className="inline-flex items-center gap-1 text-[11px] text-red-400">
            <AlertTriangle className="h-3 w-3" />
            Sell tax {verdict.sellTax}%
          </span>
        )}
      </div>

      {/* Risk score progress bar + liquidity */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1">
          <span className="text-[11px] text-slate-500">Risk:</span>
          <div className="flex-1 h-1.5 rounded-full bg-slate-800 overflow-hidden">
            <div
              className={`h-full rounded-full ${style.barColor} transition-all duration-500`}
              style={{ width: `${Math.min(verdict.riskScore, 100)}%` }}
            />
          </div>
          <span
            className={`text-xs font-bold tabular-nums ${riskColor}`}
          >
            {verdict.riskScore}
          </span>
        </div>
        <div className="shrink-0">
          <span className="text-[11px] text-slate-600">Liq </span>
          <span className="text-xs text-slate-300 tabular-nums">
            {formatUsd(verdict.liquidityUsd)}
          </span>
        </div>
      </div>

      {/* Bottom: price, LP invested, tx link */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-800/50 text-xs">
        <div className="flex items-center gap-3">
          <div>
            <span className="text-slate-600">Price </span>
            <span className="text-slate-300 tabular-nums">
              {formatUsd(verdict.priceUsd)}
            </span>
          </div>
          {verdict.lpInvested && (
            <div className="flex items-center gap-1">
              <Coins className="h-3 w-3 text-emerald-500" />
              <span className="text-emerald-400 tabular-nums">
                {verdict.lpInvested}
              </span>
            </div>
          )}
        </div>
        {verdict.txHash && (
          <a
            href={`https://www.oklink.com/xlayer/tx/${verdict.txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-cyan-400 hover:text-cyan-300 transition-colors"
          >
            <span>tx</span>
            <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>
    </div>
  );
}
