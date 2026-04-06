"use client";

export function ScanPulse(): React.ReactNode {
  return (
    <div className="flex items-center gap-2">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full rounded-full bg-[#22d3ee] opacity-75 animate-ping" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-[#22d3ee]" />
      </span>
      <span className="text-[11px] uppercase tracking-[0.15em] text-[#7a7f8a]">
        Scanning X Layer...
      </span>
    </div>
  );
}
