"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { PortfolioOverview } from "../../components/portfolio-overview";
import { TokenBalances } from "../../components/token-balances";
import { DefiPositions } from "../../components/defi-positions";
import { ApprovalManager } from "../../components/approval-manager";
import { DexHistory } from "../../components/dex-history";
import { PageSkeleton } from "../../components/page-skeleton";

const TABS = ["Balances", "DeFi", "Approvals", "History"] as const;
type PortfolioTab = (typeof TABS)[number];

function PortfolioContent(): React.ReactNode {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab") as PortfolioTab | null;
  const initialTab = tabParam && (TABS as readonly string[]).includes(tabParam) ? tabParam : "Balances";
  const [activeTab, setActiveTab] = useState<PortfolioTab>(initialTab);

  return (
    <div className="mx-auto max-w-[1400px] px-6 lg:px-10 py-8">
      <h1 className="text-lg font-semibold tracking-wide mb-4">Portfolio</h1>

      {/* Overview stats — always visible */}
      <PortfolioOverview />

      {/* Tabs */}
      <div className="flex gap-0 border-b border-white/[0.06] mt-4">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-xs font-medium transition-colors cursor-pointer border-b-2 ${
              activeTab === tab
                ? "text-[#fafafa] border-[#06b6d4]"
                : "text-[#52525b] border-transparent hover:text-[#a1a1aa]"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="mt-6">
        {activeTab === "Balances" && <TokenBalances />}
        {activeTab === "DeFi" && <DefiPositions />}
        {activeTab === "Approvals" && <ApprovalManager />}
        {activeTab === "History" && <DexHistory />}
      </div>
    </div>
  );
}

export default function PortfolioPage(): React.ReactNode {
  return (
    <Suspense fallback={<PageSkeleton lines={10} />}>
      <PortfolioContent />
    </Suspense>
  );
}
