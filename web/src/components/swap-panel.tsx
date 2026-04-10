"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAccount, useBalance, useChainId, useSendTransaction, useWaitForTransactionReceipt, useSwitchChain, useConfig, useReadContract, useGasPrice } from "wagmi";
import { getWalletClient } from "@wagmi/core";
import { type Address, encodeFunctionData, maxUint256, parseUnits, defineChain } from "viem";
import {
  fetchSwapQuote,
  fetchSwapCalldata,
  fetchPopularTokens,
  searchTokens,
  fetchTokenInfo,
  fetchAnalysis,
  fetchSwapSecurity,
  REFETCH_NORMAL,
  STALE_FAST,
  STALE_SLOW,
  type Verdict,
} from "../lib/api";
import { SwapPreFlight } from "./swap-preflight";

interface SwapPanelProps {
  initialToToken?: string;
  initialChain?: number;
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
  324: "https://explorer.zksync.io/tx/",
  250: "https://ftmscan.com/tx/",
  43114: "https://snowtrace.io/tx/",
};

const CHAINS = [
  { id: 196, name: "X Layer", native: "OKB" },
  { id: 1, name: "Ethereum", native: "ETH" },
  { id: 56, name: "BNB Chain", native: "BNB" },
  { id: 137, name: "Polygon", native: "MATIC" },
  { id: 42161, name: "Arbitrum", native: "ETH" },
  { id: 10, name: "Optimism", native: "ETH" },
  { id: 8453, name: "Base", native: "ETH" },
  { id: 324, name: "zkSync Era", native: "ETH" },
  { id: 250, name: "Fantom", native: "FTM" },
  { id: 43114, name: "Avalanche", native: "AVAX" },
] as const;

const SLIPPAGE_OPTIONS = [0.1, 0.5, 1, 3] as const;

function useTokenSearch(query: string, chainId?: number): { results: TokenOption[]; loading: boolean } {
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
        const info = await fetchTokenInfo(query, chainId);
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
  }, [query, chainId]);

  return { results, loading };
}

