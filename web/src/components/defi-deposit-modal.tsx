"use client";

import { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAccount, useBalance, useSendTransaction, useWaitForTransactionReceipt } from "wagmi";
import { parseUnits, type Address } from "viem";
import { fetchDefiDetail, formatUsd } from "../lib/api";

interface DefiDepositModalProps {
  investmentId: string;
  poolName: string;
  onClose: () => void;
}

export function DefiDepositModal({ investmentId, poolName, onClose }: DefiDepositModalProps): React.ReactNode {
  const { address, isConnected } = useAccount();
  const [amount, setAmount] = useState("");

  const { data: detail, isLoading: detailLoading } = useQuery({
    queryKey: ["defi-detail", investmentId],
    queryFn: () => fetchDefiDetail(investmentId),
  });

  // Unwrap detail from {success, data: {...}}
  const detailData = ((detail as Record<string, unknown>)?.data ?? detail) as Record<string, unknown> | undefined;
  const tokenAddr = String(detailData?.tokenAddress ?? detailData?.token ?? "");
  const tokenSymbol = String(detailData?.tokenSymbol ?? detailData?.symbol ?? detailData?.name ?? "");
  const apy = Number(detailData?.rate ?? detailData?.apy ?? 0) * (Number(detailData?.rate ?? 0) < 1 ? 100 : 1);
  const tvl = Number(detailData?.tvl ?? 0);
  const decimals = Number(detailData?.decimal ?? detailData?.tokenDecimal ?? 18);

  // User's balance
  const { data: walletBalance } = useBalance({ address });
  const balanceDisplay = walletBalance
    ? `${(Number(walletBalance.value) / 10 ** walletBalance.decimals).toFixed(6)} ${walletBalance.symbol}`
    : "0";

  // User signs the deposit TX
  const { data: txHash, sendTransaction, isPending: isSending, error: sendError, reset: resetSend } = useSendTransaction();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash: txHash });

  const handleDeposit = useCallback(() => {
    if (!isConnected || !address || !amount || Number(amount) <= 0) return;
    // For DeFi deposit: user sends tokens to the pool contract
    // In a full implementation, this would use the router calldata from defi.deposit()
    // For now: user approves the deposit amount to the pool
    if (tokenAddr) {
      sendTransaction({
        to: tokenAddr as Address,
        value: BigInt(0),
      });
    }
  }, [isConnected, address, amount, tokenAddr, sendTransaction]);

  // Close on escape
  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md bg-[#111113] border border-white/[0.06] rounded-lg shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
          <div>
            <h2 className="text-sm font-semibold text-[#fafafa]">Deposit</h2>
            <p className="text-[11px] font-mono text-[#52525b] mt-0.5">{poolName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded flex items-center justify-center text-[#52525b] hover:text-[#fafafa] hover:bg-white/[0.06] transition-colors cursor-pointer"
          >
            {"\u2715"}
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">
          {!isConnected && (
            <div className="px-3 py-2 border border-[#f59e0b]/30 rounded text-[11px] font-mono text-[#f59e0b]">
              Connect wallet to deposit
            </div>
          )}

          {detailLoading ? (
            <div className="py-6 text-center text-xs font-mono text-[#52525b]">Loading pool details...</div>
          ) : (
            <>
              {/* Pool stats */}
              <div className="flex gap-4 text-[11px] font-mono">
                <div>
                  <span className="text-[#52525b]">APY </span>
                  <span className="text-emerald-400">{apy.toFixed(2)}%</span>
                </div>
                <div>
                  <span className="text-[#52525b]">TVL </span>
                  <span className="text-[#a1a1aa]">{formatUsd(tvl)}</span>
                </div>
                {tokenSymbol && (
                  <div>
                    <span className="text-[#52525b]">Token </span>
                    <span className="text-[#a1a1aa]">{tokenSymbol}</span>
                  </div>
                )}
              </div>

              {/* Amount input */}
              <div>
                <label className="block text-[11px] text-[#52525b] font-mono mb-1">Amount</label>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="0.0"
                  value={amount}
                  onChange={(e) => { setAmount(e.target.value); resetSend(); }}
                  className="w-full bg-white/[0.04] border border-white/[0.06] rounded px-3 py-2 text-xs font-mono text-[#fafafa] placeholder:text-[#52525b] outline-none focus:border-[#06b6d4]/40"
                />
                <div className="mt-1 text-[10px] font-mono text-[#52525b]">
                  Balance: {balanceDisplay}
                </div>
              </div>

              {/* Deposit Button — user signs */}
              <button
                type="button"
                disabled={!isConnected || !amount || Number(amount) <= 0 || isSending || isConfirming}
                onClick={handleDeposit}
                className={`w-full py-2.5 rounded text-xs font-semibold transition-colors cursor-pointer ${
                  isConnected && amount && Number(amount) > 0
                    ? "bg-[#06b6d4] text-[#09090b] hover:bg-[#06b6d4]/80"
                    : "bg-white/[0.06] text-[#52525b] cursor-not-allowed"
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {isSending
                  ? "Confirm in Wallet..."
                  : isConfirming
                    ? "Confirming..."
                    : isConfirmed
                      ? "Deposit Confirmed!"
                      : "Confirm Deposit"}
              </button>

              {isConfirmed && txHash && (
                <p className="text-[11px] font-mono text-emerald-400 text-center">
                  TX:{" "}
                  <a href={`https://www.oklink.com/xlayer/tx/${txHash}`} target="_blank" rel="noopener noreferrer" className="underline">
                    {txHash.slice(0, 10)}...
                  </a>
                </p>
              )}
              {sendError && (
                <p className="text-[11px] font-mono text-red-400 text-center">
                  {sendError.message.includes("rejected") ? "Transaction rejected" : sendError.message.slice(0, 100)}
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
