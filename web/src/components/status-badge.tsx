"use client";

const STYLES: Record<string, string> = {
  "In Range": "text-[#34d399] bg-[#34d399]/10",
  "Out of Range": "text-[#ef4444] bg-[#ef4444]/10",
  Active: "text-[#34d399] bg-[#34d399]/10",
  Closed: "text-[#52525b] bg-white/[0.04]",
};

interface StatusBadgeProps {
  status: string;
}

export function StatusBadge({ status }: StatusBadgeProps): React.ReactNode {
  const style = STYLES[status] ?? "text-[#a1a1aa] bg-white/[0.04]";
  return (
    <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${style}`}>
      {status}
    </span>
  );
}
