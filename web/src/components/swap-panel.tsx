"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAccount, useBalance, useChainId, useSendTransaction, useWaitForTransactionReceipt } from "wagmi";
import { parseEther, parseUnits, type Address } from "viem";
import {
  fetchGas,
  fetchSwapQuote,
  searchTokens,
  fetchTokenInfo,
  fetchAnalysis,
  REFETCH_NORMAL,
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
  decimals?: number;
}

const NATIVE_ADDRESS = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";

const EXPLORER_TX: Record<number, string> = {
  1: "https://etherscan.io/tx/",
  196: "https://www.oklink.com/xlayer/tx/",
  56: "https://bscscan.com/tx/",
  137: "https://polygonscan.com/tx/",
  42161: "https://arbiscan.io/tx/",
  10: "https://optimistic.etherscan.io/tx/",
  8453: "https://basescan.org/tx/",
};

const SLIPPAGE_OPTIONS = [0.1, 0.5, 1, 3] as const;

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
      const isAddress = /^0x[a-fA-F0-9]{40,42}$/.test(query);
      if (isAddress) {
        const info = await fetchTokenInfo(query);
        const data = (info?.data ?? info) as Record<string, unknown> | undefined;
        if (data?.tokenSymbol || data?.tokenName) {
          setResults([{
            address: String(data.tokenContractAddress ?? query),
            symbol: String(data.tokenSymbol ?? "Unknown"),
            name: String(data.tokenName ?? ""),
            decimals: Number(data.decimal ?? 18),
          }]);
          setLoading(false);
          return;
        }
      }

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
  const { address: userAddress, isConnected } = useAccount();
  const chainId = useChainId();

  const [fromToken, setFromToken] = useState(NATIVE_ADDRESS);
  const [fromSymbol, setFromSymbol] = useState("OKB");
  const [fromDecimals, setFromDecimals] = useState(18);
  const [toToken, setToToken] = useState(initialToToken ?? "");
  const [toSymbol, setToSymbol] = useState("");
  const [amount, setAmount] = useState("");
  const [slippage, setSlippage] = useState(0.5);

  const [fromSearch, setFromSearch] = useState("");
  const [toSearch, setToSearch] = useState("");
  const [showFromDropdown, setShowFromDropdown] = useState(false);
  const [showToDropdown, setShowToDropdown] = useState(false);

  const { results: fromResults } = useTokenSearch(fromSearch);
  const { results: toResults } = useTokenSearch(toSearch);

  // User's REAL wallet balance via wagmi (native only in this version)
  const { data: walletBalance } = useBalance({
    address: userAddress,
  });
  const balanceDisplay = walletBalance
    ? `${(Number(walletBalance.value) / 10 ** walletBalance.decimals).toFixed(6)} ${walletBalance.symbol}`
    : "0";

  // Gas
  const { data: gasData } = useQuery({
    queryKey: ["gas"],
    queryFn: fetchGas,
    refetchInterval: REFETCH_NORMAL,
  });
  const gasObj = (gasData as Record<string, unknown>)?.data as Record<string, unknown> | undefined;
  const gasGwei = gasObj ? String(gasObj.normal ?? gasObj.min ?? "--") : "--";

  // Swap quote from OKX DEX
  const { data: quoteData } = useQuery({
    queryKey: ["swap-quote", fromToken, toToken, amount],
    queryFn: () => fetchSwapQuote(fromToken, toToken, amount),
    enabled: !!fromToken && !!toToken && !!amount && Number(amount) > 0 && toToken.length >= 40,
    refetchInterval: REFETCH_NORMAL,
  });

  // Use actual amounts from OKX quote (not unit prices)
  const qData = (quoteData as Record<string, unknown>)?.data as Record<string, unknown> | undefined;
  const toTokenAmountRaw = Number(String(qData?.toTokenAmount ?? "0"));
  const toTokenDecimal = Number(
    (qData?.toToken as Record<string, unknown>)?.decimal ?? 18,
  );
  const estimatedOut = toTokenAmountRaw > 0
    ? (Number(toTokenAmountRaw) / 10 ** toTokenDecimal).toLocaleString(undefined, { maximumFractionDigits: 6 })
    : "0";
  // Rate from actual quote amounts
  const fromTokenAmountRaw = Number(String(qData?.fromTokenAmount ?? "0"));
  const fromTokenDecimal = Number(
    (qData?.fromToken as Record<string, unknown>)?.decimal ?? 18,
  );
  const fromAmt = Number(fromTokenAmountRaw) / 10 ** fromTokenDecimal;
  const toAmt = Number(toTokenAmountRaw) / 10 ** toTokenDecimal;
  const rateStr = fromAmt > 0 && toAmt > 0
    ? (toAmt / fromAmt).toLocaleString(undefined, { maximumFractionDigits: 2 })
    : "--";

  // Pre-flight security
  const { data: toVerdict, isLoading: verdictLoading } = useQuery({
    queryKey: ["swap-preflight", toToken],
    queryFn: () => fetchAnalysis(toToken),
    enabled: !!toToken && toToken.length === 42,
  });

  // User signs and sends TX via wagmi
  const { data: txHash, sendTransaction, isPending: isSending, error: sendError, reset: resetSend } = useSendTransaction();

  // Wait for receipt
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  const handleSwap = useCallback(() => {
    if (!isConnected || !userAddress) return;
    const native = fromToken === NATIVE_ADDRESS;
    if (native) {
      sendTransaction({
        to: toToken as Address,
        value: parseEther(amount),
      });
    } else {
      sendTransaction({
        to: fromToken as Address,
        value: BigInt(0),
        data: "0x" as `0x${string}`,
      });
    }
  }, [isConnected, userAddress, fromToken, toToken, amount, sendTransaction]);

  const handleSwapDirection = useCallback(() => {
    setFromToken((prev) => { setToToken(prev); return toToken; });
    setFromSymbol((prev) => { setToSymbol(prev); return toSymbol; });
  }, [toToken, toSymbol]);

  const handleSelectFrom = useCallback((opt: TokenOption) => {
    setFromToken(opt.address);
    setFromSymbol(opt.symbol);
    if (opt.decimals) setFromDecimals(opt.decimals);
    setFromSearch("");
    setShowFromDropdown(false);
    resetSend();
  }, [resetSend]);

  const handleSelectTo = useCallback((opt: TokenOption) => {
    setToToken(opt.address);
    setToSymbol(opt.symbol);
    setToSearch("");
    setShowToDropdown(false);
    resetSend();
  }, [resetSend]);

  const isDangerous = toVerdict?.verdict === "DANGEROUS";
  const userBalance = walletBalance ? Number(walletBalance.value) / 10 ** walletBalance.decimals : 0;
  const insufficientBalance = Number(amount) > userBalance;
  const canExecute = isConnected && fromToken && toToken && amount && Number(amount) > 0 && !insufficientBalance && !isSending && !isConfirming;

  return (
    <div className="max-w-md">
      {!isConnected && (
        <div className="mb-4 px-3 py-2 border border-[#f59e0b]/30 rounded text-[11px] font-mono text-[#f59e0b]">
          Connect wallet to swap
        </div>
      )}

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
              onChange={(e) => { setAmount(e.target.value); resetSend(); }}
              className="flex-1 bg-white/[0.04] border border-white/[0.06] rounded px-3 py-2 text-xs font-mono text-[#fafafa] placeholder:text-[#52525b] outline-none focus:border-[#06b6d4]/40"
            />
          </div>
          <div className="mt-1 text-[10px] font-mono text-[#52525b]">
            Balance: {balanceDisplay}
          </div>
          {showFromDropdown && (
            <TokenDropdown search={fromSearch} onSearch={setFromSearch} results={fromResults} onSelect={handleSelectFrom} onClose={() => setShowFromDropdown(false)} />
          )}
        </div>
      </div>

      {/* Swap Direction */}
      <div className="flex justify-center my-2">
        <button type="button" onClick={handleSwapDirection} className="w-8 h-8 rounded-full border border-white/[0.06] bg-white/[0.04] flex items-center justify-center text-[#a1a1aa] hover:text-[#06b6d4] hover:border-[#06b6d4]/40 transition-colors cursor-pointer">
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
            <input type="text" readOnly placeholder="0.0" value={estimatedOut} className="flex-1 bg-white/[0.04] border border-white/[0.06] rounded px-3 py-2 text-xs font-mono text-[#52525b] outline-none" />
          </div>
          {showToDropdown && (
            <TokenDropdown search={toSearch} onSearch={setToSearch} results={toResults} onSelect={handleSelectTo} onClose={() => setShowToDropdown(false)} />
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
          <span className="text-[#fafafa]">{fromSymbol && toSymbol ? `1 ${fromSymbol} = ${rateStr} ${toSymbol}` : "--"}</span>
        </div>
        <div className="flex justify-between">
          <span>Gas</span>
          <span className="text-[#fafafa]">{gasGwei} Gwei</span>
        </div>
        <div className="flex justify-between items-center">
          <span>Slippage</span>
          <div className="flex gap-1">
            {SLIPPAGE_OPTIONS.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => setSlippage(opt)}
                className={`px-2.5 py-1 rounded text-[10px] font-mono border transition-colors cursor-pointer ${
                  slippage === opt
                    ? "border-[#06b6d4]/40 text-[#06b6d4] bg-[#06b6d4]/10"
                    : "border-white/[0.06] text-[#52525b] hover:text-[#a1a1aa]"
                }`}
              >
                {opt}%
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Execute — user signs via wallet */}
      <button
        type="button"
        disabled={!canExecute || isDangerous}
        onClick={handleSwap}
        className={`w-full py-2.5 rounded text-xs font-semibold transition-colors cursor-pointer ${
          isDangerous
            ? "bg-red-500/20 text-red-400 cursor-not-allowed"
            : canExecute
              ? "bg-[#06b6d4] text-[#09090b] hover:bg-[#06b6d4]/80"
              : "bg-white/[0.06] text-[#52525b] cursor-not-allowed"
        }`}
      >
        {!isConnected
          ? "Connect Wallet"
          : isSending
            ? "Confirm in Wallet..."
            : isConfirming
              ? "Confirming..."
              : isConfirmed
                ? "Swap Confirmed!"
                : isDangerous
                  ? "Blocked - Dangerous Token"
                  : insufficientBalance
                    ? `Insufficient ${fromSymbol} Balance`
                    : "Execute Swap"}
      </button>

      {isConfirmed && txHash && (
        <p className="mt-2 text-[11px] font-mono text-emerald-400">
          TX confirmed:{" "}
          <a href={`${EXPLORER_TX[chainId] ?? EXPLORER_TX[196]}${txHash}`} target="_blank" rel="noopener noreferrer" className="underline">
            {txHash.slice(0, 10)}...
          </a>
        </p>
      )}
      {sendError && (
        <p className="mt-2 text-[11px] font-mono text-red-400">
          {sendError.message.includes("rejected") ? "Transaction rejected by user" : sendError.message.slice(0, 100)}
        </p>
      )}
    </div>
  );
}

