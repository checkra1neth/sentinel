"use client";

import { useState, useMemo, useCallback, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAccount, useWalletClient, useSwitchChain } from "wagmi";
import { encodeFunctionData, type Address } from "viem";
import { fetchApprovals, truncAddr, REFETCH_SLOW } from "../lib/api";

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
  protocolName: string;
  amount: string;
  isUnlimited: boolean;
  chainIndex: number;
  network: string;
  blockTime: number;
}

const EXPLORER_TX: Record<number, string> = {
  1: "https://etherscan.io/tx/",
  196: "https://www.oklink.com/xlayer/tx/",
  56: "https://bscscan.com/tx/",
  137: "https://polygonscan.com/tx/",
  42161: "https://arbiscan.io/tx/",
  10: "https://optimistic.etherscan.io/tx/",
  8453: "https://basescan.org/tx/",
};

const EXPLORER_ADDR: Record<number, string> = {
  1: "https://etherscan.io/address/",
  196: "https://www.oklink.com/xlayer/address/",
  56: "https://bscscan.com/address/",
  137: "https://polygonscan.com/address/",
  42161: "https://arbiscan.io/address/",
  10: "https://optimistic.etherscan.io/address/",
  8453: "https://basescan.org/address/",
};

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 2592000) return `${Math.floor(s / 86400)}d ago`;
  if (s < 31536000) return `${Math.floor(s / 2592000)}mo ago`;
  return `${Math.floor(s / 31536000)}y ago`;
}

