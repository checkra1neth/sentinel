"use client";

interface EconomyStatsProps {
  totalEvents: number;
  byType: Record<string, number>;
}

function StatCard({
  label,
  value,
}: {
  label: string;
  value: number;
}): React.ReactNode {
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-6">
      <p className="text-sm text-gray-400">{label}</p>
      <p className="mt-2 text-2xl font-bold text-white">{value}</p>
    </div>
  );
}

export function EconomyStats({
  totalEvents,
  byType,
}: EconomyStatsProps): React.ReactNode {
  const payments = (byType.buy_service ?? 0) + (byType.sell_service ?? 0);
  const reinvestCycles = byType.reinvest ?? 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
      <StatCard label="Total Events" value={totalEvents} />
      <StatCard label="x402 Payments" value={payments} />
      <StatCard label="Reinvest Cycles" value={reinvestCycles} />
    </div>
  );
}
