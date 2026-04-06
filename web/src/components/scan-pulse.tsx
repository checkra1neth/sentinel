"use client";

export function ScanPulse(): React.ReactNode {
  return (
    <div className="flex items-center gap-2">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full rounded-full bg-[#06b6d4] opacity-75 animate-ping" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-[#06b6d4]" />
      </span>
      <span className="text-[11px] uppercase tracking-[0.15em] text-[#a1a1aa]">
        Scanning X Layer...
      </span>
    </div>
  );
}
