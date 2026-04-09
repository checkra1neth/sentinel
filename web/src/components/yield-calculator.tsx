"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { fetchDefiProducts, fetchYields, formatUsd, STALE_NORMAL, REFETCH_SLOW } from "../lib/api";
import { YieldChart } from "./yield-chart";

type Period = "7" | "30" | "90" | "365";
const PERIODS: { key: Period; label: string }[] = [
  { key: "7", label: "7d" },
  { key: "30", label: "30d" },
  { key: "90", label: "90d" },
  { key: "365", label: "1y" },
];

interface Pool {
  investmentId: string;
  name: string;
  platform: string;
  apy: number;
  productType: string;
}

const STAKE_KEYWORDS = ["staking", "stake", "marinade", "solayer", "lido", "rocket pool", "jito", "sanctum"];
const LEND_KEYWORDS = ["aave", "compound", "kamino", "fluid", "morpho", "spark", "yearn", "benqi", "venus", "lending"];
const LP_KEYWORDS = ["uniswap", "sushiswap", "pancakeswap", "curve", "balancer", "raydium", "orca"];

function inferProductType(name: string, platform: string, explicit: unknown): string {
  if (explicit && typeof explicit === "string") return explicit;
  const combined = `${name} ${platform}`.toLowerCase();
  if (LP_KEYWORDS.some((k) => combined.includes(k)) || name.includes("/")) return "DEX_POOL";
  if (STAKE_KEYWORDS.some((k) => combined.includes(k))) return "SINGLE_EARN";
  if (LEND_KEYWORDS.some((k) => combined.includes(k))) return "LENDING";
  return "SINGLE_EARN";
}

export function YieldCalculator(): React.ReactNode {
  const router = useRouter();
  const [amountStr, setAmountStr] = useState("1000");
  const [period, setPeriod] = useState<Period>("30");
  const amount = Number(amountStr) || 0;
  const days = Number(period);

  const { data: productsData, isLoading } = useQuery({
    queryKey: ["defi-products"],
    queryFn: () => fetchDefiProducts(),
    staleTime: STALE_NORMAL,
    refetchInterval: REFETCH_SLOW,
  });

  const { data: yieldsData } = useQuery({
    queryKey: ["yields"],
    queryFn: () => fetchYields(),
    staleTime: STALE_NORMAL,
    refetchInterval: REFETCH_SLOW,
  });

  const pools = useMemo((): Pool[] => {
    const raw = productsData as Record<string, unknown> | null;
    const dataObj = raw?.data as Record<string, unknown> | undefined;
    const list = dataObj?.list ?? raw?.list ?? raw?.products;
    const products = Array.isArray(list) ? (list as Record<string, unknown>[]) : [];

    const mapped: Pool[] = products.map((p) => {
      const name = String(p.name ?? p.poolName ?? "");
      const platform = String(p.platformName ?? p.platform ?? p.protocol ?? "");
      return {
        investmentId: String(p.investmentId ?? p.id ?? ""),
        name,
        platform,
        apy: Number(p.rate ?? p.apy ?? p.apr ?? 0) * (Number(p.rate ?? 0) < 1 ? 100 : 1),
        productType: inferProductType(name, platform, p.investType ?? p.productGroup),
      };
    });

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
            productType: "DEX_POOL",
          });
        }
      }
    }

    mapped.sort((a, b) => b.apy - a.apy);
    return mapped.slice(0, 10);
  }, [productsData, yieldsData]);

  const results = useMemo(() => {
    return pools.map((pool) => {
      const finalValue = amount * Math.pow(1 + pool.apy / 100 / 365, days);
      const returnAmt = finalValue - amount;
      return { ...pool, finalValue, returnAmt };
    });
  }, [pools, amount, days]);

  const chartLines = pools.slice(0, 5).map((p) => ({ name: p.name, apy: p.apy }));

  return (
    <div>
      <div className="flex items-end gap-4 mb-6 flex-wrap">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-[11px] text-[#52525b] font-mono mb-1">Amount (USD)</label>
          <input
            type="text"
            inputMode="decimal"
            placeholder="1000"
            value={amountStr}
            onChange={(e) => setAmountStr(e.target.value)}
            className="w-full bg-white/[0.04] border border-white/[0.06] rounded px-3 py-2 text-sm font-mono text-[#fafafa] placeholder:text-[#52525b] outline-none focus:border-[#06b6d4]/40"
          />
        </div>
        <div className="flex gap-1.5">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={`px-3 py-2 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                period === p.key
                  ? "bg-[#06b6d4]/10 text-[#06b6d4] border border-[#06b6d4]/20"
                  : "bg-white/[0.04] text-[#a1a1aa] border border-white/[0.06] hover:text-[#fafafa]"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {amount > 0 && chartLines.length > 0 && (
        <div className="border border-white/[0.06] rounded-lg p-4 mb-6">
          <YieldChart lines={chartLines} amount={amount} days={days} />
        </div>
      )}

      {isLoading ? (
        <div className="py-12 text-center text-xs font-mono text-[#52525b]">Loading yield data...</div>
      ) : results.length === 0 ? (
        <div className="py-12 text-center text-xs font-mono text-[#52525b]">No yield data available</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="text-left border-b border-white/[0.06]">
                <th className="pb-2 font-medium text-[10px] text-[#52525b] uppercase tracking-wider">Pool</th>
                <th className="pb-2 font-medium text-[10px] text-[#52525b] uppercase tracking-wider hidden md:table-cell">Protocol</th>
                <th className="pb-2 font-medium text-[10px] text-[#52525b] uppercase tracking-wider text-right">APY</th>
                <th className="pb-2 font-medium text-[10px] text-[#52525b] uppercase tracking-wider text-right">Return</th>
                <th className="pb-2 font-medium text-[10px] text-[#52525b] uppercase tracking-wider text-right hidden sm:table-cell">Final Value</th>
                <th className="pb-2 font-medium text-[10px] text-[#52525b] uppercase tracking-wider text-right hidden sm:table-cell">Risk</th>
                <th className="pb-2 font-medium text-[10px] text-[#52525b] uppercase tracking-wider text-right" />
              </tr>
            </thead>
            <tbody>
              {results.map((r) => (
                <tr key={r.investmentId} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                  <td className="py-2.5 pr-4 text-[#fafafa]">{r.name}</td>
                  <td className="py-2.5 pr-4 text-[#a1a1aa] hidden md:table-cell">{r.platform}</td>
                  <td className="py-2.5 pr-4 text-right text-emerald-400">{r.apy.toFixed(2)}%</td>
                  <td className="py-2.5 pr-4 text-right text-emerald-400">+{formatUsd(r.returnAmt)}</td>
                  <td className="py-2.5 pr-4 text-right text-[#fafafa] hidden sm:table-cell">{formatUsd(r.finalValue)}</td>
                  <td className="py-2.5 pr-4 text-right hidden sm:table-cell">
                    {r.productType === "DEX_POOL" ? (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-medium text-[#f59e0b] bg-[#f59e0b]/10">IL Risk</span>
                    ) : (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-medium text-[#34d399] bg-[#34d399]/10">Low</span>
                    )}
                  </td>
                  <td className="py-2.5 text-right">
                    <button
                      onClick={() => router.push(`/defi/deposit/${r.investmentId}`)}
                      className="text-[10px] font-semibold text-[#06b6d4] hover:text-[#06b6d4]/80 transition-colors cursor-pointer"
                    >
                      Deposit →
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
