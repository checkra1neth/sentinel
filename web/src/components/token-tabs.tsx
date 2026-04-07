"use client";

const TABS = ["Overview", "Holders", "Traders", "Security", "Dev Intel"] as const;
export type TokenTab = (typeof TABS)[number];

interface TokenTabsProps {
  active: TokenTab;
  onChange: (tab: TokenTab) => void;
}

export function TokenTabs({ active, onChange }: TokenTabsProps): React.ReactNode {
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
