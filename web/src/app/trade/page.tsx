"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { TradeTabs, type TradeTab } from "../../components/trade-tabs";
import { SwapPanel } from "../../components/swap-panel";
import { DefiProducts } from "../../components/defi-products";
import { DefiDepositModal } from "../../components/defi-deposit-modal";

function TradeContent(): React.ReactNode {
  const searchParams = useSearchParams();
  const initialToken = searchParams.get("token") ?? undefined;
  const [activeTab, setActiveTab] = useState<TradeTab>("Swap");
  const [deposit, setDeposit] = useState<{ id: string; name: string } | null>(null);

  return (
    <div className="mx-auto max-w-[1400px] px-6 lg:px-10 py-8">
      <h1 className="text-lg font-semibold tracking-wide mb-4">Trade</h1>

      <TradeTabs active={activeTab} onChange={setActiveTab} />

      <div className="mt-6">
        {activeTab === "Swap" && <SwapPanel initialToToken={initialToken} />}
        {activeTab === "DeFi" && (
          <DefiProducts onDeposit={(id, name) => setDeposit({ id, name })} />
        )}
      </div>

      {deposit && (
        <DefiDepositModal
          investmentId={deposit.id}
          poolName={deposit.name}
          onClose={() => setDeposit(null)}
        />
      )}
    </div>
  );
}

export default function TradePage(): React.ReactNode {
  return (
    <Suspense>
      <TradeContent />
    </Suspense>
  );
}
