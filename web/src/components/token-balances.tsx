"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { fetchManagedPortfolio, formatUsd, REFETCH_NORMAL, STALE_NORMAL } from "../lib/api";

interface TokenBalance {
  token: string;
  tokenSymbol: string;
  balance: number;
  balanceUsd: number;
  tokenPrice: number;
  chainIndex: string;
  isRiskToken: boolean;
}

const CHAIN_META: Record<string, { name: string; color: string; trustId?: string }> = {
  "1": { name: "Ethereum", color: "#627eea", trustId: "ethereum" },
  "56": { name: "BNB", color: "#f0b90b", trustId: "smartchain" },
  "137": { name: "Polygon", color: "#8247e5", trustId: "polygon" },
  "42161": { name: "Arbitrum", color: "#28a0f0", trustId: "arbitrum" },
  "10": { name: "Optimism", color: "#ff0420", trustId: "optimism" },
  "8453": { name: "Base", color: "#0052ff", trustId: "base" },
  "196": { name: "X Layer", color: "#ffffff" },
  "324": { name: "zkSync", color: "#8c8dfc", trustId: "zksync" },
  "43114": { name: "Avalanche", color: "#e84142", trustId: "avalanchec" },
  "250": { name: "Fantom", color: "#1969ff", trustId: "fantom" },
};

function tokenIconUrl(chainIndex: string, tokenAddress: string): string | undefined {
  const meta = CHAIN_META[chainIndex];
  if (!meta?.trustId || !tokenAddress) return undefined;
  if (!tokenAddress || tokenAddress === "0x" || tokenAddress === "0x0000000000000000000000000000000000000000") return undefined;
  return `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/${meta.trustId}/assets/${tokenAddress}/logo.png`;
}

