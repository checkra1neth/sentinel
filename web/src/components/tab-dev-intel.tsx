"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchDevInfo, fetchSimilarTokens, fetchBundleInfo, fetchApedWallets, truncAddr, timeAgo } from "../lib/api";

function KV({ label, value }: { label: string; value: React.ReactNode }): React.ReactNode {
  return (
    <div className="flex justify-between py-1.5 text-xs border-b border-white/[0.03]">
      <span className="text-[#52525b]">{label}</span>
      <span className="font-mono text-[#a1a1aa]">{value}</span>
    </div>
  );
}

export function TabDevIntel({ address }: { address: string }): React.ReactNode {
  const { data: devData } = useQuery({ queryKey: ["dev-info", address], queryFn: () => fetchDevInfo(address) });
  const { data: similarData } = useQuery({ queryKey: ["similar-tokens", address], queryFn: () => fetchSimilarTokens(address) });
  const { data: bundleData } = useQuery({ queryKey: ["bundle-info", address], queryFn: () => fetchBundleInfo(address) });
  const { data: apedData } = useQuery({ queryKey: ["aped-wallets", address], queryFn: () => fetchApedWallets(address) });

  const dev = (devData?.data ?? devData) as Record<string, unknown> | undefined;
  const devInfo = (dev?.devLaunchedInfo ?? dev) as Record<string, unknown> | undefined;
  const similar = Array.isArray(similarData?.data) ? (similarData.data as Record<string, unknown>[]) : [];
  const bundle = (bundleData?.data ?? bundleData) as Record<string, unknown> | undefined;
  const aped = Array.isArray(apedData?.data) ? (apedData.data as Record<string, unknown>[]) : [];

  const rugCount = Number(devInfo?.rugPullCount ?? 0);

  return (
    <div className="py-5 space-y-6">
      <div>
        <div className="text-[10px] font-medium text-[#52525b] uppercase tracking-wider mb-2">
          Developer Info
          {rugCount > 2 && <span className="ml-2 text-[#ef4444] text-[9px] font-mono">SERIAL LAUNCHER</span>}
        </div>
        <KV label="Rug Pull Count" value={<span className={rugCount > 0 ? "text-[#ef4444]" : "text-[#34d399]"}>{rugCount}</span>} />
        <KV label="Total Tokens Launched" value={String(devInfo?.totalTokens ?? devInfo?.tokenCount ?? "—")} />
        <KV label="Migrated Count" value={String(devInfo?.migratedCount ?? "—")} />
        <KV label="Holding Info" value={String(devInfo?.holdingInfo ?? devInfo?.holding ?? "—")} />
      </div>
      {similar.length > 0 && (
        <div>
          <div className="text-[10px] font-medium text-[#52525b] uppercase tracking-wider mb-2">Similar Tokens by Dev</div>
          <table className="w-full text-[11px] font-mono">
            <thead><tr className="text-[#52525b] text-left border-b border-white/[0.06]">
              <th className="pb-1.5 font-medium text-[10px] uppercase">Token</th>
              <th className="pb-1.5 font-medium text-[10px] uppercase">Status</th>
              <th className="pb-1.5 font-medium text-[10px] uppercase text-right">Created</th>
            </tr></thead>
            <tbody>
              {similar.map((s, i) => (
                <tr key={i} className="border-b border-white/[0.03]">
                  <td className="py-1.5 text-[#a1a1aa]">{String(s.tokenSymbol ?? s.symbol ?? s.name ?? "—")}</td>
                  <td className="py-1.5 text-[#52525b]">{String(s.stage ?? s.status ?? "—")}</td>
                  <td className="py-1.5 text-right text-[#52525b]">{s.timestamp ? timeAgo(Number(s.timestamp)) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {bundle && (
        <div>
          <div className="text-[10px] font-medium text-[#52525b] uppercase tracking-wider mb-2">Bundle Info</div>
          <div className="text-[11px] font-mono text-[#a1a1aa] whitespace-pre-wrap">{JSON.stringify(bundle, null, 2).slice(0, 500)}</div>
        </div>
      )}
      {aped.length > 0 && (
        <div>
          <div className="text-[10px] font-medium text-[#52525b] uppercase tracking-wider mb-2">Aped Wallets</div>
          <table className="w-full text-[11px] font-mono">
            <thead><tr className="text-[#52525b] text-left border-b border-white/[0.06]">
              <th className="pb-1.5 font-medium text-[10px] uppercase">Address</th>
              <th className="pb-1.5 font-medium text-[10px] uppercase text-right">Amount</th>
            </tr></thead>
            <tbody>
              {aped.map((a, i) => (
                <tr key={i} className="border-b border-white/[0.03]">
                  <td className="py-1.5 text-[#52525b]">{truncAddr(String(a.address ?? a.walletAddress ?? ""))}</td>
                  <td className="py-1.5 text-right text-[#a1a1aa]">{String(a.amount ?? a.value ?? "—")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
