"use client";

import { type Verdict } from "../lib/api";

function SecurityRow({ label, value, danger }: { label: string; value: string; danger?: boolean }): React.ReactNode {
  const color = danger ? "text-[#ef4444]" : value === "No" || value === "0%" ? "text-[#34d399]" : "text-[#a1a1aa]";
  return (
    <div className="flex justify-between py-1.5 text-xs border-b border-white/[0.03]">
      <span className="text-[#52525b]">{label}</span>
      <span className={`font-mono ${color}`}>{value}</span>
    </div>
  );
}

export function TabSecurity({ verdict }: { verdict: Verdict | null }): React.ReactNode {
  if (!verdict) {
    return <div className="py-5 text-xs text-[#52525b] font-mono">No security data. Run a scan first.</div>;
  }

  return (
    <div className="py-5 max-w-lg">
      <div className="text-[10px] font-medium text-[#52525b] uppercase tracking-wider mb-2">Token Security Scan</div>
      <SecurityRow label="Honeypot" value={verdict.isHoneypot ? "Yes" : "No"} danger={verdict.isHoneypot} />
      <SecurityRow label="Mintable" value={verdict.hasMint ? "Yes" : "No"} danger={verdict.hasMint} />
      <SecurityRow label="Proxy Contract" value={verdict.isProxy ? "Yes" : "No"} danger={verdict.isProxy} />
      <SecurityRow label="Rug Pull History" value={verdict.hasRug ? "Yes" : "No"} danger={verdict.hasRug} />
      <SecurityRow label="Buy Tax" value={`${verdict.buyTax}%`} danger={verdict.buyTax > 5} />
      <SecurityRow label="Sell Tax" value={`${verdict.sellTax}%`} danger={verdict.sellTax > 5} />
      <SecurityRow label="Holder Concentration" value={`${verdict.holderConcentration}%`} danger={verdict.holderConcentration > 50} />
      {verdict.risks.length > 0 && (
        <div className="mt-4">
          <div className="text-[10px] font-medium text-[#52525b] uppercase tracking-wider mb-2">Risks Detected</div>
          <div className="space-y-1">
            {verdict.risks.map((r, i) => (
              <div key={i} className="text-[11px] font-mono text-[#ef4444]">&bull; {r}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
