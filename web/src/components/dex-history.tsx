"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchDexHistory, formatUsd, timeAgo, truncAddr } from "../lib/api";

interface DexTrade {
  txHash: string;
  txType: string;
  tokenSymbol: string;
  amount: string;
  priceUsd: number;
  timestamp: number;
}

const TX_TYPES = ["All", "BUY", "SELL"] as const;
type TxTypeFilter = (typeof TX_TYPES)[number];

export function DexHistory(): React.ReactNode {
  const [txFilter, setTxFilter] = useState<TxTypeFilter>("All");

  const { data } = useQuery({
    queryKey: ["dex-history", txFilter],
    queryFn: () =>
      fetchDexHistory({
        limit: 50,
        txType: txFilter === "All" ? undefined : txFilter,
      }),
    refetchInterval: 15_000,
  });

  const trades: DexTrade[] = Array.isArray(data?.transactions ?? data?.trades ?? data?.data)
    ? (
        (data?.transactions ?? data?.trades ?? data?.data) as Record<string, unknown>[]
      ).map((t) => ({
        txHash: String(t.txHash ?? t.transactionHash ?? ""),
        txType: String(t.txType ?? t.type ?? t.side ?? "").toUpperCase(),
        tokenSymbol: String(t.tokenSymbol ?? t.symbol ?? "???"),
        amount: String(t.amount ?? t.quantity ?? "0"),
        priceUsd: Number(t.priceUsd ?? t.price ?? 0),
        timestamp: Number(t.timestamp ?? t.blockTimestamp ?? Date.now()),
      }))
    : [];

  return (
    <div className="py-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-[10px] font-medium text-[#52525b] uppercase tracking-wider">DEX History</div>
        <select
          value={txFilter}
          onChange={(e) => setTxFilter(e.target.value as TxTypeFilter)}
          className="bg-transparent border border-white/[0.06] rounded text-[10px] text-[#a1a1aa] font-mono px-2 py-0.5 outline-none focus:border-white/[0.12]"
        >
          {TX_TYPES.map((t) => (
            <option key={t} value={t} className="bg-[#09090b]">
              {t}
            </option>
          ))}
        </select>
      </div>
      {trades.length === 0 ? (
        <p className="text-xs text-[#52525b] font-mono">No DEX transactions found.</p>
      ) : (
        <table className="w-full text-xs font-mono">
          <thead>
            <tr className="text-left border-b border-white/[0.06]">
              <th className="pb-2 font-medium text-[10px] text-[#52525b] uppercase tracking-wider">Type</th>
              <th className="pb-2 font-medium text-[10px] text-[#52525b] uppercase tracking-wider">Token</th>
              <th className="pb-2 font-medium text-[10px] text-[#52525b] uppercase tracking-wider text-right">Amount</th>
              <th className="pb-2 font-medium text-[10px] text-[#52525b] uppercase tracking-wider text-right hidden sm:table-cell">Price</th>
              <th className="pb-2 font-medium text-[10px] text-[#52525b] uppercase tracking-wider text-right">Time</th>
              <th className="pb-2 font-medium text-[10px] text-[#52525b] uppercase tracking-wider text-right hidden sm:table-cell">Tx</th>
            </tr>
          </thead>
          <tbody>
            {trades.map((t, i) => {
              const isBuy = t.txType === "BUY";
              return (
                <tr key={`${t.txHash}-${i}`} className="border-b border-white/[0.03]">
                  <td className="py-2">
                    <span
                      className="inline-block px-1.5 py-px rounded text-[10px] font-medium"
                      style={{
                        color: isBuy ? "#34d399" : "#ef4444",
                        backgroundColor: isBuy ? "rgba(52,211,153,0.08)" : "rgba(239,68,68,0.08)",
                      }}
                    >
                      {t.txType || "SWAP"}
                    </span>
                  </td>
                  <td className="py-2 text-[#fafafa]">{t.tokenSymbol}</td>
                  <td className="py-2 text-right text-[#a1a1aa]">{t.amount}</td>
                  <td className="py-2 text-right text-[#a1a1aa] hidden sm:table-cell">
                    {t.priceUsd ? formatUsd(t.priceUsd) : "--"}
                  </td>
                  <td className="py-2 text-right text-[#52525b]">{timeAgo(t.timestamp)}</td>
                  <td className="py-2 text-right hidden sm:table-cell">
                    {t.txHash ? (
                      <a
                        href={`https://www.oklink.com/xlayer/tx/${t.txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#52525b] hover:text-[#a1a1aa] transition-colors"
                      >
                        {truncAddr(t.txHash)}
                      </a>
                    ) : (
                      <span className="text-[#52525b]">--</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
