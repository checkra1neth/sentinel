"use client";

const STYLES: Record<string, string> = {
  LP: "text-[#06b6d4] bg-[#06b6d4]/10",
  Stake: "text-[#f59e0b] bg-[#f59e0b]/10",
  Lend: "text-[#a855f7] bg-[#a855f7]/10",
};

interface TypeBadgeProps {
  type: string;
}

export function TypeBadge({ type }: TypeBadgeProps): React.ReactNode {
  const label = type === "DEX_POOL" ? "LP" : type === "SINGLE_EARN" ? "Stake" : type === "LENDING" ? "Lend" : type;
  const style = STYLES[label] ?? "text-[#a1a1aa] bg-white/[0.04]";
  return (
    <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold ${style}`}>
      {label}
    </span>
  );
}
