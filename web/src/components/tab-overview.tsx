"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchTokenCluster, fetchTokenHolders, fetchTopTraders, truncAddr } from "../lib/api";
import { type Verdict } from "../lib/api";

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

function KVRow({ label, value }: { label: string; value: React.ReactNode }): React.ReactNode {
  return (
    <div className="flex justify-between py-1 text-xs border-b border-white/[0.03]">
      <span className="text-[#52525b]">{label}</span>
      <span className="font-mono text-[#a1a1aa]">{value}</span>
    </div>
  );
}

interface TabOverviewProps {
  address: string;
  verdict: Verdict | null;
}

export function TabOverview({ address, verdict }: TabOverviewProps): React.ReactNode {
  const { data: clusterData } = useQuery({
    queryKey: ["cluster", address],
    queryFn: () => fetchTokenCluster(address),
  });

  const { data: holdersData } = useQuery({
    queryKey: ["holders", address],
    queryFn: () => fetchTokenHolders(address),
  });

  const { data: tradersData } = useQuery({
    queryKey: ["top-traders", address],
    queryFn: () => fetchTopTraders(address),
  });

  const cluster = (clusterData?.data ?? clusterData) as Record<string, unknown> | undefined;
  const holders = Array.isArray(holdersData?.data) ? (holdersData.data as Record<string, unknown>[]).slice(0, 5) : [];
  const traders = Array.isArray(tradersData?.data) ? (tradersData.data as Record<string, unknown>[]).slice(0, 3) : [];

  const riskPct = verdict?.riskScore ?? 0;
  const riskColor = riskPct <= 35 ? "#34d399" : riskPct <= 65 ? "#f59e0b" : "#ef4444";

  return (
    <div className="py-5 grid grid-cols-1 md:grid-cols-2 gap-6">
      <div>
        <div className="mb-5">
          <div className="text-[10px] font-medium text-[#52525b] uppercase tracking-wider mb-2">Risk Breakdown</div>
          <div className="h-1 bg-white/[0.04] rounded-sm mb-1 relative">
            <div className="h-1 rounded-sm absolute top-0 left-0" style={{ width: `${riskPct}%`, background: riskColor }} />
          </div>
          <div className="text-[11px] text-[#52525b] font-mono mb-3">{riskPct} / 100</div>
          <KVRow label="Honeypot" value={<span className={verdict?.isHoneypot ? "text-[#ef4444]" : "text-[#34d399]"}>{verdict?.isHoneypot ? "Yes" : "No"}</span>} />
          <KVRow label="Mintable" value={<span className={verdict?.hasMint ? "text-[#ef4444]" : "text-[#34d399]"}>{verdict?.hasMint ? "Yes" : "No"}</span>} />
          <KVRow label="Proxy" value={verdict?.isProxy ? "Yes" : "No"} />
          <KVRow label="Buy Tax" value={`${verdict?.buyTax ?? 0}%`} />
          <KVRow label="Sell Tax" value={`${verdict?.sellTax ?? 0}%`} />
          <KVRow label="Holder Concentration" value={`${verdict?.holderConcentration ?? 0}%`} />
        </div>
        {cluster?.rugPullPercent != null && (
          <div>
            <div className="text-[10px] font-medium text-[#52525b] uppercase tracking-wider mb-2">Cluster Analysis</div>
            <KVRow label="Rug Pull %" value={`${cluster.rugPullPercent}%`} />
            <KVRow label="New Address %" value={cluster?.holderNewAddressPercent != null ? `${cluster.holderNewAddressPercent}%` : "—"} />
            <KVRow label="Same Fund Source %" value={cluster?.holderSameFundSourcePercent != null ? `${cluster.holderSameFundSourcePercent}%` : "—"} />
          </div>
        )}
      </div>
      <div>
        <div className="mb-5">
          <div className="text-[10px] font-medium text-[#52525b] uppercase tracking-wider mb-2">Top Holders</div>
          <table className="w-full text-[11px] font-mono">
            <thead>
              <tr className="text-[#52525b] text-left border-b border-white/[0.06]">
                <th className="pb-1.5 font-medium text-[10px] uppercase">Address</th>
                <th className="pb-1.5 font-medium text-[10px] uppercase">Tag</th>
                <th className="pb-1.5 font-medium text-[10px] uppercase text-right">Balance</th>
                <th className="pb-1.5 font-medium text-[10px] uppercase text-right">%</th>
              </tr>
            </thead>
            <tbody>
              {holders.map((h, i) => (
                <tr key={i} className="border-b border-white/[0.03]">
                  <td className="py-1.5 text-[#52525b]">{truncAddr(String(h.holderWalletAddress ?? h.holderAddress ?? h.address ?? ""))}</td>
                  <td className="py-1.5">
                    <span className={`inline-block px-1 py-px rounded text-[9px] font-medium ${TAG_STYLE[String(h.tag ?? "")] ?? "text-[#52525b] bg-white/[0.04]"}`}>
                      {tagLabel(String(h.tag ?? ""))}
                    </span>
                  </td>
                  <td className="py-1.5 text-right text-[#a1a1aa]">{String(h.holdAmount ?? h.amount ?? h.balance ?? "—")}</td>
                  <td className="py-1.5 text-right text-[#a1a1aa]">{String(h.holdPercent ?? h.valuePercent ?? h.percent ?? "—")}</td>
                </tr>
              ))}
              {holders.length === 0 && <tr><td colSpan={4} className="py-2 text-[#52525b]">No data</td></tr>}
            </tbody>
          </table>
        </div>
        <div>
          <div className="text-[10px] font-medium text-[#52525b] uppercase tracking-wider mb-2">Top Traders PnL</div>
          <table className="w-full text-[11px] font-mono">
            <thead>
              <tr className="text-[#52525b] text-left border-b border-white/[0.06]">
                <th className="pb-1.5 font-medium text-[10px] uppercase">Address</th>
                <th className="pb-1.5 font-medium text-[10px] uppercase text-right">Total PnL</th>
                <th className="pb-1.5 font-medium text-[10px] uppercase text-right">Hold %</th>
              </tr>
            </thead>
            <tbody>
              {traders.map((t, i) => {
                const pnl = Number(t.totalPnlUsd ?? t.realizedPnlUsd ?? 0);
                return (
                  <tr key={i} className="border-b border-white/[0.03]">
                    <td className="py-1.5 text-[#52525b]">{truncAddr(String(t.holderWalletAddress ?? ""))}</td>
                    <td className={`py-1.5 text-right ${pnl >= 0 ? "text-[#34d399]" : "text-[#ef4444]"}`}>
                      {pnl >= 0 ? "+" : ""}${Math.abs(pnl).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </td>
                    <td className="py-1.5 text-right text-[#a1a1aa]">{t.holdPercent ? `${Number(t.holdPercent).toFixed(2)}%` : "—"}</td>
                  </tr>
                );
              })}
              {traders.length === 0 && <tr><td colSpan={3} className="py-2 text-[#52525b]">No data</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
