"use client";

interface RangeBarProps {
  lower: number;
  upper: number;
  current: number;
  min?: number;
  max?: number;
}

export function RangeBar({ lower, upper, current, min, max }: RangeBarProps): React.ReactNode {
  const lo = min ?? lower * 0.8;
  const hi = max ?? upper * 1.2;
  const range = hi - lo || 1;
  const leftPct = ((lower - lo) / range) * 100;
  const widthPct = ((upper - lower) / range) * 100;
  const currentPct = ((current - lo) / range) * 100;
  const inRange = current >= lower && current <= upper;

  return (
    <div className="relative h-2 bg-white/[0.06] rounded-full">
      <div
        className={`absolute h-full rounded-full ${inRange ? "bg-[#34d399]/40" : "bg-[#ef4444]/30"}`}
        style={{ left: `${Math.max(0, leftPct)}%`, width: `${Math.min(100, widthPct)}%` }}
      />
      <div
        className="absolute top-[-2px] w-1 h-3 bg-[#fafafa] rounded-sm"
        style={{ left: `${Math.min(100, Math.max(0, currentPct))}%` }}
      />
    </div>
  );
}
