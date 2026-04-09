"use client";

interface SkeletonRowsProps {
  rows?: number;
  columns?: number;
}

export function SkeletonRows({ rows = 6, columns = 5 }: SkeletonRowsProps): React.ReactNode {
  return (
    <div className="space-y-0">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 py-2.5 border-b border-white/[0.04]"
        >
          {Array.from({ length: columns }).map((_, j) => (
            <div
              key={j}
              className="h-3 rounded bg-white/[0.04] animate-pulse"
              style={{ width: j === 0 ? "30%" : "15%" }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
