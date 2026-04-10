"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { DefiTabs, type DefiTab } from "../../components/defi-tabs";
import { DefiExplore } from "../../components/defi-explore";
import { DefiPositions } from "../../components/defi-positions";
import { YieldCalculator } from "../../components/yield-calculator";
import { PageSkeleton } from "../../components/page-skeleton";

const VALID_TABS: DefiTab[] = ["Explore", "My Positions", "Yield Calculator"];

function DefiContent(): React.ReactNode {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab") as DefiTab | null;
  const initialTab = tabParam && VALID_TABS.includes(tabParam) ? tabParam : "Explore";
  const [activeTab, setActiveTab] = useState<DefiTab>(initialTab);

  return (
    <div className="mx-auto max-w-[1400px] px-6 lg:px-10 py-8">
      <h1 className="text-lg font-semibold tracking-wide mb-4">DeFi</h1>

      <DefiTabs active={activeTab} onChange={setActiveTab} />

      <div className="mt-6">
        {activeTab === "Explore" && <DefiExplore />}
        {activeTab === "My Positions" && <DefiPositions />}
        {activeTab === "Yield Calculator" && <YieldCalculator />}
      </div>
    </div>
  );
}

export default function DefiPage(): React.ReactNode {
  return (
    <Suspense fallback={<PageSkeleton lines={10} />}>
      <DefiContent />
    </Suspense>
  );
}
