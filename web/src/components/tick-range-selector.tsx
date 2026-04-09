"use client";

import { useState, useEffect } from "react";
import { RangeBar } from "./range-bar";

interface TickRangeSelectorProps {
  currentPrice: number;
  tickSpacing: number;
  onChange: (lower: number, upper: number) => void;
}

type Preset = "narrow" | "medium" | "wide" | "full" | "custom";

const PRESETS: { key: Preset; label: string; range: number }[] = [
  { key: "narrow", label: "Narrow +-5%", range: 0.05 },
  { key: "medium", label: "Medium +-15%", range: 0.15 },
  { key: "wide", label: "Wide +-25%", range: 0.25 },
  { key: "full", label: "Full Range", range: 1 },
];

export function TickRangeSelector({ currentPrice, tickSpacing, onChange }: TickRangeSelectorProps): React.ReactNode {
  const [preset, setPreset] = useState<Preset>("medium");
  const [customLower, setCustomLower] = useState("");
  const [customUpper, setCustomUpper] = useState("");

  const lower = preset === "custom"
    ? Number(customLower) || currentPrice * 0.85
    : currentPrice * (1 - (PRESETS.find((p) => p.key === preset)?.range ?? 0.15));

  const upper = preset === "full"
    ? currentPrice * 2
    : preset === "custom"
      ? Number(customUpper) || currentPrice * 1.15
      : currentPrice * (1 + (PRESETS.find((p) => p.key === preset)?.range ?? 0.15));

  useEffect(() => {
    onChange(lower, upper);
  }, [lower, upper, onChange]);

  return (
    <div className="space-y-3">
      <div className="text-[11px] font-mono text-[#52525b]">Price Range</div>

      <div className="flex gap-2 flex-wrap">
        {PRESETS.map((p) => (
          <button
            key={p.key}
            onClick={() => setPreset(p.key)}
            className={`px-3 py-1 rounded text-[10px] font-medium transition-colors cursor-pointer ${
              preset === p.key
                ? "bg-[#06b6d4]/10 text-[#06b6d4] border border-[#06b6d4]/20"
                : "bg-white/[0.04] text-[#a1a1aa] border border-white/[0.06] hover:text-[#fafafa]"
            }`}
          >
            {p.label}
          </button>
        ))}
        <button
          onClick={() => {
            setPreset("custom");
            setCustomLower(String((currentPrice * 0.85).toFixed(6)));
            setCustomUpper(String((currentPrice * 1.15).toFixed(6)));
          }}
          className={`px-3 py-1 rounded text-[10px] font-medium transition-colors cursor-pointer ${
            preset === "custom"
              ? "bg-[#06b6d4]/10 text-[#06b6d4] border border-[#06b6d4]/20"
              : "bg-white/[0.04] text-[#a1a1aa] border border-white/[0.06] hover:text-[#fafafa]"
          }`}
        >
          Custom
        </button>
      </div>

      {preset === "custom" && (
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="block text-[10px] text-[#52525b] font-mono mb-1">Min Price</label>
            <input
              type="text"
              inputMode="decimal"
              value={customLower}
              onChange={(e) => setCustomLower(e.target.value)}
              className="w-full bg-white/[0.04] border border-white/[0.06] rounded px-3 py-1.5 text-xs font-mono text-[#fafafa] placeholder:text-[#52525b] outline-none focus:border-[#06b6d4]/40"
            />
          </div>
          <div className="flex-1">
            <label className="block text-[10px] text-[#52525b] font-mono mb-1">Max Price</label>
            <input
              type="text"
              inputMode="decimal"
              value={customUpper}
              onChange={(e) => setCustomUpper(e.target.value)}
              className="w-full bg-white/[0.04] border border-white/[0.06] rounded px-3 py-1.5 text-xs font-mono text-[#fafafa] placeholder:text-[#52525b] outline-none focus:border-[#06b6d4]/40"
            />
          </div>
        </div>
      )}

      <div>
        <RangeBar lower={lower} upper={upper} current={currentPrice} />
        <div className="flex justify-between mt-1 text-[9px] font-mono text-[#52525b]">
          <span>{lower.toFixed(4)}</span>
          <span className="text-[#fafafa]">Current: {currentPrice.toFixed(4)}</span>
          <span>{upper.toFixed(4)}</span>
        </div>
      </div>
    </div>
  );
}
