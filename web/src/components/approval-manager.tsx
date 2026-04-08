"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchApprovals, truncAddr } from "../lib/api";

interface Approval {
  tokenSymbol: string;
  tokenContractAddress: string;
  spender: string;
  amount: string;
  isUnlimited: boolean;
}

interface ApprovalManagerProps {
  address: string;
}

export function ApprovalManager({ address }: ApprovalManagerProps): React.ReactNode {
  const { data } = useQuery({
    queryKey: ["approvals", address],
    queryFn: () => fetchApprovals(address),
    enabled: !!address,
    refetchInterval: 30_000,
  });

  const approvals: Approval[] = Array.isArray(data?.approvals)
    ? (data.approvals as Record<string, unknown>[]).map((a) => ({
        tokenSymbol: String(a.tokenSymbol ?? a.symbol ?? "???"),
        tokenContractAddress: String(a.tokenContractAddress ?? a.token ?? ""),
        spender: String(a.spender ?? a.approvedSpender ?? ""),
        amount: String(a.amount ?? a.allowance ?? "0"),
        isUnlimited:
          String(a.amount ?? a.allowance ?? "").toLowerCase().includes("unlimited") ||
          Number(a.amount ?? a.allowance ?? 0) > 1e30,
      }))
    : [];

  if (!address) return null;

  return (
    <div className="py-4">
      <div className="text-[10px] font-medium text-[#52525b] uppercase tracking-wider mb-3">Token Approvals</div>
      {approvals.length === 0 ? (
        <p className="text-xs text-[#52525b] font-mono">No active approvals.</p>
      ) : (
        <table className="w-full text-xs font-mono">
          <thead>
            <tr className="text-left border-b border-white/[0.06]">
              <th className="pb-2 font-medium text-[10px] text-[#52525b] uppercase tracking-wider">Token</th>
              <th className="pb-2 font-medium text-[10px] text-[#52525b] uppercase tracking-wider">Spender</th>
              <th className="pb-2 font-medium text-[10px] text-[#52525b] uppercase tracking-wider text-right">Amount</th>
              <th className="pb-2 font-medium text-[10px] text-[#52525b] uppercase tracking-wider text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {approvals.map((a, i) => (
              <tr key={`${a.spender}-${i}`} className="border-b border-white/[0.03]">
                <td className="py-2 text-[#fafafa]">{a.tokenSymbol}</td>
                <td className="py-2 text-[#a1a1aa]">{truncAddr(a.spender)}</td>
                <td className="py-2 text-right">
                  {a.isUnlimited ? (
                    <span style={{ color: "#f59e0b" }}>Unlimited</span>
                  ) : (
                    <span className="text-[#a1a1aa]">{a.amount}</span>
                  )}
                </td>
                <td className="py-2 text-right">
                  <a
                    href={`https://www.oklink.com/xlayer/address/${a.spender}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#52525b] hover:text-[#a1a1aa] transition-colors"
                  >
                    Revoke &rarr;
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
