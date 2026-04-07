"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchTopTraders, fetchTokenTrades, truncAddr, timeAgo, formatUsd } from "../lib/api";

export function TabTraders({ address }: { address: string }): React.ReactNode {
  const { data: tradersData } = useQuery({
    queryKey: ["traders-full", address],
    queryFn: () => fetchTopTraders(address),
  });

  const { data: tradesData } = useQuery({
    queryKey: ["trades", address],
    queryFn: () => fetchTokenTrades(address, 20),
  });

  const traders = Array.isArray(tradersData?.data) ? (tradersData.data as Record<string, unknown>[]) : [];
  const trades = Array.isArray(tradesData?.data) ? (tradesData.data as Record<string, unknown>[]) : [];

  return (
    <div className="py-5 space-y-6">
      <div>
        <div className="text-[10px] font-medium text-[#52525b] uppercase tracking-wider mb-2">Top Traders</div>
        <table className="w-full text-[11px] font-mono">
          <thead>
            <tr className="text-[#52525b] text-left border-b border-white/[0.06]">
              <th className="pb-1.5 font-medium text-[10px] uppercase">Address</th>
              <th className="pb-1.5 font-medium text-[10px] uppercase text-right">Total PnL</th>
              <th className="pb-1.5 font-medium text-[10px] uppercase text-right hidden sm:table-cell">Realized</th>
              <th className="pb-1.5 font-medium text-[10px] uppercase text-right hidden sm:table-cell">Unrealized</th>
              <th className="pb-1.5 font-medium text-[10px] uppercase text-right">Hold %</th>
            </tr>
          </thead>
          <tbody>
            {traders.map((t, i) => {
              const totalPnl = Number(t.totalPnlUsd ?? t.realizedPnlUsd ?? 0);
              const realized = Number(t.realizedPnlUsd ?? 0);
              const unrealized = Number(t.unrealizedPnlUsd ?? 0);
              return (
                <tr key={i} className="border-b border-white/[0.03]">
                  <td className="py-1.5 text-[#52525b]">{truncAddr(String(t.holderWalletAddress ?? ""))}</td>
                  <td className={`py-1.5 text-right ${totalPnl >= 0 ? "text-[#34d399]" : "text-[#ef4444]"}`}>
                    {totalPnl >= 0 ? "+" : ""}${Math.abs(totalPnl).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </td>
                  <td className={`py-1.5 text-right hidden sm:table-cell ${realized >= 0 ? "text-[#34d399]" : "text-[#ef4444]"}`}>
                    {realized >= 0 ? "+" : ""}${Math.abs(realized).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </td>
                  <td className={`py-1.5 text-right hidden sm:table-cell ${unrealized >= 0 ? "text-[#34d399]" : "text-[#ef4444]"}`}>
                    {unrealized >= 0 ? "+" : ""}${Math.abs(unrealized).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </td>
                  <td className="py-1.5 text-right text-[#a1a1aa]">
                    {t.holdPercent ? `${Number(t.holdPercent).toFixed(2)}%` : "—"}
                  </td>
                </tr>
              );
            })}
            {traders.length === 0 && <tr><td colSpan={5} className="py-4 text-[#52525b]">No trader data.</td></tr>}
          </tbody>
        </table>
      </div>
      <div>
        <div className="text-[10px] font-medium text-[#52525b] uppercase tracking-wider mb-2">Recent Trades</div>
        <table className="w-full text-[11px] font-mono">
          <thead>
            <tr className="text-[#52525b] text-left border-b border-white/[0.06]">
              <th className="pb-1.5 font-medium text-[10px] uppercase">Type</th>
              <th className="pb-1.5 font-medium text-[10px] uppercase">Address</th>
              <th className="pb-1.5 font-medium text-[10px] uppercase hidden sm:table-cell">DEX</th>
              <th className="pb-1.5 font-medium text-[10px] uppercase text-right">Volume</th>
              <th className="pb-1.5 font-medium text-[10px] uppercase text-right hidden sm:table-cell">Price</th>
              <th className="pb-1.5 font-medium text-[10px] uppercase text-right">Time</th>
            </tr>
          </thead>
          <tbody>
            {trades.map((t, i) => {
              const isBuy = String(t.type ?? "").toLowerCase().includes("buy");
              return (
                <tr key={i} className="border-b border-white/[0.03]">
                  <td className={`py-1.5 ${isBuy ? "text-[#34d399]" : "text-[#ef4444]"}`}>{isBuy ? "BUY" : "SELL"}</td>
                  <td className="py-1.5 text-[#52525b]">{truncAddr(String(t.userAddress ?? ""))}</td>
                  <td className="py-1.5 text-[#52525b] hidden sm:table-cell">{String(t.dexName ?? "—")}</td>
                  <td className="py-1.5 text-right text-[#a1a1aa]">{t.volume ? formatUsd(Number(t.volume)) : "—"}</td>
                  <td className="py-1.5 text-right text-[#a1a1aa] hidden sm:table-cell">{t.price ? formatUsd(Number(t.price)) : "—"}</td>
                  <td className="py-1.5 text-right text-[#52525b]">{t.time ? timeAgo(Number(t.time)) : "—"}</td>
                </tr>
              );
            })}
            {trades.length === 0 && <tr><td colSpan={6} className="py-4 text-[#52525b]">No trade data.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
