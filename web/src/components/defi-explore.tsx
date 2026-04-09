"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { fetchDefiProducts, fetchYields, formatUsd, REFETCH_SLOW, STALE_NORMAL } from "../lib/api";
import { TypeBadge } from "./type-badge";
import { SkeletonRows } from "./skeleton-rows";

type ProductType = "All" | "LP" | "Stake" | "Lend";
type SortKey = "apy" | "tvl" | "name";
type SortDir = "asc" | "desc";

interface Pool {
  investmentId: string;
  name: string;
  platform: string;
  apy: number;
  tvl: number;
  productType: string;
  chain: string;
  canDeposit: boolean;
}

const CHAIN_MAP: Record<string, string> = {
  "1": "Ethereum", "56": "BNB", "137": "Polygon", "42161": "Arbitrum",
  "10": "Optimism", "8453": "Base", "196": "X Layer", "324": "zkSync",
  "43114": "Avalanche", "250": "Fantom",
};

// Non-EVM chains to exclude (Solana, Aptos, Sui, Cosmos, etc.)
const NON_EVM_CHAINS = new Set(["501", "637", "784", "118", "397"]);

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

export function DefiExplore(): React.ReactNode {
  const router = useRouter();
  const [filter, setFilter] = useState<ProductType>("All");
  const [chainFilter, setChainFilter] = useState<string>("All");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("apy");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const { data: productsData, isLoading: productsLoading } = useQuery({
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

    const mapped: Pool[] = [];
    for (const p of products) {
      const chainIdx = String(p.chainIndex ?? "");
      if (NON_EVM_CHAINS.has(chainIdx)) continue;
      const name = String(p.name ?? p.poolName ?? "");
      const platform = String(p.platformName ?? p.platform ?? p.protocol ?? "");
      mapped.push({
        investmentId: String(p.investmentId ?? p.id ?? ""),
        name,
        platform,
        apy: Number(p.rate ?? p.apy ?? p.apr ?? 0) * (Number(p.rate ?? 0) < 1 ? 100 : 1),
        tvl: Number(p.tvl ?? p.totalValueLocked ?? 0),
        productType: inferProductType(name, platform, p.investType ?? p.productGroup),
        chain: CHAIN_MAP[chainIdx] ?? chainIdx,
        canDeposit: true,
      });
    }

    const yieldsArr = (yieldsData as Record<string, unknown>)?.pools as Record<string, unknown>[] | undefined;
    const NON_EVM_YIELD_CHAINS = new Set(["Solana", "Aptos", "Sui", "Cosmos", "Near", "Tron"]);
    if (yieldsArr) {
      for (const y of yieldsArr) {
        const yChain = String(y.chain ?? "");
        if (NON_EVM_YIELD_CHAINS.has(yChain)) continue;
        const id = String(y.investmentId ?? y.pool ?? "");
        if (!mapped.some((p) => p.investmentId === id)) {
          mapped.push({
            investmentId: id,
            name: String(y.name ?? y.symbol ?? ""),
            platform: String(y.project ?? y.platform ?? ""),
            apy: Number(y.apy ?? y.apyBase ?? 0),
            tvl: Number(y.tvlUsd ?? y.tvl ?? 0),
            productType: "DEX_POOL",
            chain: yChain,
            canDeposit: false,
          });
        }
      }
    }

    return mapped;
  }, [productsData, yieldsData]);

  const availableChains = useMemo(() => {
    const chains = new Set(pools.map((p) => p.chain).filter(Boolean));
    return ["All", ...Array.from(chains).sort()];
  }, [pools]);

  const filtered = useMemo(() => {
    let result = pools;

    if (filter !== "All") {
      const typeMap: Record<string, string[]> = {
        LP: ["DEX_POOL"],
        Stake: ["SINGLE_EARN"],
        Lend: ["LENDING"],
      };
      const allowed = typeMap[filter] ?? [];
      result = result.filter((p) => allowed.includes(p.productType));
    }

    if (chainFilter !== "All") {
      result = result.filter((p) => p.chain === chainFilter);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (p) => p.name.toLowerCase().includes(q) || p.platform.toLowerCase().includes(q),
      );
    }

    const dir = sortDir === "asc" ? 1 : -1;
    result = [...result].sort((a, b) => {
      switch (sortKey) {
        case "apy": return (a.apy - b.apy) * dir;
        case "tvl": return (a.tvl - b.tvl) * dir;
        case "name": return a.name.localeCompare(b.name) * dir;
        default: return 0;
      }
    });

    return result;
  }, [pools, filter, chainFilter, search, sortKey, sortDir]);

  const toggleSort = (key: SortKey): void => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const TYPES: ProductType[] = ["All", "LP", "Stake", "Lend"];
  const thClass =
    "pb-2 font-medium text-[10px] text-[#52525b] uppercase tracking-wider cursor-pointer hover:text-[#a1a1aa] transition-colors select-none";

  return (
    <div>
      {/* Filter bar */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {TYPES.map((t) => (
          <button
            key={t}
            onClick={() => setFilter(t)}
            className={`px-3 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer ${
              filter === t
                ? "bg-[#06b6d4]/10 text-[#06b6d4] border border-[#06b6d4]/20"
                : "bg-white/[0.04] text-[#a1a1aa] border border-white/[0.06] hover:text-[#fafafa]"
            }`}
          >
            {t}
          </button>
        ))}
        <input
          type="text"
          placeholder="Search pool or protocol..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="ml-auto bg-white/[0.04] border border-white/[0.06] rounded px-3 py-1 text-xs font-mono text-[#fafafa] placeholder:text-[#52525b] outline-none focus:border-[#06b6d4]/40 w-56"
        />
      </div>

      {/* Chain filter */}
      <div className="flex items-center gap-1.5 mb-4 flex-wrap">
        <span className="text-[10px] font-mono text-[#52525b] mr-1">Chain:</span>
        {availableChains.map((c) => (
          <button
            key={c}
            onClick={() => setChainFilter(c)}
            className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors cursor-pointer ${
              chainFilter === c
                ? "bg-[#06b6d4]/10 text-[#06b6d4] border border-[#06b6d4]/20"
                : "bg-white/[0.04] text-[#52525b] border border-white/[0.06] hover:text-[#a1a1aa]"
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {/* Table */}
      {productsLoading ? (
        <SkeletonRows rows={8} columns={6} />
      ) : filtered.length === 0 ? (
        <div className="py-12 text-center text-xs font-mono text-[#52525b]">
          {search || filter !== "All" || chainFilter !== "All" ? "No products match your filters" : "No DeFi products available"}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="text-left border-b border-white/[0.06]">
                <th className={thClass} onClick={() => toggleSort("name")}>
                  Pool {sortKey === "name" ? (sortDir === "asc" ? "↑" : "↓") : ""}
                </th>
                <th className={`${thClass} hidden lg:table-cell`}>Chain</th>
                <th className={`${thClass} hidden md:table-cell`}>Protocol</th>
                <th className={`${thClass} hidden sm:table-cell`}>Type</th>
                <th className={`${thClass} text-right`} onClick={() => toggleSort("apy")}>
                  APY {sortKey === "apy" ? (sortDir === "asc" ? "↑" : "↓") : ""}
                </th>
                <th className={`${thClass} text-right`} onClick={() => toggleSort("tvl")}>
                  TVL {sortKey === "tvl" ? (sortDir === "asc" ? "↑" : "↓") : ""}
                </th>
                <th className={`${thClass} text-right`} />
              </tr>
            </thead>
            <tbody>
              {filtered.map((pool) => (
                <tr
                  key={pool.investmentId}
                  className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors"
                >
                  <td className="py-2.5 pr-4 text-[#fafafa]">{pool.name}</td>
                  <td className="py-2.5 pr-4 text-[#52525b] hidden lg:table-cell">{pool.chain}</td>
                  <td className="py-2.5 pr-4 text-[#a1a1aa] hidden md:table-cell">{pool.platform}</td>
                  <td className="py-2.5 pr-4 hidden sm:table-cell">
                    <TypeBadge type={pool.productType} />
                  </td>
                  <td className="py-2.5 pr-4 text-right text-emerald-400">
                    {pool.apy.toFixed(2)}%
                  </td>
                  <td className="py-2.5 pr-4 text-right text-[#a1a1aa]">
                    {formatUsd(pool.tvl)}
                  </td>
                  <td className="py-2.5 text-right">
                    {pool.canDeposit ? (
                      <button
                        type="button"
                        onClick={() => router.push(`/defi/deposit/${pool.investmentId}`)}
                        className="px-3 py-1 rounded text-[10px] font-semibold bg-[#06b6d4]/10 text-[#06b6d4] border border-[#06b6d4]/20 hover:bg-[#06b6d4]/20 transition-colors cursor-pointer"
                      >
                        Deposit
                      </button>
                    ) : (
                      <span className="text-[10px] font-mono text-[#52525b]">APY only</span>
                    )}
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
