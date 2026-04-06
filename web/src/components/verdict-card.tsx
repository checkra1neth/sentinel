"use client";

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

const VERDICT_STYLES: Record<
  string,
  { bg: string; text: string; border: string; icon: string }
> = {
  SAFE: {
    bg: "bg-emerald-500/10",
    text: "text-emerald-400",
    border: "border-emerald-500/30",
    icon: "\u2705",
  },
  CAUTION: {
    bg: "bg-yellow-500/10",
    text: "text-yellow-400",
    border: "border-yellow-500/30",
    icon: "\u26A0\uFE0F",
  },
  DANGEROUS: {
    bg: "bg-red-500/10",
    text: "text-red-400",
    border: "border-red-500/30",
    icon: "\uD83D\uDED1",
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

export function VerdictCard({ verdict }: { verdict: Verdict }): React.ReactNode {
  const style = VERDICT_STYLES[verdict.verdict] ?? VERDICT_STYLES.CAUTION;

  return (
    <div
      className={`rounded-xl border ${style.border} bg-gray-900/50 p-5 flex flex-col gap-3`}
    >
      {/* Header: icon + badge + token info + time */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">{style.icon}</span>
          <span
            className={`inline-flex items-center rounded-md ${style.bg} px-2 py-0.5 text-xs font-semibold ${style.text} ring-1 ring-inset ring-current/20`}
          >
            {verdict.verdict}
          </span>
          <span className="text-sm font-semibold text-white">
            {verdict.tokenSymbol}
          </span>
          <span className="text-xs text-gray-500 truncate max-w-[120px]">
            {verdict.tokenName}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">
            {getTimeAgo(verdict.timestamp)}
          </span>
        </div>
      </div>

      {/* Risk score + address */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">Risk:</span>
          <span
            className={`text-sm font-bold ${
              verdict.riskScore >= 70
                ? "text-red-400"
                : verdict.riskScore >= 40
                  ? "text-yellow-400"
                  : "text-emerald-400"
            }`}
          >
            {verdict.riskScore}/100
          </span>
        </div>
        <span className="text-xs text-gray-600 font-mono">
          {verdict.token.slice(0, 6)}...{verdict.token.slice(-4)}
        </span>
      </div>

      {/* Risk tags */}
      {verdict.risks.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {verdict.risks.map((risk) => (
            <span
              key={risk}
              className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-gray-800 text-gray-400 ring-1 ring-gray-700"
            >
              {risk}
            </span>
          ))}
        </div>
      )}

      {/* Bottom: price, liquidity, LP invested, tx link */}
      <div className="flex items-center justify-between pt-2 border-t border-gray-800 text-xs">
        <div className="flex items-center gap-3">
          <div>
            <span className="text-gray-600">Price </span>
            <span className="text-gray-300">{formatUsd(verdict.priceUsd)}</span>
          </div>
          <div>
            <span className="text-gray-600">Liq </span>
            <span className="text-gray-300">
              {formatUsd(verdict.liquidityUsd)}
            </span>
          </div>
          {verdict.lpInvested && (
            <div>
              <span className="text-gray-600">LP </span>
              <span className="text-emerald-400">{verdict.lpInvested}</span>
            </div>
          )}
        </div>
        {verdict.txHash && (
          <a
            href={`https://www.oklink.com/xlayer/tx/${verdict.txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-emerald-500 hover:text-emerald-400 underline"
          >
            tx
          </a>
        )}
      </div>
    </div>
  );
}