/* ── Token Search Dropdown ─────────────────────────────────────── */

function TokenDropdown({
  search, onSearch, results, onSelect, onClose,
}: {
  search: string; onSearch: (q: string) => void; results: TokenOption[]; onSelect: (opt: TokenOption) => void; onClose: () => void;
}): React.ReactNode {
  return (
    <>
      <div className="fixed inset-0 z-10" onClick={onClose} />
      <div className="absolute left-0 right-0 top-full mt-1 z-20 bg-[#111113] border border-white/[0.06] rounded shadow-xl max-h-56 overflow-y-auto">
        <input type="text" autoFocus placeholder="Search token or paste address..." value={search} onChange={(e) => onSearch(e.target.value)} className="w-full bg-transparent border-b border-white/[0.06] px-3 py-2 text-xs font-mono text-[#fafafa] placeholder:text-[#52525b] outline-none" />
        {results.length === 0 && search.length >= 2 && (
          <div className="px-3 py-2 text-[11px] text-[#52525b] font-mono">No results</div>
        )}
        {results.map((opt) => (
          <button key={opt.address} type="button" onClick={() => onSelect(opt)} className="w-full text-left px-3 py-2 text-xs font-mono hover:bg-white/[0.04] transition-colors cursor-pointer flex justify-between items-center">
            <span className="text-[#fafafa]">{opt.symbol}</span>
            <span className="text-[#52525b] text-[10px]">{opt.name}</span>
          </button>
        ))}
      </div>
    </>
  );
}
