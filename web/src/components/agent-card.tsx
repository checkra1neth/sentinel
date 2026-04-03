"use client";

interface AgentCardProps {
  name: string;
  role: string;
  wallet: string;
  balance: string;
  servicesCount: number;
  status: "active" | "idle" | "error";
}

const ROLE_BORDERS: Record<string, string> = {
  analyst: "border-blue-500/40",
  auditor: "border-purple-500/40",
  trader: "border-emerald-500/40",
  reinvest: "border-yellow-500/40",
};

const STATUS_STYLES: Record<string, { dot: string; label: string }> = {
  active: { dot: "bg-emerald-400", label: "Active" },
  idle: { dot: "bg-gray-500", label: "Idle" },
  error: { dot: "bg-red-400", label: "Error" },
};

export function AgentCard({
  name,
  role,
  wallet,
  balance,
  servicesCount,
  status,
}: AgentCardProps): React.ReactNode {
  const borderColor = ROLE_BORDERS[role.toLowerCase()] ?? "border-gray-700";
  const statusStyle = STATUS_STYLES[status] ?? STATUS_STYLES.idle;

  return (
    <div
      className={`rounded-xl border ${borderColor} bg-gray-900/50 p-5 flex flex-col gap-3`}
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">{name}</h3>
        <div className="flex items-center gap-1.5">
          <span className={`h-2 w-2 rounded-full ${statusStyle.dot}`} />
          <span className="text-xs text-gray-500">{statusStyle.label}</span>
        </div>
      </div>

      <p className="text-xs text-gray-500 font-mono">
        {wallet.slice(0, 6)}...{wallet.slice(-4)}
      </p>

      <div className="flex items-center justify-between pt-2 border-t border-gray-800">
        <div>
          <p className="text-xs text-gray-500">Balance</p>
          <p className="text-sm font-semibold text-white">{balance} USDT</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-500">Services</p>
          <p className="text-sm font-semibold text-white">{servicesCount}</p>
        </div>
      </div>
    </div>
  );
}
