"use client";

import { type DappScanResult } from "../lib/api";

function KVRow({ label, value }: { label: string; value: React.ReactNode }): React.ReactNode {
  return (
    <div className="flex justify-between py-1 text-xs border-b border-white/[0.03]">
      <span className="text-[#52525b]">{label}</span>
      <span className="font-mono text-[#a1a1aa]">{value}</span>
    </div>
  );
}

function FlagValue({ danger }: { danger: boolean }): React.ReactNode {
  return (
    <span className={danger ? "text-[#ef4444]" : "text-[#34d399]"}>
      {danger ? "Yes" : "No"}
    </span>
  );
}

interface DappScanResultCardProps {
  data: DappScanResult;
  domain: string;
}

export function DappScanResultCard({ data, domain }: DappScanResultCardProps): React.ReactNode {
  // Backend returns {success, data: {isMalicious}} — map to our interface
  const rawData = (data as unknown as Record<string, unknown>)?.data as Record<string, unknown> | undefined;
  const isMalicious = Boolean(rawData?.isMalicious ?? data.isPhishing ?? data.isMalware);
  const hasDanger = isMalicious || data.isPhishing || data.isMalware || data.isSuspicious;
  const statusColor = hasDanger ? "#ef4444" : "#34d399";
  const statusLabel = hasDanger ? "DANGEROUS" : "SAFE";

  return (
    <div className="border border-white/[0.06] rounded-lg p-5">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <span className="text-sm font-semibold text-[#fafafa] font-mono">{domain}</span>
        <span
          className="px-2 py-px rounded text-[11px] font-mono font-medium"
          style={{
            color: statusColor,
            background: hasDanger ? "rgba(239,68,68,0.08)" : "rgba(52,211,153,0.08)",
          }}
        >
          {statusLabel}
        </span>
      </div>

      {/* Security flags */}
      <div className="text-[10px] font-medium text-[#52525b] uppercase tracking-wider mb-2">
        Security Flags
      </div>
      <div className="max-w-md">
        <KVRow label="Malicious" value={<FlagValue danger={isMalicious} />} />
        <KVRow label="Phishing" value={<FlagValue danger={Boolean(data.isPhishing)} />} />
        <KVRow label="Suspicious" value={<FlagValue danger={Boolean(data.isSuspicious)} />} />
      </div>
    </div>
  );
}