export function SwapPanel({ initialToToken, initialChain }: SwapPanelProps): React.ReactNode {
  const { address: userAddress, isConnected } = useAccount();
  const walletChainId = useChainId();
  const wagmiConfig = useConfig();
  const { switchChainAsync } = useSwitchChain();

  // Selected swap chain (independent of wallet chain — we switch before TX)
  const [selectedChain, setSelectedChain] = useState(initialChain ?? 196);
  const chainInfo = CHAINS.find((c) => c.id === selectedChain) ?? CHAINS[0];

  const [fromToken, setFromToken] = useState(NATIVE_ADDRESS);
  const [fromSymbol, setFromSymbol] = useState<string>(chainInfo.native);
  const [fromDecimals, setFromDecimals] = useState(18);
  const [toToken, setToToken] = useState(initialToToken ?? "");
  const [toSymbol, setToSymbol] = useState<string>("");
  const [amount, setAmount] = useState("");
  const [slippage, setSlippage] = useState(0.5);
  const [router, setRouter] = useState<"auto" | "okx" | "uniswap">("auto");

  const [fromSearch, setFromSearch] = useState("");
  const [toSearch, setToSearch] = useState("");
  const [showFromDropdown, setShowFromDropdown] = useState(false);
  const [showToDropdown, setShowToDropdown] = useState(false);
  const [showChainDropdown, setShowChainDropdown] = useState(false);

  // Auto-resolve initial token symbol
  useEffect(() => {
    if (!initialToToken || toSymbol) return;
    (async () => {
      const info = await fetchTokenInfo(initialToToken, initialChain);
      const data = (info?.data ?? info) as Record<string, unknown> | undefined;
      if (data?.symbol) setToSymbol(String(data.symbol));
      else if (data?.tokenSymbol) setToSymbol(String(data.tokenSymbol));
    })();
  }, [initialToToken, initialChain, toSymbol]);

  const [swapError, setSwapError] = useState<string | null>(null);
  const [swapTxHash, setSwapTxHash] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  const { results: fromResults } = useTokenSearch(fromSearch, selectedChain);
  const { results: toResults } = useTokenSearch(toSearch, selectedChain);

  // When chain changes, reset from token to native
  const handleChainChange = useCallback((chainId: number) => {
    const info = CHAINS.find((c) => c.id === chainId) ?? CHAINS[0];
    setSelectedChain(chainId);
    setFromToken(NATIVE_ADDRESS);
    setFromSymbol(info.native);
    setFromDecimals(18);
    setToToken("");
    setToSymbol("");
    setAmount("");
    setSwapTxHash(null);
    setSwapError(null);
    setShowChainDropdown(false);
  }, []);

  // User's REAL wallet balance via wagmi
  const isNativeFrom = fromToken === NATIVE_ADDRESS;
  const { data: nativeBalance } = useBalance({
    address: userAddress,
    chainId: selectedChain,
  });
  // ERC20 balance via balanceOf
  const { data: erc20Raw } = useReadContract({
    address: isNativeFrom ? undefined : (fromToken as Address),
    abi: [{ name: "balanceOf", type: "function", inputs: [{ name: "account", type: "address" }], outputs: [{ type: "uint256" }], stateMutability: "view" }] as const,
    functionName: "balanceOf",
    args: userAddress ? [userAddress] : undefined,
    chainId: selectedChain,
    query: { enabled: !isNativeFrom && !!userAddress },
  });
  const balanceDisplay = isNativeFrom
    ? nativeBalance
      ? `${(Number(nativeBalance.value) / 10 ** nativeBalance.decimals).toFixed(6)} ${nativeBalance.symbol}`
      : "0"
    : erc20Raw != null
      ? `${(Number(erc20Raw) / 10 ** fromDecimals).toFixed(6)} ${fromSymbol}`
      : "0";
  const userBalance = isNativeFrom
    ? (nativeBalance ? Number(nativeBalance.value) / 10 ** nativeBalance.decimals : 0)
    : (erc20Raw != null ? Number(erc20Raw) / 10 ** fromDecimals : 0);

  // Popular/hot tokens on selected chain
  const { data: popularData } = useQuery({
    queryKey: ["popular-tokens", selectedChain],
    queryFn: () => fetchPopularTokens(selectedChain),
    staleTime: STALE_SLOW,
  });
  const popularTokens: TokenOption[] = (() => {
    const raw = (popularData as Record<string, unknown>)?.data;
    const list = Array.isArray(raw) ? raw : ((raw as Record<string, unknown>)?.tokenList ?? (raw as Record<string, unknown>)?.data);
    if (!Array.isArray(list)) return [];
    return (list as Record<string, unknown>[]).slice(0, 8).map((t) => ({
      address: String(t.tokenContractAddress ?? t.address ?? ""),
      symbol: String(t.tokenSymbol ?? t.symbol ?? ""),
      name: String(t.tokenName ?? t.name ?? ""),
      decimals: Number(t.decimal ?? t.decimals ?? 18),
    })).filter((t) => t.address && t.symbol);
  })();

  // Gas — directly from selected chain RPC, no backend
  const { data: gasPrice } = useGasPrice({ chainId: selectedChain });
  const gasGwei = gasPrice ? (Number(gasPrice) / 1e9).toFixed(2) : "--";

  // Swap quote from OKX DEX — pass selected chain
  const { data: quoteData } = useQuery({
    queryKey: ["swap-quote", fromToken, toToken, amount, selectedChain, router, fromDecimals],
    queryFn: () => fetchSwapQuote(fromToken, toToken, amount, selectedChain, router, userAddress, fromDecimals),
    enabled: !!fromToken && !!toToken && !!amount && Number(amount) > 0 && toToken.length >= 40,
    staleTime: STALE_FAST,
    refetchInterval: REFETCH_NORMAL,
  });

  // Use actual amounts from quote — unwrap nested responses
  const quoteSource = (quoteData as Record<string, unknown>)?.source as string | undefined;
  const rawQuote = (quoteData as Record<string, unknown>)?.data;
  // OKX may return {data: {...}} or {data: [{...}]} or flat object
  const qData = (
    Array.isArray(rawQuote) ? rawQuote[0]
    : (rawQuote as Record<string, unknown>)?.data != null
      ? (Array.isArray((rawQuote as Record<string, unknown>).data)
          ? ((rawQuote as Record<string, unknown>).data as Record<string, unknown>[])[0]
          : (rawQuote as Record<string, unknown>).data)
      : rawQuote
  ) as Record<string, unknown> | undefined;
  // Parse toTokenAmount — handle OKX format AND Uniswap fallback format
  const toTokenAmountRaw = Number(String(
    qData?.toTokenAmount ?? qData?.quoteGasAdjusted ?? qData?.amount ?? "0",
  ));
  const toTokenDecimal = Number(
    (qData?.toToken as Record<string, unknown>)?.decimal ?? qData?.toTokenDecimal ?? 18,
  );
  const fromTokenAmountRaw = Number(String(
    qData?.fromTokenAmount ?? amount ?? "0",
  ));
  const fromTokenDecimal = Number(
    (qData?.fromToken as Record<string, unknown>)?.decimal ?? qData?.fromTokenDecimal ?? fromDecimals,
  );
  // For OKX: amounts are in wei. For Uniswap: also in wei.
  const toAmt = toTokenAmountRaw / 10 ** toTokenDecimal;
  const fromAmt = fromTokenAmountRaw > 1e10
    ? fromTokenAmountRaw / 10 ** fromTokenDecimal  // wei
    : Number(amount || 0);  // readable amount
  const estimatedOut = toAmt > 0
    ? toAmt.toLocaleString(undefined, { maximumFractionDigits: 6 })
    : "0";
  const rateStr = fromAmt > 0 && toAmt > 0
    ? (toAmt / fromAmt).toLocaleString(undefined, { maximumFractionDigits: 6 })
    : "--";

  // Pre-flight security — skip for native token address
  const isNativeTo = toToken === NATIVE_ADDRESS;
  const { data: toVerdict, isLoading: verdictLoading } = useQuery({
    queryKey: ["swap-preflight", toToken, selectedChain],
    queryFn: () => fetchSwapSecurity(toToken, selectedChain),
    enabled: !!toToken && toToken.length === 42 && !isNativeTo,
    staleTime: 5 * 60_000, // 5 min — GoPlus data is stable
  });

  // Wait for receipt
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash: swapTxHash as `0x${string}` | undefined,
  });

  const [approveStatus, setApproveStatus] = useState<"idle" | "approving" | "approved">("idle");

  // Execute swap: approve ERC20 if needed → get calldata → sign
  const handleSwap = useCallback(async () => {
    if (!isConnected || !userAddress) return;
    setSwapError(null);
    setSwapTxHash(null);
    setIsSending(true);

    try {
      // 0. Switch chain first
      if (walletChainId !== selectedChain) {
        await switchChainAsync({ chainId: selectedChain });
      }
      const client = await getWalletClient(wagmiConfig);
      if (!client) throw new Error("Wallet not connected");

      // 1. Get calldata to find router address
      const calldataRes = await fetchSwapCalldata(
        fromToken, toToken, amount, userAddress, selectedChain, slippage, router, fromDecimals,
      );
      const rawCd = (calldataRes as Record<string, unknown>)?.data;
      const cdOuter = (
        Array.isArray(rawCd) ? rawCd[0]
        : (rawCd as Record<string, unknown>)?.data != null
          ? (Array.isArray((rawCd as Record<string, unknown>).data)
              ? ((rawCd as Record<string, unknown>).data as Record<string, unknown>[])[0]
              : (rawCd as Record<string, unknown>).data)
          : rawCd
      ) as Record<string, unknown> | undefined;
      const txData = (cdOuter?.tx ?? cdOuter) as Record<string, unknown> | undefined;

      const routerAddress = String(txData?.to ?? txData?.dexContractAddress ?? "");
      const calldata = String(txData?.data ?? txData?.calldata ?? "");
      const txValue = String(txData?.value ?? "0");

      if (!routerAddress || !calldata || calldata === "undefined") {
        throw new Error("Swap calldata not available for this pair/chain");
      }

      // 2. If ERC20 from-token, check allowance and approve if needed
      if (!isNativeFrom && approveStatus !== "approved") {
        setApproveStatus("approving");

        // Check current allowance
        const allowanceAbi = [{
          name: "allowance", type: "function", stateMutability: "view",
          inputs: [{ name: "owner", type: "address" }, { name: "spender", type: "address" }],
          outputs: [{ type: "uint256" }],
        }] as const;

        const { createPublicClient, http: viemHttp } = await import("viem");
        const chains = await import("viem/chains");
        const xlayerChain = defineChain({
          id: 196, name: "X Layer",
          nativeCurrency: { name: "OKB", symbol: "OKB", decimals: 18 },
          rpcUrls: { default: { http: ["https://rpc.xlayer.tech"] } },
        });
        const chainMap: Record<number, Parameters<typeof createPublicClient>[0]["chain"]> = {
          1: chains.mainnet, 137: chains.polygon, 56: chains.bsc, 42161: chains.arbitrum, 10: chains.optimism, 8453: chains.base, 324: chains.zksync, 250: chains.fantom, 43114: chains.avalanche, 196: xlayerChain,
        };
        const viemChain = chainMap[selectedChain];
        let currentAllowance = BigInt(0);

        if (viemChain) {
          const pub = createPublicClient({ chain: viemChain, transport: viemHttp() });
          try {
            currentAllowance = await pub.readContract({
              address: fromToken as Address,
              abi: allowanceAbi,
              functionName: "allowance",
              args: [userAddress as Address, routerAddress as Address],
            }) as bigint;
          } catch { /* allowance check failed, proceed with approve */ }
        }

        const neededAmount = parseUnits(amount, fromDecimals);
        if (currentAllowance < neededAmount) {
          // Send approve TX — max approval
          const approveCalldata = encodeFunctionData({
            abi: [{ name: "approve", type: "function", inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ type: "bool" }] }] as const,
            functionName: "approve",
            args: [routerAddress as Address, maxUint256],
          });

          const approveTx = await client.sendTransaction({
            to: fromToken as Address,
            data: approveCalldata,
            chain: null,
          });

          // Wait for approval confirmation
          if (viemChain) {
            const pub = createPublicClient({ chain: viemChain, transport: viemHttp() });
            await pub.waitForTransactionReceipt({ hash: approveTx as `0x${string}` });
          }

          setApproveStatus("approved");
        } else {
          setApproveStatus("approved");
        }
      }

      // 3. Send swap TX — user signs in wallet
      const hash = await client.sendTransaction({
        to: routerAddress as Address,
        data: calldata as `0x${string}`,
        value: BigInt(txValue),
        chain: null,
      });

      setSwapTxHash(hash);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes("User rejected") && !msg.includes("denied")) {
        setSwapError(msg.slice(0, 200));
      }
      setApproveStatus("idle");
    } finally {
      setIsSending(false);
    }
  }, [isConnected, userAddress, fromToken, toToken, amount, selectedChain, slippage, walletChainId, switchChainAsync, wagmiConfig, isNativeFrom, approveStatus, fromDecimals, router]);

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
    setSwapTxHash(null);
    setSwapError(null);
    setApproveStatus("idle");
  }, []);

  const handleSelectTo = useCallback((opt: TokenOption) => {
    setToToken(opt.address);
    setToSymbol(opt.symbol);
    setToSearch("");
    setShowToDropdown(false);
    setSwapTxHash(null);
    setSwapError(null);
    setDangerAcked(false);
  }, []);

  const isDangerous = toVerdict?.verdict === "DANGEROUS";
  const [dangerAcked, setDangerAcked] = useState(false);
  const insufficientBalance = Number(amount) > userBalance;
  const canExecute = isConnected && fromToken && toToken && amount && Number(amount) > 0 && !insufficientBalance && !isSending && !isConfirming;

  return (
    <div className="max-w-md">
      {!isConnected && (
        <div className="mb-4 px-3 py-2 border border-[#f59e0b]/30 rounded text-[11px] font-mono text-[#f59e0b]">
          Connect wallet to swap
        </div>
      )}

      {/* Chain Selector */}
      <div className="mb-4 relative">
        <label className="block text-[11px] text-[#52525b] font-mono mb-1">Network</label>
        <button
          type="button"
          onClick={() => setShowChainDropdown(!showChainDropdown)}
          className="w-full bg-white/[0.04] border border-white/[0.06] rounded px-3 py-2 text-xs font-mono text-[#fafafa] hover:bg-white/[0.08] transition-colors cursor-pointer flex items-center justify-between"
        >
          <span>{chainInfo.name}</span>
          <span className="text-[#52525b] text-[10px]">{chainInfo.native}</span>
        </button>
        {showChainDropdown && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setShowChainDropdown(false)} />
            <div className="absolute left-0 right-0 top-full mt-1 z-20 bg-[#111113] border border-white/[0.06] rounded shadow-xl max-h-56 overflow-y-auto">
              {CHAINS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => handleChainChange(c.id)}
                  className={`w-full text-left px-3 py-2 text-xs font-mono hover:bg-white/[0.04] transition-colors cursor-pointer flex justify-between items-center ${
                    selectedChain === c.id ? "text-[#06b6d4]" : "text-[#fafafa]"
                  }`}
                >
                  <span>{c.name}</span>
                  <span className="text-[#52525b] text-[10px]">{c.native}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Popular Tokens — quick pick */}
      {popularTokens.length > 0 && (
        <div className="mb-4">
          <label className="block text-[11px] text-[#52525b] font-mono mb-1.5">Trending on {chainInfo.name}</label>
          <div className="flex gap-1.5 flex-wrap">
            {popularTokens.map((t) => (
              <button
                key={t.address}
                type="button"
                onClick={() => {
                  setToToken(t.address);
                  setToSymbol(t.symbol);
                  setSwapTxHash(null);
                  setSwapError(null);
                  setDangerAcked(false);
                }}
                className={`px-2.5 py-1 rounded text-[10px] font-mono border transition-colors cursor-pointer ${
                  toToken === t.address
                    ? "border-[#06b6d4]/40 text-[#06b6d4] bg-[#06b6d4]/10"
                    : "border-white/[0.06] text-[#a1a1aa] hover:text-[#fafafa] hover:border-white/[0.12]"
                }`}
              >
                {t.symbol}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* From Token */}
      <div className="mb-3">
        <label className="block text-[11px] text-[#52525b] font-mono mb-1">From</label>
        <div className="relative">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { setShowFromDropdown(!showFromDropdown); setShowToDropdown(false); setShowChainDropdown(false); }}
              className="shrink-0 bg-white/[0.04] border border-white/[0.06] rounded px-3 py-2 text-xs font-mono text-[#fafafa] hover:bg-white/[0.08] transition-colors cursor-pointer"
            >
              {fromSymbol || "Select"}
            </button>
            <input
              type="text"
              inputMode="decimal"
              placeholder="0.0"
              value={amount}
              onChange={(e) => { setAmount(e.target.value); setSwapTxHash(null); setSwapError(null); }}
              className="flex-1 bg-white/[0.04] border border-white/[0.06] rounded px-3 py-2 text-xs font-mono text-[#fafafa] placeholder:text-[#52525b] outline-none focus:border-[#06b6d4]/40"
            />
          </div>
          <div className="mt-1 text-[10px] font-mono text-[#52525b]">
            Balance: {balanceDisplay}
          </div>
          {showFromDropdown && (
            <TokenDropdown search={fromSearch} onSearch={setFromSearch} results={fromResults} onSelect={handleSelectFrom} onClose={() => setShowFromDropdown(false)} popular={popularTokens} />
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
              onClick={() => { setShowToDropdown(!showToDropdown); setShowFromDropdown(false); setShowChainDropdown(false); }}
              className="shrink-0 bg-white/[0.04] border border-white/[0.06] rounded px-3 py-2 text-xs font-mono text-[#fafafa] hover:bg-white/[0.08] transition-colors cursor-pointer"
            >
              {toSymbol || "Select"}
            </button>
            <input type="text" readOnly placeholder="0.0" value={estimatedOut} className="flex-1 bg-white/[0.04] border border-white/[0.06] rounded px-3 py-2 text-xs font-mono text-[#52525b] outline-none" />
          </div>
          {showToDropdown && (
            <TokenDropdown search={toSearch} onSearch={setToSearch} results={toResults} onSelect={handleSelectTo} onClose={() => setShowToDropdown(false)} popular={popularTokens} />
          )}
        </div>
      </div>

      {/* PreFlight — skip for native tokens */}
      {toToken && toToken.length === 42 && !isNativeTo && (
        <div className="mb-4">
          <SwapPreFlight token={toToken} verdict={toVerdict ?? null} loading={verdictLoading} tokenSymbol={toSymbol} />
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
        <div className="flex justify-between items-center">
          <span>Router</span>
          <div className="flex gap-1">
            {(["auto", "okx", "uniswap"] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRouter(r)}
                className={`px-2.5 py-1 rounded text-[10px] font-mono border transition-colors cursor-pointer ${
                  router === r
                    ? "border-[#06b6d4]/40 text-[#06b6d4] bg-[#06b6d4]/10"
                    : "border-white/[0.06] text-[#52525b] hover:text-[#a1a1aa]"
                }`}
              >
                {r === "auto" ? "Auto" : r === "okx" ? "OKX DEX" : "Uniswap"}
              </button>
            ))}
          </div>
        </div>
        {quoteSource && (
          <div className="flex justify-between items-center">
            <span>Source</span>
            <span className="text-[#06b6d4]">{quoteSource === "okx" ? "OKX DEX" : "Uniswap"}</span>
          </div>
        )}
      </div>

      {/* Danger acknowledgment */}
      {isDangerous && !dangerAcked && canExecute && (
        <div className="mb-3 bg-red-500/[0.06] border border-red-500/20 rounded px-3 py-2">
          <p className="text-[11px] font-mono text-red-400 mb-2">
            This token is flagged as DANGEROUS (risk {toVerdict?.riskScore}/100). Proceed at your own risk.
          </p>
          <button
            type="button"
            onClick={() => setDangerAcked(true)}
            className="text-[10px] font-semibold text-red-400 border border-red-500/30 rounded px-2.5 py-1 hover:bg-red-500/10 transition-colors cursor-pointer"
          >
            I understand the risks
          </button>
        </div>
      )}

      {/* Execute — user signs via wallet */}
      <button
        type="button"
        disabled={!canExecute || (isDangerous && !dangerAcked)}
        onClick={handleSwap}
        className={`w-full py-2.5 rounded text-xs font-semibold transition-colors cursor-pointer ${
          isDangerous && dangerAcked && canExecute
            ? "bg-red-500/80 text-white hover:bg-red-500/60"
            : canExecute && !(isDangerous && !dangerAcked)
              ? "bg-[#06b6d4] text-[#09090b] hover:bg-[#06b6d4]/80"
              : "bg-white/[0.06] text-[#52525b] cursor-not-allowed"
        }`}
      >
        {!isConnected
          ? "Connect Wallet"
          : isSending && approveStatus === "approving"
            ? "Approve Token in Wallet..."
            : isSending
              ? "Confirm Swap in Wallet..."
              : isConfirming
              ? "Confirming..."
              : isConfirmed
                ? "Swap Confirmed!"
                : isDangerous && !dangerAcked
                  ? "Risky Token - Acknowledge First"
                  : insufficientBalance
                    ? `Insufficient ${fromSymbol} Balance`
                    : isDangerous
                      ? `Swap on ${chainInfo.name} (Risky)`
                      : `Swap on ${chainInfo.name}`}
      </button>

      {isConfirmed && swapTxHash && (
        <p className="mt-2 text-[11px] font-mono text-emerald-400">
          TX confirmed:{" "}
          <a href={`${EXPLORER_TX[selectedChain] ?? EXPLORER_TX[196]}${swapTxHash}`} target="_blank" rel="noopener noreferrer" className="underline">
            {swapTxHash.slice(0, 10)}...
          </a>
        </p>
      )}
      {swapError && (
        <p className="mt-2 text-[11px] font-mono text-red-400">
          {swapError}
        </p>
      )}
    </div>
  );
}

/* ── Token Search Dropdown ─────────────────────────────────────── */

function TokenDropdown({
  search, onSearch, results, onSelect, onClose, popular,
}: {
  search: string; onSearch: (q: string) => void; results: TokenOption[]; onSelect: (opt: TokenOption) => void; onClose: () => void; popular?: TokenOption[];
}): React.ReactNode {
  const showPopular = !search && popular && popular.length > 0;
  const displayList = results.length > 0 ? results : (showPopular ? popular : []);
  return (
    <>
      <div className="fixed inset-0 z-10" onClick={onClose} />
      <div className="absolute left-0 right-0 top-full mt-1 z-20 bg-[#111113] border border-white/[0.06] rounded shadow-xl max-h-56 overflow-y-auto">
        <input type="text" autoFocus placeholder="Search token or paste address..." value={search} onChange={(e) => onSearch(e.target.value)} className="w-full bg-transparent border-b border-white/[0.06] px-3 py-2 text-xs font-mono text-[#fafafa] placeholder:text-[#52525b] outline-none" />
        {showPopular && results.length === 0 && (
          <div className="px-3 py-1.5 text-[10px] text-[#52525b] font-mono uppercase tracking-wider">Trending</div>
        )}
        {results.length === 0 && search.length >= 2 && !showPopular && (
          <div className="px-3 py-2 text-[11px] text-[#52525b] font-mono">No results</div>
        )}
        {displayList.map((opt, i) => (
          <button key={`${opt.address}-${i}`} type="button" onClick={() => onSelect(opt)} className="w-full text-left px-3 py-2 text-xs font-mono hover:bg-white/[0.04] transition-colors cursor-pointer flex justify-between items-center">
            <span className="text-[#fafafa]">{opt.symbol}</span>
            <span className="text-[#52525b] text-[10px]">{opt.name}</span>
          </button>
        ))}
      </div>
    </>
  );
}
