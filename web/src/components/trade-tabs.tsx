"use client";

const TABS = ["Swap", "DeFi"] as const;
export type TradeTab = (typeof TABS)[number];

interface TradeTabsProps {
  active: TradeTab;
  onChange: (tab: TradeTab) => void;
}

export function TradeTabs({ active, onChange }: TradeTabsProps): React.ReactNode {
  return (
    <div className="flex gap-0 border-b border-white/[0.06] mt-1">
      {TABS.map((tab) => (
        <button
          key={tab}
          onClick={() => onChange(tab)}
          className={`px-4 py-2.5 text-xs font-medium transition-colors cursor-pointer border-b-2 ${
            active === tab
              ? "text-[#fafafa] border-[#06b6d4]"
              : "text-[#52525b] border-transparent hover:text-[#a1a1aa]"
          }`}
        >
          {tab}
        </button>
      ))}
    </div>
  );
}
