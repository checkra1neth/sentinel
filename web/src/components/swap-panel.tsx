"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  fetchGas,
  executeSwap,
  searchTokens,
  fetchAnalysis,
  formatUsd,
  type Verdict,
} from "../lib/api";
import { SwapPreFlight } from "./swap-preflight";

interface SwapPanelProps {
  initialToToken?: string;
}

interface TokenOption {
  address: string;
  symbol: string;
  name: string;
}

function useTokenSearch(query: string): { results: TokenOption[]; loading: boolean } {
  const [results, setResults] = useState<TokenOption[]>([]);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!query || query.length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    timerRef.current = setTimeout(async () => {
      const pairs = await searchTokens(query);
      const opts: TokenOption[] = pairs.map((p) => {
        const base = p.baseToken as Record<string, unknown> | undefined;
        return {
          address: String(base?.address ?? p.pairAddress ?? ""),
          symbol: String(base?.symbol ?? p.symbol ?? ""),
          name: String(base?.name ?? p.name ?? ""),
        };
      });
      setResults(opts);
      setLoading(false);
    }, 300);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [query]);

  return { results, loading };
}

export function SwapPanel({ initialToToken }: SwapPanelProps): React.ReactNode {
  const [fromToken, setFromToken] = useState("0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee");
  const [fromSymbol, setFromSymbol] = useState("OKB");
  const [toToken, setToToken] = useState(initialToToken ?? "");
  const [toSymbol, setToSymbol] = useState("");
  const [amount, setAmount] = useState("");
  const [slippage] = useState(0.5);

  const [fromSearch, setFromSearch] = useState("");
  const [toSearch, setToSearch] = useState("");
  const [showFromDropdown, setShowFromDropdown] = useState(false);
  const [showToDropdown, setShowToDropdown] = useState(false);

  const { results: fromResults } = useTokenSearch(fromSearch);
  const { results: toResults } = useTokenSearch(toSearch);

  const { data: gasData } = useQuery({
    queryKey: ["gas"],
    queryFn: fetchGas,
    refetchInterval: 15_000,
  });

  const { data: toVerdict, isLoading: verdictLoading } = useQuery({
    queryKey: ["swap-preflight", toToken],
    queryFn: () => fetchAnalysis(toToken),
    enabled: !!toToken && toToken.length === 42,
  });

  const swapMutation = useMutation({
    mutationFn: () => executeSwap(fromToken, toToken, amount),
  });

  const handleSwapDirection = useCallback(() => {
    setFromToken((prev) => {
      setToToken(prev);
      return toToken;
    });
    setFromSymbol((prev) => {
      setToSymbol(prev);
      return toSymbol;
    });
  }, [toToken, toSymbol]);

  const handleSelectFrom = useCallback((opt: TokenOption) => {
    setFromToken(opt.address);
    setFromSymbol(opt.symbol);
    setFromSearch("");
    setShowFromDropdown(false);
  }, []);

  const handleSelectTo = useCallback((opt: TokenOption) => {
    setToToken(opt.address);
    setToSymbol(opt.symbol);
    setToSearch("");
    setShowToDropdown(false);
  }, []);

  const gasGwei = gasData ? String((gasData as Record<string, unknown>).standard ?? (gasData as Record<string, unknown>).gasPrice ?? "--") : "--";
  const estimatedOut = amount && Number(amount) > 0 ? "--" : "0";

  const canExecute = fromToken && toToken && amount && Number(amount) > 0 && !swapMutation.isPending;
  const isDangerous = toVerdict?.verdict === "DANGEROUS";

  return (
    <div className="max-w-md">
      {/* From Token */}
      <div className="mb-3">
        <label className="block text-[11px] text-[#52525b] font-mono mb-1">From</label>
        <div className="relative">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { setShowFromDropdown(!showFromDropdown); setShowToDropdown(false); }}
              className="shrink-0 bg-white/[0.04] border border-white/[0.06] rounded px-3 py-2 text-xs font-mono text-[#fafafa] hover:bg-white/[0.08] transition-colors cursor-pointer"
            >
              {fromSymbol || "Select"}
            </button>
            <input
              type="text"
              inputMode="decimal"
              placeholder="0.0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="flex-1 bg-white/[0.04] border border-white/[0.06] rounded px-3 py-2 text-xs font-mono text-[#fafafa] placeholder:text-[#52525b] outline-none focus:border-[#06b6d4]/40"
            />
          </div>
          {showFromDropdown && (
            <TokenDropdown
              search={fromSearch}
              onSearch={setFromSearch}
              results={fromResults}
              onSelect={handleSelectFrom}
              onClose={() => setShowFromDropdown(false)}
            />
          )}
        </div>
      </div>

      {/* Swap Direction */}
      <div className="flex justify-center my-2">
        <button
          type="button"
          onClick={handleSwapDirection}
          className="w-8 h-8 rounded-full border border-white/[0.06] bg-white/[0.04] flex items-center justify-center text-[#a1a1aa] hover:text-[#06b6d4] hover:border-[#06b6d4]/40 transition-colors cursor-pointer"
        >
          <span className="text-sm leading-none select-none">{"\u21C5"}</span>
        </button>
      </div>

      {/* To Token */}
      <div className="mb-4">
        <label className="block text-[11px] text-[#52525b] font-mono mb-1">To</label>
        <div className="relative">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { setShowToDropdown(!showToDropdown); setShowFromDropdown(false); }}
              className="shrink-0 bg-white/[0.04] border border-white/[0.06] rounded px-3 py-2 text-xs font-mono text-[#fafafa] hover:bg-white/[0.08] transition-colors cursor-pointer"
            >
              {toSymbol || "Select"}
            </button>
            <input
              type="text"
              readOnly
              placeholder="0.0"
              value={estimatedOut}
              className="flex-1 bg-white/[0.04] border border-white/[0.06] rounded px-3 py-2 text-xs font-mono text-[#52525b] outline-none"
            />
          </div>
          {showToDropdown && (
            <TokenDropdown
              search={toSearch}
              onSearch={setToSearch}
              results={toResults}
              onSelect={handleSelectTo}
              onClose={() => setShowToDropdown(false)}
            />
          )}
        </div>
      </div>

      {/* PreFlight */}
      {toToken && toToken.length === 42 && (
        <div className="mb-4">
          <SwapPreFlight token={toToken} verdict={toVerdict ?? null} loading={verdictLoading} />
        </div>
      )}

      {/* Quote Info */}
      <div className="bg-white/[0.02] border border-white/[0.06] rounded p-3 mb-4 space-y-1.5 text-[11px] font-mono text-[#a1a1aa]">
        <div className="flex justify-between">
          <span>Rate</span>
          <span className="text-[#fafafa]">
            {fromSymbol && toSymbol ? `1 ${fromSymbol} = -- ${toSymbol}` : "--"}
          </span>
        </div>
        <div className="flex justify-between">
          <span>Gas</span>
          <span className="text-[#fafafa]">{gasGwei} Gwei</span>
        </div>
        <div className="flex justify-between">
          <span>Slippage</span>
          <span className="text-[#fafafa]">{slippage}%</span>
        </div>
      </div>

      {/* Execute */}
      <button
        type="button"
        disabled={!canExecute || isDangerous}
        onClick={() => swapMutation.mutate()}
        className={`w-full py-2.5 rounded text-xs font-semibold transition-colors cursor-pointer ${
          isDangerous
            ? "bg-red-500/20 text-red-400 cursor-not-allowed"
            : canExecute
              ? "bg-[#06b6d4] text-[#09090b] hover:bg-[#06b6d4]/80"
              : "bg-white/[0.06] text-[#52525b] cursor-not-allowed"
        }`}
      >
        {swapMutation.isPending
          ? "Executing..."
          : swapMutation.isSuccess
            ? "Swap Submitted"
            : swapMutation.isError
              ? "Swap Failed - Retry"
              : isDangerous
                ? "Blocked - Dangerous Token"
                : "Execute Swap"}
      </button>

      {swapMutation.isSuccess && (
        <p className="mt-2 text-[11px] font-mono text-emerald-400">
          Swap submitted. Check portfolio for status.
        </p>
      )}
      {swapMutation.isError && (
        <p className="mt-2 text-[11px] font-mono text-red-400">
          {String((swapMutation.error as Error)?.message ?? "Unknown error")}
        </p>
      )}
    </div>
  );
}

