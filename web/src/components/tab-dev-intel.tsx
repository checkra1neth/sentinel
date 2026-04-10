"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchDevInfo, fetchSimilarTokens, fetchBundleInfo, fetchApedWallets, truncAddr, timeAgo, formatUsd, STALE_NORMAL, REFETCH_SLOW } from "../lib/api";

function KV({ label, value }: { label: string; value: React.ReactNode }): React.ReactNode {
  return (
    <div className="flex justify-between py-1.5 text-xs border-b border-white/[0.03]">
      <span className="text-[#52525b]">{label}</span>
      <span className="font-mono text-[#a1a1aa]">{value}</span>
    </div>
  );
}

export function TabDevIntel({ address }: { address: string }): React.ReactNode {
  const { data: devData } = useQuery({ queryKey: ["dev-info", address], queryFn: () => fetchDevInfo(address), staleTime: STALE_NORMAL, refetchInterval: REFETCH_SLOW });
  const { data: similarData } = useQuery({ queryKey: ["similar-tokens", address], queryFn: () => fetchSimilarTokens(address), staleTime: STALE_NORMAL, refetchInterval: REFETCH_SLOW });
  const { data: bundleData } = useQuery({ queryKey: ["bundle-info", address], queryFn: () => fetchBundleInfo(address), staleTime: STALE_NORMAL, refetchInterval: REFETCH_SLOW });
  const { data: apedData } = useQuery({ queryKey: ["aped-wallets", address], queryFn: () => fetchApedWallets(address), staleTime: STALE_NORMAL, refetchInterval: REFETCH_SLOW });

  const dev = (devData?.data ?? devData) as Record<string, unknown> | undefined;
  const devInfo = (dev?.devLaunchedInfo ?? dev) as Record<string, unknown> | undefined;
  const similar = Array.isArray(similarData?.data) ? (similarData.data as Record<string, unknown>[]) : [];
  const bundle = (bundleData?.data ?? bundleData) as Record<string, unknown> | undefined;
  const aped = Array.isArray(apedData?.data) ? (apedData.data as Record<string, unknown>[]) : [];

  const rugCount = Number(devInfo?.rugPullCount ?? 0);

  // Bundle: show structured data, not raw JSON
  const bundleAmount = String(bundle?.bundledTokenAmount ?? "");
  const bundleNative = String(bundle?.bundledValueNative ?? "");
  const bundleAth = String(bundle?.bundlerAthPercent ?? "");
  const totalBundlers = String(bundle?.totalBundlers ?? "");
  const hasBundleData = bundleAmount || bundleNative || totalBundlers;

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
      </div>

      {similar.length > 0 && (
        <div>
          <div className="text-[10px] font-medium text-[#52525b] uppercase tracking-wider mb-2">Similar Tokens by Dev</div>
          <table className="w-full text-[11px] font-mono">
            <thead><tr className="text-[#52525b] text-left border-b border-white/[0.06]">
              <th className="pb-1.5 font-medium text-[10px] uppercase">Token</th>
              <th className="pb-1.5 font-medium text-[10px] uppercase text-right">MCap</th>
              <th className="pb-1.5 font-medium text-[10px] uppercase text-right">Created</th>
            </tr></thead>
            <tbody>
              {similar.map((s, i) => (
                <tr key={i} className="border-b border-white/[0.03]">
                  <td className="py-1.5 text-[#a1a1aa]">{String(s.tokenSymbol ?? "—")}</td>
                  <td className="py-1.5 text-right text-[#a1a1aa]">{s.marketCapUsd ? formatUsd(Number(s.marketCapUsd)) : "—"}</td>
                  <td className="py-1.5 text-right text-[#52525b]">{s.createdTimestamp ? timeAgo(Number(s.createdTimestamp)) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {hasBundleData && (
        <div>
          <div className="text-[10px] font-medium text-[#52525b] uppercase tracking-wider mb-2">Bundle Info</div>
          <KV label="Total Bundlers" value={totalBundlers || "—"} />
          <KV label="Bundled Token Amount" value={bundleAmount || "—"} />
          <KV label="Bundled Native Value" value={bundleNative || "—"} />
          <KV label="Bundler ATH %" value={bundleAth ? `${bundleAth}%` : "—"} />
        </div>
      )}

      {aped.length > 0 && (
        <div>
          <div className="text-[10px] font-medium text-[#52525b] uppercase tracking-wider mb-2">Aped Wallets</div>
          <table className="w-full text-[11px] font-mono">
            <thead><tr className="text-[#52525b] text-left border-b border-white/[0.06]">
              <th className="pb-1.5 font-medium text-[10px] uppercase">Address</th>
              <th className="pb-1.5 font-medium text-[10px] uppercase">Type</th>
              <th className="pb-1.5 font-medium text-[10px] uppercase text-right">Holding</th>
              <th className="pb-1.5 font-medium text-[10px] uppercase text-right">PnL</th>
            </tr></thead>
            <tbody>
              {aped.map((a, i) => {
                const pnl = Number(a.totalPnl ?? 0);
                return (
                  <tr key={i} className="border-b border-white/[0.03]">
                    <td className="py-1.5 text-[#52525b]">{truncAddr(String(a.walletAddress ?? ""))}</td>
                    <td className="py-1.5 text-[#a1a1aa]">{String(a.walletType ?? "—")}</td>
                    <td className="py-1.5 text-right text-[#a1a1aa]">{a.holdingUsd ? formatUsd(Number(a.holdingUsd)) : "—"}</td>
                    <td className={`py-1.5 text-right ${pnl >= 0 ? "text-[#34d399]" : "text-[#ef4444]"}`}>
                      {pnl !== 0 ? `${pnl >= 0 ? "+" : ""}${formatUsd(Math.abs(pnl))}` : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
