"use client";

import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  fetchDefiDetail,
  previewInvestment,
  executeInvestment,
  formatUsd,
} from "../lib/api";

interface DefiDepositModalProps {
  investmentId: string;
  poolName: string;
  onClose: () => void;
}

export function DefiDepositModal({ investmentId, poolName, onClose }: DefiDepositModalProps): React.ReactNode {
  const [amount, setAmount] = useState("");
  const [previewData, setPreviewData] = useState<Record<string, unknown> | null>(null);

  const { data: detail, isLoading: detailLoading } = useQuery({
    queryKey: ["defi-detail", investmentId],
    queryFn: () => fetchDefiDetail(investmentId),
  });

  const tokenAddr = String(
    (detail as Record<string, unknown>)?.token ??
    (detail as Record<string, unknown>)?.tokenAddress ??
    ""
  );
  const tokenSymbol = String(
    (detail as Record<string, unknown>)?.tokenSymbol ??
    (detail as Record<string, unknown>)?.symbol ??
    ""
  );
  const apy = Number((detail as Record<string, unknown>)?.apy ?? 0);
  const tvl = Number((detail as Record<string, unknown>)?.tvl ?? 0);

  const previewMutation = useMutation({
    mutationFn: () => previewInvestment(tokenAddr, amount, tokenSymbol),
    onSuccess: (data) => setPreviewData(data),
  });

  const executeMutation = useMutation({
    mutationFn: () => executeInvestment(tokenAddr, amount, tokenSymbol, 0),
  });

  const handlePreview = useCallback(() => {
    if (amount && Number(amount) > 0 && tokenAddr) {
      previewMutation.mutate();
    }
  }, [amount, tokenAddr]);

  const handleConfirm = useCallback(() => {
    executeMutation.mutate();
  }, []);

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
      <div
        className="absolute inset-0"
        onClick={onClose}
      />
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
                  onChange={(e) => {
                    setAmount(e.target.value);
                    setPreviewData(null);
                  }}
                  className="w-full bg-white/[0.04] border border-white/[0.06] rounded px-3 py-2 text-xs font-mono text-[#fafafa] placeholder:text-[#52525b] outline-none focus:border-[#06b6d4]/40"
                />
              </div>

              {/* Preview Button */}
              {!previewData && (
                <button
                  type="button"
                  disabled={!amount || Number(amount) <= 0 || previewMutation.isPending}
                  onClick={handlePreview}
                  className={`w-full py-2 rounded text-xs font-semibold transition-colors cursor-pointer ${
                    amount && Number(amount) > 0
                      ? "bg-white/[0.06] text-[#fafafa] hover:bg-white/[0.10]"
                      : "bg-white/[0.04] text-[#52525b] cursor-not-allowed"
                  }`}
                >
                  {previewMutation.isPending ? "Calculating..." : "Preview"}
                </button>
              )}

              {/* Preview result */}
              {previewData && (
                <div className="bg-white/[0.02] border border-white/[0.06] rounded p-3 space-y-1.5 text-[11px] font-mono text-[#a1a1aa]">
                  <div className="flex justify-between">
                    <span>You deposit</span>
                    <span className="text-[#fafafa]">{amount} {tokenSymbol}</span>
                  </div>
                  {String((previewData as Record<string, unknown>).estimatedShares ?? "") !== "" && (
                    <div className="flex justify-between">
                      <span>Est. shares</span>
                      <span className="text-[#fafafa]">{String((previewData as Record<string, unknown>).estimatedShares)}</span>
                    </div>
                  )}
                  {String((previewData as Record<string, unknown>).estimatedGas ?? "") !== "" && (
                    <div className="flex justify-between">
                      <span>Est. gas</span>
                      <span className="text-[#fafafa]">{String((previewData as Record<string, unknown>).estimatedGas)}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Confirm Button */}
              {previewData && (
                <button
                  type="button"
                  disabled={executeMutation.isPending}
                  onClick={handleConfirm}
                  className="w-full py-2.5 rounded text-xs font-semibold bg-[#06b6d4] text-[#09090b] hover:bg-[#06b6d4]/80 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {executeMutation.isPending
                    ? "Depositing..."
                    : executeMutation.isSuccess
                      ? "Deposit Submitted"
                      : "Confirm Deposit"}
                </button>
              )}

              {executeMutation.isSuccess && (
                <p className="text-[11px] font-mono text-emerald-400 text-center">
                  Deposit submitted successfully.
                </p>
              )}
              {executeMutation.isError && (
                <p className="text-[11px] font-mono text-red-400 text-center">
                  {String((executeMutation.error as Error)?.message ?? "Deposit failed")}
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
