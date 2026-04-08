"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchDefiProducts, fetchYields, formatUsd } from "../lib/api";

interface DefiProductsProps {
  onDeposit: (investmentId: string, poolName: string) => void;
}

interface Pool {
  investmentId: string;
  name: string;
  platform: string;
  apy: number;
  tvl: number;
}

export function DefiProducts({ onDeposit }: DefiProductsProps): React.ReactNode {
  const { data: productsData, isLoading: productsLoading } = useQuery({
    queryKey: ["defi-products"],
    queryFn: () => fetchDefiProducts(),
  });

  const { data: yieldsData } = useQuery({
    queryKey: ["yields"],
    queryFn: () => fetchYields(),
  });

  const pools = useMemo((): Pool[] => {
    const raw = productsData as Record<string, unknown> | null;
    const products = (raw?.products ?? raw?.data ?? []) as Record<string, unknown>[];

    const mapped: Pool[] = products.map((p) => ({
      investmentId: String(p.investmentId ?? p.id ?? ""),
      name: String(p.name ?? p.poolName ?? ""),
      platform: String(p.platform ?? p.protocol ?? ""),
      apy: Number(p.apy ?? p.apr ?? 0),
      tvl: Number(p.tvl ?? p.totalValueLocked ?? 0),
    }));

    // Merge yield data as comparison
    const yieldsArr = (yieldsData as Record<string, unknown>)?.pools as Record<string, unknown>[] | undefined;
    if (yieldsArr) {
      for (const y of yieldsArr) {
        const id = String(y.investmentId ?? y.pool ?? "");
        if (!mapped.some((p) => p.investmentId === id)) {
          mapped.push({
            investmentId: id,
            name: String(y.name ?? y.symbol ?? ""),
            platform: String(y.project ?? y.platform ?? ""),
            apy: Number(y.apy ?? y.apyBase ?? 0),
            tvl: Number(y.tvlUsd ?? y.tvl ?? 0),
          });
        }
      }
    }

    // Sort by APY descending
    mapped.sort((a, b) => b.apy - a.apy);
    return mapped;
  }, [productsData, yieldsData]);

  if (productsLoading) {
    return (
      <div className="py-12 text-center text-xs font-mono text-[#52525b]">
        Loading DeFi products...
      </div>
    );
  }

  if (pools.length === 0) {
    return (
      <div className="py-12 text-center text-xs font-mono text-[#52525b]">
        No DeFi products available
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs font-mono">
        <thead>
          <tr className="border-b border-white/[0.06] text-[#52525b]">
            <th className="text-left py-2.5 pr-4 font-medium">Pool Name</th>
            <th className="text-left py-2.5 pr-4 font-medium">Platform</th>
            <th className="text-right py-2.5 pr-4 font-medium">APY</th>
            <th className="text-right py-2.5 pr-4 font-medium">TVL</th>
            <th className="text-right py-2.5 font-medium" />
          </tr>
        </thead>
        <tbody>
          {pools.map((pool) => (
            <tr
              key={pool.investmentId}
              className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors"
            >
              <td className="py-2.5 pr-4 text-[#fafafa]">{pool.name}</td>
              <td className="py-2.5 pr-4 text-[#a1a1aa]">{pool.platform}</td>
              <td className="py-2.5 pr-4 text-right text-emerald-400">
                {pool.apy.toFixed(2)}%
              </td>
              <td className="py-2.5 pr-4 text-right text-[#a1a1aa]">
                {formatUsd(pool.tvl)}
              </td>
              <td className="py-2.5 text-right">
                <button
                  type="button"
                  onClick={() => onDeposit(pool.investmentId, pool.name)}
                  className="px-3 py-1 rounded text-[10px] font-semibold bg-[#06b6d4]/10 text-[#06b6d4] border border-[#06b6d4]/20 hover:bg-[#06b6d4]/20 transition-colors cursor-pointer"
                >
                  Deposit
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
