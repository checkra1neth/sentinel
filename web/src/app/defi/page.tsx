"use client";

import { useState } from "react";
import { DefiTabs, type DefiTab } from "../../components/defi-tabs";
import { DefiExplore } from "../../components/defi-explore";
import { DefiPositions } from "../../components/defi-positions";
import { YieldCalculator } from "../../components/yield-calculator";

export default function DefiPage(): React.ReactNode {
  const [activeTab, setActiveTab] = useState<DefiTab>("Explore");

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
