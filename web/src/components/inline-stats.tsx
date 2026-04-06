"use client";

import { useEffect, useRef, useCallback } from "react";
import gsap from "gsap";

interface StatItem {
  label: string;
  value: number;
  prefix?: string;
  color?: string;
}

interface InlineStatsProps {
  totalScanned: number;
  totalDangerous: number;
  totalSafe: number;
  lpInvested: string;
}

function parseNumeric(val: string | number): number {
  if (typeof val === "number") return val;
  const cleaned = String(val).replace(/[^0-9.]/g, "");
  return parseFloat(cleaned) || 0;
}

export function InlineStats({
  totalScanned,
  totalDangerous,
  totalSafe,
  lpInvested,
}: InlineStatsProps): React.ReactNode {
  const numberRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const hasAnimated = useRef(false);

  const setRef = useCallback(
    (index: number) => (el: HTMLSpanElement | null) => {
      numberRefs.current[index] = el;
    },
    [],
  );

  const stats: StatItem[] = [
    { label: "Scanned", value: totalScanned },
    { label: "Threats", value: totalDangerous, color: "#ef4444" },
    { label: "Safe", value: totalSafe, color: "#34d399" },
    { label: "LP Invested", value: parseNumeric(lpInvested), prefix: "$" },
  ];

  useEffect(() => {
    if (hasAnimated.current) return;
    if (totalScanned === 0 && totalDangerous === 0 && totalSafe === 0) return;

    hasAnimated.current = true;

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    numberRefs.current.forEach((el, i) => {
      if (!el) return;
      const target = stats[i].value;

      if (prefersReducedMotion) {
        el.textContent = String(target);
        return;
      }

      gsap.fromTo(
        el,
        { textContent: 0 },
        {
          textContent: target,
          duration: 0.8,
          delay: 0.3 + i * 0.1,
          ease: "power2.out",
          snap: { textContent: 1 },
          onUpdate() {
            const current = parseFloat(el.textContent ?? "0");
            el.textContent = String(Math.round(current));
          },
        },
      );
    });
  }, [totalScanned, totalDangerous, totalSafe, stats]);

  return (
    <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
      {stats.map((stat, i) => (
        <div key={stat.label} className="flex items-center gap-2">
          <span className="text-[11px] uppercase tracking-[0.15em] text-[#a1a1aa]">
            {stat.label}
          </span>
          <span
            className="flex items-baseline gap-0.5"
            style={stat.color ? { color: stat.color } : undefined}
          >
            {stat.prefix && (
              <span className="text-sm text-[#a1a1aa]">{stat.prefix}</span>
            )}
            <span
              ref={setRef(i)}
              className="text-lg font-semibold tabular-nums"
              style={stat.color ? { color: stat.color } : { color: "#fafafa" }}
            >
              0
            </span>
          </span>
          {i < stats.length - 1 && (
            <span className="text-[#27272a] ml-4 select-none hidden sm:inline">
              /
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