export function ApprovalManager(): React.ReactNode {
  const { address, isConnected } = useAccount();
  const [selectedChain, setSelectedChain] = useState<number | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [revokedSet, setRevokedSet] = useState<Set<number>>(new Set());
  const [search, setSearch] = useState("");

  const { data, refetch } = useQuery({
    queryKey: ["approvals", address],
    queryFn: () => fetchApprovals(address!),
    enabled: isConnected && !!address,
    refetchInterval: REFETCH_SLOW,
  });

  const { data: walletClient } = useWalletClient();
  const { switchChainAsync } = useSwitchChain();

  // Batch queue state
  const [batchQueue, setBatchQueue] = useState<number[]>([]);
  const [batchTotal, setBatchTotal] = useState(0);
  const [currentIdx, setCurrentIdx] = useState<number | null>(null);
  const [batchStatus, setBatchStatus] = useState<"idle" | "running" | "paused">("idle");
  const [lastTxHash, setLastTxHash] = useState<string | null>(null);
  const batchRunning = useRef(false);

  const rawData = (data as Record<string, unknown>)?.data as Record<string, unknown> | undefined;
  const dataList = rawData?.dataList as Record<string, unknown>[] | undefined;
  const allApprovals: Approval[] = useMemo(() => {
    if (!Array.isArray(dataList)) return [];
    return dataList.map((a) => ({
      tokenSymbol: String(a.symbol ?? a.tokenSymbol ?? "Unknown"),
      tokenAddress: String(a.tokenAddress ?? a.tokenContractAddress ?? ""),
      spender: String(a.approvalAddress ?? a.spender ?? ""),
      protocolName: String(a.protocolName ?? ""),
      amount: String(a.remainAmtPrecise ?? a.remainAmount ?? a.amount ?? "0"),
      isUnlimited: String(a.remainAmount ?? "").length > 15 || Number(a.remainAmount ?? 0) > 1e15,
      chainIndex: Number(a.chainIndex ?? 196),
      network: String(a.network ?? "X Layer"),
      blockTime: Number(a.blockTime ?? 0),
    }));
  }, [dataList]);

  // Unique chains for filter
  const chains = useMemo(() => {
    const map = new Map<number, string>();
    for (const a of allApprovals) map.set(a.chainIndex, a.network);
    return Array.from(map.entries()).sort((a, b) => a[0] - b[0]);
  }, [allApprovals]);

  // Filtered approvals
  const approvals = useMemo(() => {
    let list = allApprovals;
    if (selectedChain !== null) list = list.filter((a) => a.chainIndex === selectedChain);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (a) =>
          a.tokenSymbol.toLowerCase().includes(q) ||
          a.spender.toLowerCase().includes(q) ||
          a.protocolName.toLowerCase().includes(q),
      );
    }
    return list;
  }, [allApprovals, selectedChain, search]);

  // Select all / none
  const allSelected = approvals.length > 0 && selected.size === approvals.length;
  const toggleAll = useCallback(() => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(approvals.map((_, i) => i)));
    }
  }, [allSelected, approvals]);

  const toggleOne = useCallback((idx: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }, []);

  // Send single revoke TX via walletClient — auto-switches chain
  const revokeOne = useCallback(
    async (approval: Approval): Promise<string> => {
      if (!walletClient) throw new Error("Wallet not connected");

      // Switch chain if needed (e.g. approval on Ethereum but wallet on X Layer)
      const currentChain = walletClient.chain?.id;
      if (currentChain !== approval.chainIndex) {
        await switchChainAsync({ chainId: approval.chainIndex });
      }

      const calldata = encodeFunctionData({
        abi: approveAbi,
        functionName: "approve",
        args: [approval.spender as Address, BigInt(0)],
      });
      const hash = await walletClient.sendTransaction({
        to: approval.tokenAddress as Address,
        data: calldata,
        chain: null,
      });
      return hash;
    },
    [walletClient, switchChainAsync],
  );

  // Revoke single
  const handleRevoke = useCallback(
    async (idx: number) => {
      const approval = approvals[idx];
      if (!approval) return;
      setCurrentIdx(idx);
      try {
        const hash = await revokeOne(approval);
        setLastTxHash(hash);
        setRevokedSet((prev) => new Set([...prev, idx]));
      } catch {
        // user rejected
      }
      setCurrentIdx(null);
      refetch();
    },
    [approvals, revokeOne, refetch],
  );

  // Batch revoke — auto-queue, wallet pops up one after another
  const processBatch = useCallback(async (queue: number[]) => {
    batchRunning.current = true;
    setBatchStatus("running");
    for (const idx of queue) {
      if (!batchRunning.current) break; // user cancelled
      const approval = approvals[idx];
      if (!approval || revokedSet.has(idx)) continue;
      setCurrentIdx(idx);
      setBatchQueue((prev) => prev.filter((i) => i !== idx));
      try {
        const hash = await revokeOne(approval);
        setLastTxHash(hash);
        setRevokedSet((prev) => new Set([...prev, idx]));
      } catch {
        // user rejected — pause batch
        setBatchStatus("paused");
        batchRunning.current = false;
        setCurrentIdx(null);
        return;
      }
    }
    batchRunning.current = false;
    setBatchStatus("idle");
    setCurrentIdx(null);
    setSelected(new Set());
    refetch();
  }, [approvals, revokedSet, revokeOne, refetch]);

  const handleBatchRevoke = useCallback(() => {
    const indices = Array.from(selected).filter((i) => !revokedSet.has(i)).sort((a, b) => a - b);
    if (indices.length === 0) return;
    setBatchQueue(indices);
    setBatchTotal(indices.length);
    processBatch(indices);
  }, [selected, revokedSet, processBatch]);

  const handleCancelBatch = useCallback(() => {
    batchRunning.current = false;
    setBatchStatus("idle");
    setBatchQueue([]);
    setCurrentIdx(null);
  }, []);

  const handleResumeBatch = useCallback(() => {
    if (batchQueue.length > 0) processBatch(batchQueue);
  }, [batchQueue, processBatch]);

  const batchDone = batchTotal - batchQueue.length;
  const isBatching = batchStatus === "running" || batchStatus === "paused";

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
      {/* Header */}
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="text-[10px] font-medium text-[#52525b] uppercase tracking-wider">
          Token Approvals
          <span className="ml-2 normal-case tracking-normal">{truncAddr(address!)}</span>
          {allApprovals.length > 0 && (
            <span className="ml-2 text-[#a1a1aa]">{allApprovals.length} total</span>
          )}
        </div>

        {/* Batch revoke button */}
        {selected.size > 0 && !isBatching && (
          <button
            type="button"
            onClick={handleBatchRevoke}
            className="px-3 py-1.5 rounded text-[10px] font-semibold bg-[#ef4444]/10 text-[#ef4444] border border-[#ef4444]/20 hover:bg-[#ef4444]/20 transition-colors cursor-pointer"
          >
            Revoke Selected ({selected.size})
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        {/* Chain filter pills */}
        <button
          type="button"
          onClick={() => setSelectedChain(null)}
          className={`px-2.5 py-1 rounded text-[10px] font-mono border transition-colors cursor-pointer ${
            selectedChain === null
              ? "border-[#06b6d4]/40 text-[#06b6d4] bg-[#06b6d4]/10"
              : "border-white/[0.06] text-[#52525b] hover:text-[#a1a1aa]"
          }`}
        >
          All Chains
        </button>
        {chains.map(([chainId, network]) => {
          const count = allApprovals.filter((a) => a.chainIndex === chainId).length;
          return (
            <button
              key={chainId}
              type="button"
              onClick={() => setSelectedChain(chainId)}
              className={`px-2.5 py-1 rounded text-[10px] font-mono border transition-colors cursor-pointer ${
                selectedChain === chainId
                  ? "border-[#06b6d4]/40 text-[#06b6d4] bg-[#06b6d4]/10"
                  : "border-white/[0.06] text-[#52525b] hover:text-[#a1a1aa]"
              }`}
            >
              {network} ({count})
            </button>
          );
        })}

        {/* Search */}
        <input
          type="text"
          placeholder="Search token or spender..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="ml-auto bg-white/[0.04] border border-white/[0.06] rounded px-2.5 py-1 text-[10px] font-mono text-[#fafafa] placeholder:text-[#52525b] outline-none focus:border-white/[0.12] w-48"
        />
      </div>

      {/* Table */}
      {approvals.length === 0 ? (
        <p className="text-xs text-[#52525b] font-mono py-4">
          {allApprovals.length > 0 ? "No approvals match filter." : "No active approvals."}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="text-left border-b border-white/[0.06]">
                <th className="pb-2 w-8">
                  <button
                    type="button"
                    onClick={toggleAll}
                    className={`w-4 h-4 rounded border flex items-center justify-center cursor-pointer transition-colors ${
                      allSelected
                        ? "border-[#06b6d4] bg-[#06b6d4]/20 text-[#06b6d4]"
                        : "border-white/[0.12] text-transparent hover:border-white/[0.2]"
                    }`}
                  >
                    {allSelected ? "\u2713" : ""}
                  </button>
                </th>
                <th className="pb-2 font-medium text-[10px] text-[#52525b] uppercase tracking-wider">Spender</th>
                <th className="pb-2 font-medium text-[10px] text-[#52525b] uppercase tracking-wider">Token</th>
                <th className="pb-2 font-medium text-[10px] text-[#52525b] uppercase tracking-wider">Chain</th>
                <th className="pb-2 font-medium text-[10px] text-[#52525b] uppercase tracking-wider text-right">Amount</th>
                <th className="pb-2 font-medium text-[10px] text-[#52525b] uppercase tracking-wider text-right">Approved</th>
                <th className="pb-2 font-medium text-[10px] text-[#52525b] uppercase tracking-wider text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {approvals.map((a, i) => {
                const isRevoking = currentIdx === i;
                const wasRevoked = revokedSet.has(i);
                const explorerAddr = EXPLORER_ADDR[a.chainIndex] ?? EXPLORER_ADDR[1];
                return (
                  <tr key={`${a.spender}-${a.tokenAddress}-${i}`} className={`border-b border-white/[0.03] ${wasRevoked ? "opacity-40" : ""}`}>
                    <td className="py-2">
                      <button
                        type="button"
                        onClick={() => toggleOne(i)}
                        disabled={wasRevoked}
                        className={`w-4 h-4 rounded border flex items-center justify-center cursor-pointer transition-colors ${
                          selected.has(i)
                            ? "border-[#06b6d4] bg-[#06b6d4]/20 text-[#06b6d4]"
                            : "border-white/[0.12] text-transparent hover:border-white/[0.2]"
                        } disabled:opacity-30 disabled:cursor-not-allowed`}
                      >
                        {selected.has(i) ? "\u2713" : ""}
                      </button>
                    </td>
                    <td className="py-2">
                      <a
                        href={`${explorerAddr}${a.spender}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#a1a1aa] hover:text-[#fafafa] transition-colors"
                      >
                        {truncAddr(a.spender)}
                        {a.protocolName && (
                          <span className="text-[#52525b] ml-1">({a.protocolName})</span>
                        )}
                      </a>
                    </td>
                    <td className="py-2 text-[#fafafa]">{a.tokenSymbol}</td>
                    <td className="py-2 text-[#52525b]">{a.network}</td>
                    <td className="py-2 text-right">
                      {a.isUnlimited ? (
                        <span style={{ color: "#f59e0b" }}>Unlimited</span>
                      ) : (
                        <span className="text-[#a1a1aa]">{a.amount}</span>
                      )}
                    </td>
                    <td className="py-2 text-right text-[#52525b]">
                      {a.blockTime > 0 ? timeAgo(a.blockTime) : "--"}
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
        </div>
      )}

      {lastTxHash && revokedSet.size > 0 && !isBatching && (
        <p className="mt-2 text-[11px] font-mono text-emerald-400">
          {revokedSet.size} revoked. Last TX:{" "}
          <a
            href={`${EXPLORER_TX[1]}${lastTxHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            {lastTxHash.slice(0, 10)}...
          </a>
        </p>
      )}

      {/* ── Batch Revoke Modal (Rabby-style) ── */}
      {isBatching && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="relative w-full max-w-xl bg-[#111113] border border-white/[0.06] rounded-lg shadow-2xl max-h-[80vh] flex flex-col">
            {/* Header */}
            <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between shrink-0">
              <div>
                <h2 className="text-sm font-semibold text-[#fafafa]">
                  Mass Revoke ({batchDone}/{batchTotal})
                </h2>
                <p className="text-[11px] font-mono text-[#52525b] mt-0.5">
                  {batchStatus === "running"
                    ? "Confirm each TX in your wallet — they auto-queue"
                    : batchStatus === "paused"
                      ? "Paused — user rejected a TX"
                      : `Done — ${batchDone} revoked`}
                </p>
              </div>
              <button
                type="button"
                onClick={handleCancelBatch}
                className="w-7 h-7 rounded flex items-center justify-center text-[#52525b] hover:text-[#fafafa] hover:bg-white/[0.06] transition-colors cursor-pointer"
              >
                {"\u2715"}
              </button>
            </div>

            {/* Progress bar */}
            <div className="px-5 py-2 shrink-0">
              <div className="w-full h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#ef4444] rounded-full transition-all duration-300"
                  style={{ width: `${batchTotal > 0 ? (batchDone / batchTotal) * 100 : 0}%` }}
                />
              </div>
            </div>

            {/* Table */}
            <div className="overflow-y-auto flex-1 px-5">
              <table className="w-full text-xs font-mono">
                <thead>
                  <tr className="text-left border-b border-white/[0.06] text-[#52525b] sticky top-0 bg-[#111113]">
                    <th className="pb-2 font-medium text-[10px] w-8">#</th>
                    <th className="pb-2 font-medium text-[10px]">Token</th>
                    <th className="pb-2 font-medium text-[10px]">Spender</th>
                    <th className="pb-2 font-medium text-[10px] text-center">Status</th>
                    <th className="pb-2 font-medium text-[10px] text-right">Hash</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from(selected).sort((a, b) => a - b).map((idx, n) => {
                    const a = approvals[idx];
                    if (!a) return null;
                    const done = revokedSet.has(idx);
                    const active = currentIdx === idx;
                    const pending = !done && !active;
                    return (
                      <tr key={`batch-${idx}`} className={`border-b border-white/[0.03] ${done ? "opacity-50" : active ? "bg-white/[0.02]" : ""}`}>
                        <td className="py-2 text-[#52525b]">{n + 1}</td>
                        <td className="py-2 text-[#fafafa]">{a.tokenSymbol}</td>
                        <td className="py-2 text-[#a1a1aa]">
                          {truncAddr(a.spender)}
                          {a.protocolName && <span className="text-[#52525b] ml-1">({a.protocolName})</span>}
                        </td>
                        <td className="py-2 text-center">
                          {done ? (
                            <span className="text-[#34d399]">&#10003;</span>
                          ) : active ? (
                            <span className="text-[#f59e0b] animate-pulse">&#9679;</span>
                          ) : (
                            <span className="text-[#52525b]">—</span>
                          )}
                        </td>
                        <td className="py-2 text-right text-[#52525b]">
                          {done && lastTxHash ? `${lastTxHash.slice(0, 8)}...` : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-white/[0.06] shrink-0 flex justify-center">
              {batchStatus === "paused" ? (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleResumeBatch}
                    className="px-4 py-2 rounded text-xs font-semibold bg-[#06b6d4] text-[#09090b] hover:bg-[#06b6d4]/80 transition-colors cursor-pointer"
                  >
                    Resume
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelBatch}
                    className="px-4 py-2 rounded text-xs font-mono border border-white/[0.06] text-[#a1a1aa] hover:text-[#fafafa] transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              ) : batchStatus === "running" ? (
                <button
                  type="button"
                  onClick={handleCancelBatch}
                  className="px-4 py-2 rounded text-xs font-mono border border-white/[0.06] text-[#a1a1aa] hover:text-[#fafafa] transition-colors cursor-pointer"
                >
                  Pause
                </button>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
