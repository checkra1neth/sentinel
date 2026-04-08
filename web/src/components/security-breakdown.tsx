"use client";

import { type Verdict } from "../lib/api";

function KVRow({ label, value }: { label: string; value: React.ReactNode }): React.ReactNode {
  return (
    <div className="flex justify-between py-1 text-xs border-b border-white/[0.03]">
      <span className="text-[#52525b]">{label}</span>
      <span className="font-mono text-[#a1a1aa]">{value}</span>
    </div>
  );
}

function BoolValue({ flag, dangerLabel, safeLabel }: { flag: boolean; dangerLabel?: string; safeLabel?: string }): React.ReactNode {
  return (
    <span className={flag ? "text-[#ef4444]" : "text-[#34d399]"}>
      {flag ? (dangerLabel ?? "Yes") : (safeLabel ?? "No")}
    </span>
  );
}

interface SecurityBreakdownProps {
  verdict: Verdict;
}

export function SecurityBreakdown({ verdict }: SecurityBreakdownProps): React.ReactNode {
  return (
    <div className="border border-white/[0.06] rounded-lg p-5">
      <div className="text-[10px] font-medium text-[#52525b] uppercase tracking-wider mb-3">
        Security Breakdown
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left: KV rows */}
        <div>
          <KVRow label="Honeypot" value={<BoolValue flag={verdict.isHoneypot} />} />
          <KVRow label="Mintable" value={<BoolValue flag={verdict.hasMint} />} />
          <KVRow label="Proxy" value={<BoolValue flag={verdict.isProxy} />} />
          <KVRow
            label="Buy Tax"
            value={
              <span className={verdict.buyTax > 5 ? "text-[#ef4444]" : "text-[#34d399]"}>
                {verdict.buyTax}%
              </span>
            }
          />
          <KVRow
            label="Sell Tax"
            value={
              <span className={verdict.sellTax > 5 ? "text-[#ef4444]" : "text-[#34d399]"}>
                {verdict.sellTax}%
              </span>
            }
          />
          <KVRow
            label="Holder Concentration"
            value={
              <span className={verdict.holderConcentration > 50 ? "text-[#ef4444]" : "text-[#34d399]"}>
                {verdict.holderConcentration}%
              </span>
            }
          />
        </div>

        {/* Right: risks list */}
        <div>
          <div className="text-[10px] font-medium text-[#52525b] uppercase tracking-wider mb-2">
            Detected Risks
          </div>
          {verdict.risks.length > 0 ? (
            <ul className="space-y-1.5">
              {verdict.risks.map((risk, i) => (
                <li key={i} className="flex items-start gap-2 text-xs font-mono">
                  <span className="text-[#ef4444] mt-px shrink-0">&#x25CF;</span>
                  <span className="text-[#a1a1aa]">{risk}</span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-xs font-mono text-[#34d399]">No risks detected</div>
          )}
        </div>
      </div>
    </div>
  );
}
