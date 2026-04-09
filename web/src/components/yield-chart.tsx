"use client";

import React from "react";

const COLORS = ["#34d399", "#06b6d4", "#a855f7", "#f59e0b", "#ef4444"];

interface YieldChartProps {
  lines: { name: string; apy: number }[];
  amount: number;
  days: number;
}

export function YieldChart({ lines, amount, days }: YieldChartProps): React.ReactNode {
  if (lines.length === 0 || amount <= 0) return null;

  const WIDTH = 600;
  const HEIGHT = 200;
  const PAD = { top: 20, right: 20, bottom: 30, left: 60 };
  const plotW = WIDTH - PAD.left - PAD.right;
  const plotH = HEIGHT - PAD.top - PAD.bottom;

  const maxVal = Math.max(
    ...lines.map((l) => amount * Math.pow(1 + l.apy / 100 / 365, days)),
  );
  const minVal = amount;
  const yRange = maxVal - minVal || 1;

  const paths = lines.slice(0, 5).map((line, idx) => {
    const points: string[] = [];
    const steps = Math.min(days, 60);
    for (let i = 0; i <= steps; i++) {
      const d = (i / steps) * days;
      const val = amount * Math.pow(1 + line.apy / 100 / 365, d);
      const x = PAD.left + (i / steps) * plotW;
      const y = PAD.top + plotH - ((val - minVal) / yRange) * plotH;
      points.push(`${x},${y}`);
    }
    return { name: line.name, color: COLORS[idx % COLORS.length], points: points.join(" ") };
  });

  const yLabels = [0, 0.25, 0.5, 0.75, 1].map((pct) => ({
    value: minVal + yRange * pct,
    y: PAD.top + plotH - pct * plotH,
  }));

  const xLabels = [0, 0.25, 0.5, 0.75, 1].map((pct) => ({
    day: Math.round(days * pct),
    x: PAD.left + pct * plotW,
  }));

  return (
    <div>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full h-auto">
        {yLabels.map((yl, i) => (
          <line key={`grid-${i}`} x1={PAD.left} y1={yl.y} x2={WIDTH - PAD.right} y2={yl.y} stroke="rgba(255,255,255,0.04)" />
        ))}
        {yLabels.map((yl, i) => (
          <text key={`y-${i}`} x={PAD.left - 8} y={yl.y + 3} textAnchor="end" fill="#52525b" fontSize="9" fontFamily="monospace">
            ${yl.value >= 1000 ? `${(yl.value / 1000).toFixed(1)}K` : yl.value.toFixed(0)}
          </text>
        ))}
        {xLabels.map((xl, i) => (
          <text key={`x-${i}`} x={xl.x} y={HEIGHT - 8} textAnchor="middle" fill="#52525b" fontSize="9" fontFamily="monospace">
            {xl.day}d
          </text>
        ))}
        {paths.map((path, idx) => (
          <g key={idx}>
            <defs>
              <linearGradient id={`grad-${idx}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={path.color} stopOpacity="0.15" />
                <stop offset="100%" stopColor={path.color} stopOpacity="0" />
              </linearGradient>
            </defs>
            <polygon
              points={`${path.points} ${PAD.left + plotW},${PAD.top + plotH} ${PAD.left},${PAD.top + plotH}`}
              fill={`url(#grad-${idx})`}
            />
            <polyline points={path.points} fill="none" stroke={path.color} strokeWidth="1.5" />
          </g>
        ))}
      </svg>
      <div className="flex gap-4 mt-2 flex-wrap">
        {paths.map((path, idx) => (
          <div key={idx} className="flex items-center gap-1.5 text-[10px] font-mono">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: path.color }} />
            <span className="text-[#a1a1aa]">{path.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
