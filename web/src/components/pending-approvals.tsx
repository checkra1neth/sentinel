"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchPendingAnalyze,
  fetchPendingInvest,
  approvePendingAnalyze,
  approvePendingInvest,
  rejectPending,
  truncAddr,
  REFETCH_FAST,
} from "../lib/api";

export function PendingApprovals(): React.ReactNode {
  const qc = useQueryClient();

  const { data: analyzeQueue = [] } = useQuery({
    queryKey: ["pendingAnalyze"],
    queryFn: fetchPendingAnalyze,
    refetchInterval: REFETCH_FAST,
  });

  const { data: investQueue = [] } = useQuery({
    queryKey: ["pendingInvest"],
    queryFn: fetchPendingInvest,
    refetchInterval: REFETCH_FAST,
  });

  const approveAnalyze = useMutation({
    mutationFn: (token: string) => approvePendingAnalyze(token),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pendingAnalyze"] });
    },
  });

  const approveInvest = useMutation({
    mutationFn: (token: string) => approvePendingInvest(token),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pendingInvest"] });
    },
  });

  const reject = useMutation({
    mutationFn: (token: string) => rejectPending(token),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pendingAnalyze"] });
      qc.invalidateQueries({ queryKey: ["pendingInvest"] });
    },
  });

  if (analyzeQueue.length === 0 && investQueue.length === 0) return null;

  return (
    <div className="mb-10">
      {analyzeQueue.length > 0 && (
        <div className="mb-6">
          <h2 className="text-[10px] font-medium text-[#52525b] uppercase tracking-wider mb-3">
            Analyze Queue
          </h2>
          <div className="space-y-1">
            {analyzeQueue.map((item, i) => {
              const token = String(item.token ?? item.address ?? "");
              return (
                <div
                  key={`analyze-${token}-${i}`}
                  className="border border-white/[0.06] rounded px-5 py-3 flex items-center justify-between font-mono text-xs"
                >
                  <span className="text-[#a1a1aa]">{truncAddr(token)}</span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => approveAnalyze.mutate(token)}
                      disabled={approveAnalyze.isPending}
                      className="border border-[#34d399]/40 text-[#34d399] rounded px-3 py-1 text-xs font-mono hover:bg-[#34d399]/10 transition-colors disabled:opacity-40"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => reject.mutate(token)}
                      disabled={reject.isPending}
                      className="border border-[#ef4444]/40 text-[#ef4444] rounded px-3 py-1 text-xs font-mono hover:bg-[#ef4444]/10 transition-colors disabled:opacity-40"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {investQueue.length > 0 && (
        <div className="mb-6">
          <h2 className="text-[10px] font-medium text-[#52525b] uppercase tracking-wider mb-3">
            Invest Queue
          </h2>
          <div className="space-y-1">
            {investQueue.map((item, i) => {
              const token = String(item.token ?? item.address ?? "");
              return (
                <div
                  key={`invest-${token}-${i}`}
                  className="border border-white/[0.06] rounded px-5 py-3 flex items-center justify-between font-mono text-xs"
                >
                  <span className="text-[#a1a1aa]">{truncAddr(token)}</span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => approveInvest.mutate(token)}
                      disabled={approveInvest.isPending}
                      className="border border-[#34d399]/40 text-[#34d399] rounded px-3 py-1 text-xs font-mono hover:bg-[#34d399]/10 transition-colors disabled:opacity-40"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => reject.mutate(token)}
                      disabled={reject.isPending}
                      className="border border-[#ef4444]/40 text-[#ef4444] rounded px-3 py-1 text-xs font-mono hover:bg-[#ef4444]/10 transition-colors disabled:opacity-40"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