/* ── Token Search Dropdown ─────────────────────────────────────── */

function TokenDropdown({
  search,
  onSearch,
  results,
  onSelect,
  onClose,
}: {
  search: string;
  onSearch: (q: string) => void;
  results: TokenOption[];
  onSelect: (opt: TokenOption) => void;
  onClose: () => void;
}): React.ReactNode {
  return (
    <>
      <div className="fixed inset-0 z-10" onClick={onClose} />
      <div className="absolute left-0 right-0 top-full mt-1 z-20 bg-[#111113] border border-white/[0.06] rounded shadow-xl max-h-56 overflow-y-auto">
        <input
          type="text"
          autoFocus
          placeholder="Search token..."
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          className="w-full bg-transparent border-b border-white/[0.06] px-3 py-2 text-xs font-mono text-[#fafafa] placeholder:text-[#52525b] outline-none"
        />
        {results.length === 0 && search.length >= 2 && (
          <div className="px-3 py-2 text-[11px] text-[#52525b] font-mono">No results</div>
        )}
        {results.map((opt) => (
          <button
            key={opt.address}
            type="button"
            onClick={() => onSelect(opt)}
            className="w-full text-left px-3 py-2 text-xs font-mono hover:bg-white/[0.04] transition-colors cursor-pointer flex justify-between items-center"
          >
            <span className="text-[#fafafa]">{opt.symbol}</span>
            <span className="text-[#52525b] text-[10px]">{opt.name}</span>
          </button>
        ))}
      </div>
    </>
  );
}
