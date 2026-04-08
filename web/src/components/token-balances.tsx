"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { fetchManagedPortfolio, formatUsd, REFETCH_NORMAL } from "../lib/api";

interface TokenBalance {
  token: string;
  tokenSymbol: string;
  balanceUsd: number;
  priceChange24h: number;
}

export function TokenBalances(): React.ReactNode {
  const { data } = useQuery({
    queryKey: ["managed-portfolio"],
    queryFn: fetchManagedPortfolio,
    refetchInterval: REFETCH_NORMAL,
  });

  // Backend returns {positions: [...], walletBalances: [...], totalValue: {...}}
  const walletBal = data?.walletBalances as Record<string, unknown>[] | undefined;
  const posArr = data?.positions as Record<string, unknown>[] | undefined;
  const source = Array.isArray(walletBal) && walletBal.length > 0 ? walletBal : posArr;
  const tokens: TokenBalance[] = Array.isArray(source)
    ? source.map((t) => ({
        token: String(t.token ?? t.tokenAddress ?? t.address ?? ""),
        tokenSymbol: String(t.tokenSymbol ?? t.symbol ?? "Unknown"),
        balanceUsd: Number(t.balanceUsd ?? t.valueUsd ?? t.amountInvested ?? 0),
        priceChange24h: Number(t.priceChange24h ?? t.change24h ?? 0),
      }))
    : [];

  if (tokens.length === 0) {
    return (
      <div className="py-4">
        <div className="text-[10px] font-medium text-[#52525b] uppercase tracking-wider mb-3">Token Balances</div>
        <p className="text-xs text-[#52525b] font-mono">No token balances found.</p>
      </div>
    );
  }

  return (
    <div className="py-4">
      <div className="text-[10px] font-medium text-[#52525b] uppercase tracking-wider mb-3">Token Balances</div>
      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
        {tokens.map((t) => {
          const positive = t.priceChange24h >= 0;
          return (
            <Link
              key={t.token}
              href={`/token/${t.token}`}
              className="flex-shrink-0 min-w-[140px] rounded-md border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 hover:bg-white/[0.04] transition-colors"
            >
              <div className="text-xs font-mono font-medium text-[#fafafa]">{t.tokenSymbol}</div>
              <div className="text-sm font-mono text-[#a1a1aa] mt-0.5">{formatUsd(t.balanceUsd)}</div>
              <div
                className="text-[10px] font-mono mt-1"
                style={{ color: positive ? "#34d399" : "#ef4444" }}
              >
                {positive ? "+" : ""}{t.priceChange24h.toFixed(1)}%
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
