"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useAccount, useBalance, useReadContract, useChainId, useConfig, useSwitchChain } from "wagmi";
import { getWalletClient } from "@wagmi/core";
import { type Address, erc20Abi, encodeFunctionData, maxUint256, createPublicClient, http as viemHttp } from "viem";
import * as viemChains from "viem/chains";
import {
  fetchDefiDetail,
  fetchDefiPrepare,
  fetchDefiDepositCalldata,
  formatUsd,
  STALE_NORMAL,
} from "../../../../lib/api";
import { TypeBadge } from "../../../../components/type-badge";
import { TickRangeSelector } from "../../../../components/tick-range-selector";

type Step = "input" | "depositing" | "confirming" | "success" | "error";

const CHAIN_NAME_TO_ID: Record<string, number> = {
  Ethereum: 1, BNB: 56, Polygon: 137, Arbitrum: 42161, Optimism: 10,
  Base: 8453, "X Layer": 196, zkSync: 324, Avalanche: 43114, Fantom: 250,
};

export default function DepositPage(): React.ReactNode {
  const { investmentId } = useParams<{ investmentId: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const walletChainId = useChainId();
  const wagmiConfig = useConfig();
  const { switchChainAsync } = useSwitchChain();
  const [amount, setAmount] = useState("");
  const [slippage, setSlippage] = useState("0.5");
  const [selectedTokenIdx, setSelectedTokenIdx] = useState(0);
  const [tickLower, setTickLower] = useState<number | undefined>();
  const [tickUpper, setTickUpper] = useState<number | undefined>();
  const [step, setStep] = useState<Step>("input");
  const [errorMsg, setErrorMsg] = useState("");
  const [txHash, setTxHash] = useState<string | null>(null);

  // For DefiLlama pools: token name and chain passed as query params
  const tokenHint = searchParams.get("token") ?? undefined;
  const chainHint = searchParams.get("chain") ?? undefined;
  const chainId = chainHint ? CHAIN_NAME_TO_ID[chainHint] : undefined;
  const isNumericId = /^\d+$/.test(investmentId);

  // Pool detail — pass token/chain hints for non-numeric IDs (DefiLlama UUIDs)
  const { data: detail, isLoading: detailLoading } = useQuery({
    queryKey: ["defi-detail", investmentId, tokenHint, chainId],
    queryFn: () => fetchDefiDetail(investmentId, tokenHint, chainId),
    staleTime: STALE_NORMAL,
  });

  // Resolved investmentId from search (for DefiLlama pools)
  const resolvedId = useMemo(() => {
    if (isNumericId) return investmentId;
    const data = ((detail as Record<string, unknown>)?.data ?? detail) as Record<string, unknown> | undefined;
    return data?.resolvedInvestmentId ? String(data.resolvedInvestmentId) : investmentId;
  }, [detail, investmentId, isNumericId]);

  // Prepare (tick info for LP) — use resolved ID
  const { data: prepareData } = useQuery({
    queryKey: ["defi-prepare", resolvedId],
    queryFn: () => fetchDefiPrepare(resolvedId),
    enabled: /^\d+$/.test(resolvedId),
    staleTime: STALE_NORMAL,
  });

  // Unwrap detail — onchainos detail has nested structures
  const detailInner = ((detail as Record<string, unknown>)?.data ?? detail) as Record<string, unknown> | undefined;
  const aboutTokens = detailInner?.aboutToken as Record<string, unknown>[] | undefined;
  const baseToken = aboutTokens?.[0];
  const logoList = detailInner?.bottomRightLogoList as Record<string, unknown>[] | undefined;

  const poolName = String(detailInner?.name ?? detailInner?.poolName ?? "") ||
    (aboutTokens && aboutTokens.length > 1
      ? aboutTokens.map((t) => String(t.tokenSymbol ?? "")).join("-")
      : String(baseToken?.tokenSymbol ?? tokenHint ?? ""));
  const platform = String(logoList?.[0]?.tokenName ?? detailInner?.platformName ?? detailInner?.platform ?? "");
  const apy = Number(detailInner?.baseRate ?? detailInner?.rate ?? detailInner?.apy ?? 0) * 100;
  const tvl = Number(detailInner?.tvl ?? 0);
  const productType = String(detailInner?.investType ?? detailInner?.productGroup ?? "DEX_POOL");
  const isLP = productType === "DEX_POOL" || poolName.includes("/") || poolName.includes("-");

  // Prepare data — use currentPrice directly (string from API), fallback to tick calculation
  const prepInner = ((prepareData as Record<string, unknown>)?.data ?? prepareData) as Record<string, unknown> | undefined;
  const tickSpacing = Number(prepInner?.tickSpacing ?? 60);
  const currentPrice = Number(prepInner?.currentPrice ?? 0) ||
    (Number(prepInner?.currentTick ?? 0) !== 0 ? Math.pow(1.0001, Number(prepInner?.currentTick)) : 0);

  // Deposit tokens — from prepare.investWithTokenList (preferred) or detail.aboutToken
  const investTokens = (prepInner?.investWithTokenList ?? aboutTokens ?? []) as Record<string, unknown>[];
  const selectedToken = investTokens[selectedTokenIdx] ?? investTokens[0] ?? baseToken;
  const tokenAddr = String(selectedToken?.tokenAddress ?? selectedToken?.tokenContractAddress ?? "");
  const tokenSymbol = String(selectedToken?.tokenSymbol ?? "");
  const decimals = Number(selectedToken?.tokenPrecision ?? selectedToken?.decimal ?? 18);
  // Pool's chain from prepare or detail
  const tokenList = Array.isArray(prepInner?.investWithTokenList) ? prepInner.investWithTokenList as Record<string, unknown>[] : [];
  const poolChainId = Number(selectedToken?.chainIndex ?? tokenList[0]?.chainIndex ?? detailInner?.chainIndex ?? chainId ?? 0) || undefined;

  // Wallet balance — native vs ERC20, with correct chainId for cross-chain
  const isNativeToken = !tokenAddr || tokenAddr.toLowerCase() === "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";
  const { data: nativeBalance } = useBalance({ address, chainId: poolChainId });
  const { data: erc20BalanceRaw } = useReadContract({
    address: (!isNativeToken && tokenAddr) ? (tokenAddr as Address) : undefined,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: poolChainId,
    query: { enabled: !isNativeToken && !!address && !!tokenAddr },
  });
  const walletBalance = isNativeToken
    ? nativeBalance
    : erc20BalanceRaw !== undefined
      ? { value: erc20BalanceRaw, decimals, symbol: tokenSymbol }
      : undefined;
  const balanceDisplay = walletBalance
    ? `${(Number(walletBalance.value) / 10 ** walletBalance.decimals).toFixed(6)} ${walletBalance.symbol}`
    : "—";

  // Chain map for public client
  const chainMap: Record<number, Parameters<typeof createPublicClient>[0]["chain"]> = {
    1: viemChains.mainnet, 137: viemChains.polygon, 56: viemChains.bsc,
    42161: viemChains.arbitrum, 10: viemChains.optimism, 8453: viemChains.base,
    324: viemChains.zksync, 250: viemChains.fantom, 43114: viemChains.avalanche,
  };

  // Handle deposit — same pattern as swap: walletClient.sendTransaction with chain: null
  const handleDeposit = useCallback(async () => {
    if (!isConnected || !address || !amount || Number(amount) <= 0) return;
    setStep("depositing");
    setErrorMsg("");
    setTxHash(null);

    try {
      // 0. Switch chain if needed
      const targetChain = poolChainId ?? 8453;
      if (walletChainId !== targetChain) {
        await switchChainAsync({ chainId: targetChain });
      }
      const client = await getWalletClient(wagmiConfig);
      if (!client) throw new Error("Wallet not connected");

      // 1. Build userInput with correct OKX fields
      const coinAmount = BigInt(Math.floor(Number(amount) * 10 ** decimals)).toString();
      const userInput = JSON.stringify([{
        tokenAddress: tokenAddr,
        coinAmount,
        tokenPrecision: String(decimals),
        chainIndex: String(targetChain),
      }]);

      // 2. Get deposit calldata from API
      const result = await fetchDefiDepositCalldata({
        investmentId: resolvedId,
        address,
        userInput,
        slippage: (Number(slippage) / 100).toString(),
        tickLower: isLP ? tickLower : undefined,
        tickUpper: isLP ? tickUpper : undefined,
      });

      const data = (result?.data ?? result) as Record<string, unknown>;
      const dataList = (data?.dataList ?? []) as Record<string, unknown>[];

      if (dataList.length === 0) {
        throw new Error("No deposit transactions returned from API");
      }

      // 3. Execute dataList entries in order (may include APPROVE → DEPOSIT)
      const viemChain = chainMap[targetChain];
      const pub = viemChain ? createPublicClient({ chain: viemChain, transport: viemHttp() }) : null;

      for (const txItem of dataList) {
        const to = String(txItem?.to ?? "");
        const calldata = String(txItem?.serializedData ?? txItem?.data ?? "");
        const txValue = String(txItem?.value ?? "0");
        const callType = String(txItem?.callDataType ?? "");

        if (!to || !calldata) {
          throw new Error(`Missing tx data for ${callType || "deposit"} step`);
        }

        // 3a. If APPROVE step and ERC20, check allowance first
        if (callType === "APPROVE" && !isNativeToken) {
          try {
            const currentAllowance = pub ? await pub.readContract({
              address: tokenAddr as Address,
              abi: erc20Abi,
              functionName: "allowance",
              args: [address, to as Address],
            }) : BigInt(0);
            const needed = BigInt(coinAmount);
            if (currentAllowance >= needed) continue; // skip approve if already sufficient
          } catch { /* proceed with approve */ }
        }

        const hash = await client.sendTransaction({
          to: to as Address,
          data: calldata as `0x${string}`,
          value: BigInt(txValue),
          chain: null,
        });

        // Wait for confirmation before next step
        if (pub) {
          setStep("confirming");
          await pub.waitForTransactionReceipt({ hash });
        }

        setTxHash(hash);
      }

      setStep("success");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("User rejected") || msg.includes("denied")) {
        setStep("input");
      } else {
        setStep("error");
        setErrorMsg(msg.slice(0, 200));
      }
    }
  }, [isConnected, address, amount, tokenAddr, decimals, poolChainId, walletChainId, switchChainAsync, wagmiConfig, resolvedId, slippage, isLP, tickLower, tickUpper, isNativeToken, chainMap]);

  const currentTick = Number(prepInner?.currentTick ?? 0);
  const handleRangeChange = useCallback((lower: number, upper: number) => {
    if (currentPrice > 0 && currentTick !== 0) {
      // Compute tick offsets relative to currentTick using price ratio
      const lowerOffset = Math.log(lower / currentPrice) / Math.log(1.0001);
      const upperOffset = Math.log(upper / currentPrice) / Math.log(1.0001);
      setTickLower(Math.floor((currentTick + lowerOffset) / tickSpacing) * tickSpacing);
      setTickUpper(Math.ceil((currentTick + upperOffset) / tickSpacing) * tickSpacing);
    }
  }, [currentPrice, currentTick, tickSpacing]);

  const SLIPPAGES = ["0.1", "0.5", "1", "3"];

  if (detailLoading) {
    return (
      <div className="mx-auto max-w-[800px] px-6 lg:px-10 py-8">
        <div className="h-4 w-16 bg-white/[0.04] animate-pulse rounded mb-6" />
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-10 bg-white/[0.04] animate-pulse rounded" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[800px] px-6 lg:px-10 py-8">
      <button
        onClick={() => router.push("/defi")}
        className="text-xs font-mono text-[#52525b] hover:text-[#fafafa] transition-colors cursor-pointer mb-6 flex items-center gap-1"
      >
        &larr; Back to DeFi
      </button>

      {/* Pool header */}
      <div className="border border-white/[0.06] rounded-lg p-5 mb-6">
        <div className="flex items-center gap-3 mb-3">
          <h1 className="text-base font-semibold text-[#fafafa]">{poolName}</h1>
          <TypeBadge type={productType} />
        </div>
        <div className="flex gap-6 text-[11px] font-mono">
          <div><span className="text-[#52525b]">Protocol </span><span className="text-[#a1a1aa]">{platform}</span></div>
          <div><span className="text-[#52525b]">APY </span><span className="text-emerald-400">{apy.toFixed(2)}%</span></div>
          <div><span className="text-[#52525b]">TVL </span><span className="text-[#a1a1aa]">{formatUsd(tvl)}</span></div>
          {investTokens.length <= 1 && tokenSymbol && <div><span className="text-[#52525b]">Token </span><span className="text-[#a1a1aa]">{tokenSymbol}</span></div>}
          {investTokens.length > 1 && <div><span className="text-[#52525b]">Pair </span><span className="text-[#a1a1aa]">{investTokens.map((t) => String(t.tokenSymbol ?? "")).join(" / ")}</span></div>}
        </div>
      </div>

      {/* Tick range (LP only) */}
      {isLP && currentPrice > 0 && (
        <div className="border border-white/[0.06] rounded-lg p-5 mb-6">
          <TickRangeSelector currentPrice={currentPrice} tickSpacing={tickSpacing} onChange={handleRangeChange} />
        </div>
      )}

      {/* Token selector (LP pools have multiple deposit tokens) */}
      {investTokens.length > 1 && (
        <div className="border border-white/[0.06] rounded-lg p-5 mb-6">
          <div className="text-[11px] text-[#52525b] font-mono mb-2">Deposit Token</div>
          <div className="flex gap-2">
            {investTokens.map((t, i) => {
              const sym = String(t.tokenSymbol ?? "");
              return (
                <button
                  key={i}
                  onClick={() => setSelectedTokenIdx(i)}
                  className={`px-4 py-2 rounded text-xs font-mono font-medium transition-colors cursor-pointer ${
                    selectedTokenIdx === i
                      ? "bg-[#06b6d4]/10 text-[#06b6d4] border border-[#06b6d4]/20"
                      : "bg-white/[0.04] text-[#a1a1aa] border border-white/[0.06] hover:text-[#fafafa]"
                  }`}
                >
                  {sym}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Amount input */}
      <div className="border border-white/[0.06] rounded-lg p-5 mb-6">
        <label className="block text-[11px] text-[#52525b] font-mono mb-2">Deposit Amount ({tokenSymbol})</label>
        <input
          type="text"
          inputMode="decimal"
          placeholder="0.0"
          value={amount}
          onChange={(e) => { setAmount(e.target.value); setStep("input"); setTxHash(null); }}
          className="w-full bg-white/[0.04] border border-white/[0.06] rounded px-3 py-2.5 text-sm font-mono text-[#fafafa] placeholder:text-[#52525b] outline-none focus:border-[#06b6d4]/40"
        />
        <div className="flex justify-between mt-1.5">
          <span className="text-[10px] font-mono text-[#52525b]">Balance: {balanceDisplay}</span>
          <button
            type="button"
            onClick={() => { if (walletBalance) setAmount((Number(walletBalance.value) / 10 ** walletBalance.decimals).toString()); }}
            className="text-[10px] font-mono text-[#06b6d4] hover:text-[#06b6d4]/80 cursor-pointer"
          >
            Max
          </button>
        </div>
      </div>

      {/* Slippage */}
      <div className="border border-white/[0.06] rounded-lg p-5 mb-6">
        <div className="text-[11px] text-[#52525b] font-mono mb-2">Slippage Tolerance</div>
        <div className="flex gap-2">
          {SLIPPAGES.map((s) => (
            <button
              key={s}
              onClick={() => setSlippage(s)}
              className={`px-3 py-1 rounded text-[10px] font-medium transition-colors cursor-pointer ${
                slippage === s
                  ? "bg-[#06b6d4]/10 text-[#06b6d4] border border-[#06b6d4]/20"
                  : "bg-white/[0.04] text-[#a1a1aa] border border-white/[0.06] hover:text-[#fafafa]"
              }`}
            >
              {s}%
            </button>
          ))}
        </div>
      </div>

      {/* Preview */}
      {amount && Number(amount) > 0 && (
        <div className="border border-white/[0.06] rounded-lg p-5 mb-6">
          <div className="text-[11px] text-[#52525b] font-mono mb-2">Preview</div>
          <div className="flex flex-col gap-1.5 text-xs font-mono">
            <div className="flex justify-between">
              <span className="text-[#52525b]">Deposit</span>
              <span className="text-[#fafafa]">{amount} {tokenSymbol}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#52525b]">Expected APY</span>
              <span className="text-emerald-400">{apy.toFixed(2)}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#52525b]">Slippage</span>
              <span className="text-[#a1a1aa]">{slippage}%</span>
            </div>
          </div>
        </div>
      )}

      {/* Action button */}
      {!isConnected ? (
        <div className="px-3 py-2.5 border border-[#f59e0b]/30 rounded text-[11px] font-mono text-[#f59e0b] text-center">
          Connect wallet to deposit
        </div>
      ) : (
        <button
          type="button"
          disabled={!amount || Number(amount) <= 0 || step === "depositing" || step === "confirming"}
          onClick={handleDeposit}
          className={`w-full py-3 rounded text-xs font-semibold transition-colors cursor-pointer ${
            step === "success"
              ? "bg-[#34d399] text-[#09090b]"
              : amount && Number(amount) > 0
                ? "bg-[#06b6d4] text-[#09090b] hover:bg-[#06b6d4]/80"
                : "bg-white/[0.06] text-[#52525b] cursor-not-allowed"
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {step === "depositing" ? "Confirm in Wallet..." :
           step === "confirming" ? "Confirming..." :
           step === "success" ? "Deposit Confirmed!" :
           "Confirm Deposit"}
        </button>
      )}

      {step === "success" && txHash && (
        <p className="text-[11px] font-mono text-emerald-400 text-center mt-3">
          TX: <a href={`https://basescan.org/tx/${txHash}`} target="_blank" rel="noopener noreferrer" className="underline">{txHash.slice(0, 10)}...{txHash.slice(-6)}</a>
        </p>
      )}

      {step === "error" && errorMsg && (
        <p className="text-[11px] font-mono text-red-400 text-center mt-3">{errorMsg}</p>
      )}

      {step === "success" && (
        <button
          onClick={() => router.push("/defi?tab=My Positions")}
          className="w-full mt-3 py-2 rounded text-xs font-mono text-[#06b6d4] border border-[#06b6d4]/20 hover:bg-[#06b6d4]/10 transition-colors cursor-pointer"
        >
          View My Positions &rarr;
        </button>
      )}
    </div>
  );
}
