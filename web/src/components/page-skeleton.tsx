"use client";

export function PageSkeleton({ lines = 8 }: { lines?: number }): React.ReactNode {
  return (
    <div className="mx-auto max-w-[1400px] px-6 lg:px-10 py-8 space-y-4 animate-pulse">
      <div className="h-5 w-40 rounded bg-white/[0.04]" />
      <div className="h-3 w-64 rounded bg-white/[0.03]" />
      <div className="mt-6 space-y-3">
        {Array.from({ length: lines }).map((_, i) => (
          <div key={i} className="flex gap-4">
            <div className="h-3 rounded bg-white/[0.04]" style={{ width: `${30 + (i % 3) * 15}%` }} />
            <div className="h-3 rounded bg-white/[0.03]" style={{ width: `${15 + (i % 2) * 10}%` }} />
          </div>
        ))}
      </div>
    </div>
  );
}
