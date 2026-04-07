"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchTopTraders, fetchTokenTrades, truncAddr, timeAgo, formatUsd } from "../lib/api";

const TAG_STYLE: Record<string, string> = {
  "3": "text-[#a78bfa] bg-[rgba(167,139,250,0.08)]",
  "4": "text-[#34d399] bg-[rgba(52,211,153,0.08)]",
  "1": "text-[#f59e0b] bg-[rgba(245,158,11,0.08)]",
};

function tagLabel(tag: string | number): string {
  const t = String(tag);
  if (t === "3") return "smart $";
  if (t === "4") return "whale";
  if (t === "1") return "kol";
  return "normal";
}

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
              <th className="pb-1.5 font-medium text-[10px] uppercase">Tag</th>
              <th className="pb-1.5 font-medium text-[10px] uppercase text-right">PnL</th>
              <th className="pb-1.5 font-medium text-[10px] uppercase text-right hidden sm:table-cell">Buy Vol</th>
              <th className="pb-1.5 font-medium text-[10px] uppercase text-right hidden sm:table-cell">Sell Vol</th>
              <th className="pb-1.5 font-medium text-[10px] uppercase text-right">Trades</th>
            </tr>
          </thead>
          <tbody>
            {traders.map((t, i) => {
              const pnl = Number(t.pnl ?? t.profit ?? 0);
              return (
                <tr key={i} className="border-b border-white/[0.03]">
                  <td className="py-1.5 text-[#52525b]">{truncAddr(String(t.traderAddress ?? t.address ?? ""))}</td>
                  <td className="py-1.5"><span className={`inline-block px-1 py-px rounded text-[9px] font-medium ${TAG_STYLE[String(t.tag ?? "")] ?? "text-[#52525b] bg-white/[0.04]"}`}>{tagLabel(String(t.tag ?? ""))}</span></td>
                  <td className={`py-1.5 text-right ${pnl >= 0 ? "text-[#34d399]" : "text-[#ef4444]"}`}>{pnl >= 0 ? "+" : ""}${Math.abs(pnl).toLocaleString()}</td>
                  <td className="py-1.5 text-right text-[#a1a1aa] hidden sm:table-cell">{String(t.buyVolume ?? "—")}</td>
                  <td className="py-1.5 text-right text-[#a1a1aa] hidden sm:table-cell">{String(t.sellVolume ?? "—")}</td>
                  <td className="py-1.5 text-right text-[#a1a1aa]">{String(t.tradeCount ?? t.txCount ?? "—")}</td>
                </tr>
              );
            })}
            {traders.length === 0 && <tr><td colSpan={6} className="py-4 text-[#52525b]">No trader data.</td></tr>}
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
              <th className="pb-1.5 font-medium text-[10px] uppercase text-right">Amount</th>
              <th className="pb-1.5 font-medium text-[10px] uppercase text-right hidden sm:table-cell">Price</th>
              <th className="pb-1.5 font-medium text-[10px] uppercase text-right">Time</th>
            </tr>
          </thead>
          <tbody>
            {trades.map((t, i) => {
              const isBuy = String(t.type ?? t.side ?? "").toLowerCase().includes("buy");
              return (
                <tr key={i} className="border-b border-white/[0.03]">
                  <td className={`py-1.5 ${isBuy ? "text-[#34d399]" : "text-[#ef4444]"}`}>{isBuy ? "BUY" : "SELL"}</td>
                  <td className="py-1.5 text-[#52525b]">{truncAddr(String(t.traderAddress ?? t.address ?? ""))}</td>
                  <td className="py-1.5 text-right text-[#a1a1aa]">{t.amount ? formatUsd(Number(t.amount)) : "—"}</td>
                  <td className="py-1.5 text-right text-[#a1a1aa] hidden sm:table-cell">{t.price ? formatUsd(Number(t.price)) : "—"}</td>
                  <td className="py-1.5 text-right text-[#52525b]">{t.timestamp ? timeAgo(Number(t.timestamp)) : "—"}</td>
                </tr>
              );
            })}
            {trades.length === 0 && <tr><td colSpan={5} className="py-4 text-[#52525b]">No trade data.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
