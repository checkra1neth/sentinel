"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchTokenHolders, fetchClusterHolders, truncAddr, STALE_NORMAL, REFETCH_SLOW } from "../lib/api";

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

export function TabHolders({ address, chainId }: { address: string; chainId?: number }): React.ReactNode {
  const { data: holdersData } = useQuery({
    queryKey: ["holders-full", address, chainId],
    queryFn: () => fetchTokenHolders(address, undefined, chainId),
    staleTime: STALE_NORMAL,
    refetchInterval: REFETCH_SLOW,
  });

  const { data: clusterData } = useQuery({
    queryKey: ["cluster-holders", address, chainId],
    queryFn: () => fetchClusterHolders(address, "3", chainId),
    staleTime: STALE_NORMAL,
    refetchInterval: REFETCH_SLOW,
  });

  const holders = Array.isArray(holdersData?.data) ? (holdersData.data as Record<string, unknown>[]) : [];
  const clusterHolders = Array.isArray(clusterData?.data) ? (clusterData.data as Record<string, unknown>[]) : [];

  return (
    <div className="py-5">
      <div className="text-[10px] font-medium text-[#52525b] uppercase tracking-wider mb-2">All Holders ({holders.length})</div>
      <table className="w-full text-[11px] font-mono">
        <thead>
          <tr className="text-[#52525b] text-left border-b border-white/[0.06]">
            <th className="pb-1.5 font-medium text-[10px] uppercase">#</th>
            <th className="pb-1.5 font-medium text-[10px] uppercase">Address</th>
            <th className="pb-1.5 font-medium text-[10px] uppercase">Tag</th>
            <th className="pb-1.5 font-medium text-[10px] uppercase text-right">Balance</th>
            <th className="pb-1.5 font-medium text-[10px] uppercase text-right">%</th>
          </tr>
        </thead>
        <tbody>
          {holders.map((h, i) => (
            <tr key={i} className="border-b border-white/[0.03]">
              <td className="py-1.5 text-[#52525b]">{i + 1}</td>
              <td className="py-1.5 text-[#52525b]">{truncAddr(String(h.holderWalletAddress ?? h.holderAddress ?? h.address ?? ""))}</td>
              <td className="py-1.5"><span className={`inline-block px-1 py-px rounded text-[9px] font-medium ${TAG_STYLE[String(h.tag ?? "")] ?? "text-[#52525b] bg-white/[0.04]"}`}>{tagLabel(String(h.tag ?? ""))}</span></td>
              <td className="py-1.5 text-right text-[#a1a1aa]">{String(h.holdAmount ?? h.amount ?? h.balance ?? "—")}</td>
              <td className="py-1.5 text-right text-[#a1a1aa]">{String(h.holdPercent ?? h.valuePercent ?? h.percent ?? "—")}</td>
            </tr>
          ))}
          {holders.length === 0 && <tr><td colSpan={5} className="py-4 text-[#52525b]">No holder data available.</td></tr>}
        </tbody>
      </table>
      {clusterHolders.length > 0 && (
        <div className="mt-6">
          <div className="text-[10px] font-medium text-[#52525b] uppercase tracking-wider mb-2">Cluster Top Holders</div>
          <table className="w-full text-[11px] font-mono">
            <thead>
              <tr className="text-[#52525b] text-left border-b border-white/[0.06]">
                <th className="pb-1.5 font-medium text-[10px] uppercase">Address</th>
                <th className="pb-1.5 font-medium text-[10px] uppercase">Cluster</th>
                <th className="pb-1.5 font-medium text-[10px] uppercase text-right">Rank</th>
              </tr>
            </thead>
            <tbody>
              {clusterHolders.map((c, i) => (
                <tr key={i} className="border-b border-white/[0.03]">
                  <td className="py-1.5 text-[#52525b]">{truncAddr(String(c.address ?? c.holderAddress ?? ""))}</td>
                  <td className="py-1.5 text-[#a1a1aa]">{String(c.clusterId ?? c.clusterTag ?? "—")}</td>
                  <td className="py-1.5 text-right text-[#a1a1aa]">{String(c.addressRank ?? c.rank ?? "—")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