function TokenIcon({ token, chainIndex, symbol }: { token: string; chainIndex: string; symbol: string }): React.ReactNode {
  const [failed, setFailed] = useState(false);
  const iconUrl = tokenIconUrl(chainIndex, token);
  const chainColor = CHAIN_META[chainIndex]?.color ?? "#52525b";

  if (iconUrl && !failed) {
    return (
      <div className="relative shrink-0">
        <img src={iconUrl} alt={symbol} className="w-9 h-9 rounded-full bg-white/[0.04]" onError={() => setFailed(true)} />
        <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 border-[#09090b]" style={{ backgroundColor: chainColor }} />
      </div>
    );
  }

  return (
    <div className="relative shrink-0">
      <div className="w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-bold text-white/90" style={{ backgroundColor: chainColor, opacity: 0.7 }}>
        {symbol.slice(0, 2)}
      </div>
      <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 border-[#09090b]" style={{ backgroundColor: chainColor }} />
    </div>
  );
}

function ChainSelector({ chains, selected, onChange }: {
  chains: { chainIndex: string; count: number; value: number }[];
  selected: string;
  onChange: (v: string) => void;
}): React.ReactNode {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent): void => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const selectedMeta = selected === "all" ? null : CHAIN_META[selected];

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] transition-colors cursor-pointer text-xs font-mono shrink-0"
      >
        {selected === "all" ? (
          <div className="flex -space-x-1.5">
            {chains.slice(0, 4).map((c) => (
              <div key={c.chainIndex} className="w-4 h-4 rounded-full border border-[#09090b]" style={{ backgroundColor: CHAIN_META[c.chainIndex]?.color ?? "#52525b" }} />
            ))}
          </div>
        ) : (
          <div className="w-4 h-4 rounded-full" style={{ backgroundColor: selectedMeta?.color ?? "#52525b" }} />
        )}
        <span className="text-[#a1a1aa]">{selected === "all" ? "All Chains" : selectedMeta?.name ?? selected}</span>
        <span className="text-[#52525b] text-[10px]">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 min-w-[200px] rounded-lg border border-white/[0.06] bg-[#0c0c0f] shadow-xl py-1">
          <button
            onClick={() => { onChange("all"); setOpen(false); }}
            className={`w-full flex items-center gap-3 px-3 py-2 hover:bg-white/[0.04] transition-colors cursor-pointer text-left ${selected === "all" ? "bg-white/[0.03]" : ""}`}
          >
            <div className="flex -space-x-1">
              {chains.slice(0, 3).map((c) => (
                <div key={c.chainIndex} className="w-4 h-4 rounded-full border border-[#0c0c0f]" style={{ backgroundColor: CHAIN_META[c.chainIndex]?.color ?? "#52525b" }} />
              ))}
            </div>
            <span className="text-xs font-mono text-[#fafafa]">All Chains</span>
            <span className="text-[10px] font-mono text-[#52525b] ml-auto">{chains.reduce((s, c) => s + c.count, 0)}</span>
          </button>
          {chains.map((c) => {
            const meta = CHAIN_META[c.chainIndex] ?? { name: `Chain ${c.chainIndex}`, color: "#52525b" };
            return (
              <button
                key={c.chainIndex}
                onClick={() => { onChange(c.chainIndex); setOpen(false); }}
                className={`w-full flex items-center gap-3 px-3 py-2 hover:bg-white/[0.04] transition-colors cursor-pointer text-left ${selected === c.chainIndex ? "bg-white/[0.03]" : ""}`}
              >
                <div className="w-4 h-4 rounded-full" style={{ backgroundColor: meta.color }} />
                <span className="text-xs font-mono text-[#fafafa]">{meta.name}</span>
                <span className="text-[10px] font-mono text-[#52525b] ml-auto">{c.count}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function parseBalances(data: Record<string, unknown>): TokenBalance[] {
  const walletBal = data?.walletBalances as Record<string, unknown>[] | undefined;
  const posArr = data?.positions as Record<string, unknown>[] | undefined;
  const source = Array.isArray(walletBal) && walletBal.length > 0 ? walletBal : posArr;
  if (!Array.isArray(source)) return [];

  return source.map((t) => ({
    token: String(t.tokenContractAddress ?? t.tokenAddress ?? t.token ?? t.address ?? ""),
    tokenSymbol: String(t.tokenSymbol ?? t.symbol ?? "Unknown"),
    balance: Number(t.balance ?? 0),
    balanceUsd: Number(t.balanceUsd ?? t.valueUsd ?? t.amountInvested ?? 0),
    tokenPrice: Number(t.tokenPrice ?? 0),
    chainIndex: String(t.chainIndex ?? "1"),
    isRiskToken: Boolean(t.isRiskToken),
  }));
}

function formatAmount(bal: number): string {
  if (bal > 1_000_000) return `${(bal / 1_000_000).toFixed(2)}M`;
  if (bal > 10_000) return `${(bal / 1_000).toFixed(1)}K`;
  if (bal > 100) return bal.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (bal > 1) return bal.toFixed(4);
  if (bal > 0.0001) return bal.toFixed(6);
  return bal.toPrecision(4);
}

function formatPrice(price: number): string {
  if (price === 0) return "—";
  if (price >= 1) return formatUsd(price);
  if (price >= 0.01) return `$${price.toFixed(4)}`;
  if (price >= 0.000001) return `$${price.toPrecision(2)}`;
  return `$${price.toExponential(1)}`;
}

export function TokenBalances(): React.ReactNode {
  const { address, isConnected } = useAccount();
  const [search, setSearch] = useState("");
  const [chainFilter, setChainFilter] = useState("all");

  const { data, isLoading } = useQuery({
    queryKey: ["managed-portfolio", address],
    queryFn: () => fetchManagedPortfolio(address),
    enabled: !!address,
    staleTime: STALE_NORMAL,
    refetchInterval: REFETCH_NORMAL,
  });

  const allTokens = useMemo(() => (data ? parseBalances(data) : []), [data]);

  const chainStats = useMemo(() => {
    const map = new Map<string, { count: number; value: number }>();
    for (const t of allTokens) {
      const prev = map.get(t.chainIndex) ?? { count: 0, value: 0 };
      map.set(t.chainIndex, { count: prev.count + 1, value: prev.value + t.balanceUsd });
    }
    return Array.from(map.entries())
      .map(([chainIndex, stats]) => ({ chainIndex, ...stats }))
      .sort((a, b) => b.value - a.value);
  }, [allTokens]);

  const filtered = useMemo(() => {
    let list = allTokens;
    if (chainFilter !== "all") list = list.filter((t) => t.chainIndex === chainFilter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((t) => t.tokenSymbol.toLowerCase().includes(q) || t.token.toLowerCase().includes(q));
    }
    return list;
  }, [allTokens, chainFilter, search]);

  if (!isConnected) return null;

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-[60px] bg-white/[0.04] animate-pulse rounded-lg" />
        ))}
      </div>
    );
  }

  if (allTokens.length === 0) {
    return (
      <div className="py-16 text-center text-xs font-mono text-[#52525b]">
        No token balances found.
      </div>
    );
  }

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-5">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#52525b]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search token..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white/[0.03] border border-white/[0.06] rounded-lg pl-9 pr-4 py-2.5 text-xs font-mono text-[#fafafa] placeholder:text-[#52525b] outline-none focus:border-white/[0.12] transition-colors"
          />
        </div>
        <ChainSelector chains={chainStats} selected={chainFilter} onChange={setChainFilter} />
      </div>

      {/* Token list — card rows like DeFi */}
      <div className="space-y-2">
        {filtered.map((t, i) => {
          const chainName = CHAIN_META[t.chainIndex]?.name ?? `Chain ${t.chainIndex}`;
          return (
            <div
              key={`${t.token}-${t.chainIndex}-${i}`}
              className="border border-white/[0.06] rounded-lg overflow-hidden"
            >
              <div className="grid grid-cols-[1fr_120px_1fr] items-center px-4 py-3 hover:bg-white/[0.02] transition-colors">
                {/* Left: icon + name + chain */}
                <div className="flex items-center gap-3 min-w-0">
                  <TokenIcon token={t.token} chainIndex={t.chainIndex} symbol={t.tokenSymbol} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-semibold text-[#fafafa]">{t.tokenSymbol}</span>
                      {t.isRiskToken && (
                        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20">Risk</span>
                      )}
                    </div>
                    <div className="text-[10px] font-mono text-[#52525b]">{chainName}</div>
                  </div>
                </div>

                {/* Middle: price — fixed width, centered */}
                <div className="text-xs font-mono text-[#a1a1aa] text-center hidden sm:block">
                  {formatPrice(t.tokenPrice)}
                </div>

                {/* Right: amount + USD */}
                <div className="text-right">
                  <div className="text-xs font-mono font-semibold text-[#fafafa]">{formatUsd(t.balanceUsd)}</div>
                  <div className="text-[10px] font-mono text-[#52525b]">
                    {formatAmount(t.balance)} {t.tokenSymbol}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (search || chainFilter !== "all") && (
        <div className="py-12 text-center text-xs font-mono text-[#52525b]">
          No tokens found{search ? ` matching "${search}"` : ""}{chainFilter !== "all" ? ` on ${CHAIN_META[chainFilter]?.name ?? chainFilter}` : ""}
        </div>
      )}
    </div>
  );
}
