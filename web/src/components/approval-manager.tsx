"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAccount, useSendTransaction, useWaitForTransactionReceipt } from "wagmi";
import { encodeFunctionData, type Address } from "viem";
import { fetchApprovals, truncAddr } from "../lib/api";

// ERC20 approve ABI
const approveAbi = [
  {
    name: "approve",
    type: "function",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
] as const;

interface Approval {
  tokenSymbol: string;
  tokenAddress: string;
  spender: string;
  amount: string;
  isUnlimited: boolean;
  chainIndex: number;
  network: string;
}

const EXPLORER_BY_CHAIN: Record<number, string> = {
  1: "https://etherscan.io/tx/",
  196: "https://www.oklink.com/xlayer/tx/",
  56: "https://bscscan.com/tx/",
  137: "https://polygonscan.com/tx/",
  42161: "https://arbiscan.io/tx/",
  10: "https://optimistic.etherscan.io/tx/",
  8453: "https://basescan.org/tx/",
};

export function ApprovalManager(): React.ReactNode {
  const { address, isConnected } = useAccount();
  const [revokingIdx, setRevokingIdx] = useState<number | null>(null);

  const { data, refetch } = useQuery({
    queryKey: ["approvals", address],
    queryFn: () => fetchApprovals(address!),
    enabled: isConnected && !!address,
    refetchInterval: 30_000,
  });

  // Revoke via approve(spender, 0)
  const { data: txHash, sendTransaction, isPending: isSending, reset: resetSend } = useSendTransaction();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash: txHash });

  // Backend returns {success, data: {dataList: [...], cursor, total}}
  const rawData = (data as Record<string, unknown>)?.data as Record<string, unknown> | undefined;
  const dataList = rawData?.dataList as Record<string, unknown>[] | undefined;
  const approvals: Approval[] = Array.isArray(dataList)
    ? dataList.map((a) => ({
        tokenSymbol: String(a.symbol ?? a.tokenSymbol ?? "???"),
        tokenAddress: String(a.tokenAddress ?? a.tokenContractAddress ?? ""),
        spender: String(a.approvalAddress ?? a.spender ?? ""),
        amount: String(a.remainAmtPrecise ?? a.remainAmount ?? a.amount ?? "0"),
        isUnlimited:
          String(a.remainAmount ?? "").length > 15 ||
          Number(a.remainAmount ?? 0) > 1e15,
        chainIndex: Number(a.chainIndex ?? 196),
        network: String(a.network ?? "X Layer"),
      }))
    : [];

  const handleRevoke = (idx: number): void => {
    const approval = approvals[idx];
    if (!approval) return;
    setRevokingIdx(idx);
    resetSend();

    const calldata = encodeFunctionData({
      abi: approveAbi,
      functionName: "approve",
      args: [approval.spender as Address, BigInt(0)],
    });

    sendTransaction({
      to: approval.tokenAddress as Address,
      data: calldata,
    });
  };

  // After confirm, refetch approvals
  if (isConfirmed && revokingIdx !== null) {
    setTimeout(() => {
      refetch();
      setRevokingIdx(null);
      resetSend();
    }, 2000);
  }

  if (!isConnected) {
    return (
      <div className="py-4">
        <div className="text-[10px] font-medium text-[#52525b] uppercase tracking-wider mb-3">Token Approvals</div>
        <p className="text-xs text-[#52525b] font-mono">Connect wallet to view approvals.</p>
      </div>
    );
  }

  return (
    <div className="py-4">
      <div className="text-[10px] font-medium text-[#52525b] uppercase tracking-wider mb-3">
        Token Approvals
        <span className="ml-2 text-[#52525b] normal-case tracking-normal">{truncAddr(address!)}</span>
      </div>
      {approvals.length === 0 ? (
        <p className="text-xs text-[#52525b] font-mono">No active approvals.</p>
      ) : (
        <table className="w-full text-xs font-mono">
          <thead>
            <tr className="text-left border-b border-white/[0.06]">
              <th className="pb-2 font-medium text-[10px] text-[#52525b] uppercase tracking-wider">Token</th>
              <th className="pb-2 font-medium text-[10px] text-[#52525b] uppercase tracking-wider">Spender</th>
              <th className="pb-2 font-medium text-[10px] text-[#52525b] uppercase tracking-wider">Chain</th>
              <th className="pb-2 font-medium text-[10px] text-[#52525b] uppercase tracking-wider text-right">Amount</th>
              <th className="pb-2 font-medium text-[10px] text-[#52525b] uppercase tracking-wider text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {approvals.map((a, i) => {
              const isRevoking = revokingIdx === i && (isSending || isConfirming);
              const wasRevoked = revokingIdx === i && isConfirmed;
              return (
                <tr key={`${a.spender}-${i}`} className="border-b border-white/[0.03]">
                  <td className="py-2 text-[#fafafa]">{a.tokenSymbol}</td>
                  <td className="py-2 text-[#a1a1aa]">{truncAddr(a.spender)}</td>
                  <td className="py-2 text-[#52525b]">{a.network}</td>
                  <td className="py-2 text-right">
                    {a.isUnlimited ? (
                      <span style={{ color: "#f59e0b" }}>Unlimited</span>
                    ) : (
                      <span className="text-[#a1a1aa]">{a.amount}</span>
                    )}
                  </td>
                  <td className="py-2 text-right">
                    {wasRevoked ? (
                      <span className="text-[#34d399]">Revoked</span>
                    ) : (
                      <button
                        type="button"
                        disabled={isRevoking}
                        onClick={() => handleRevoke(i)}
                        className="text-[#ef4444] hover:text-[#f87171] transition-colors disabled:opacity-40 cursor-pointer"
                      >
                        {isRevoking ? "Signing..." : "Revoke"}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      {txHash && isConfirmed && (
        <p className="mt-2 text-[11px] font-mono text-emerald-400">
          Revoked:{" "}
          <a
            href={`${EXPLORER_BY_CHAIN[approvals[revokingIdx ?? 0]?.chainIndex ?? 1] ?? "https://etherscan.io/tx/"}${txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            {String(txHash).slice(0, 10)}...
          </a>
        </p>
      )}
    </div>
  );
}
