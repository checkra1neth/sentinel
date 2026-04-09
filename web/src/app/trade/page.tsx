"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { SwapPanel } from "../../components/swap-panel";

function TradeContent(): React.ReactNode {
  const searchParams = useSearchParams();
  const initialToken = searchParams.get("token") ?? undefined;

  return (
    <div className="mx-auto max-w-[1400px] px-6 lg:px-10 py-8">
      <h1 className="text-lg font-semibold tracking-wide mb-6">Trade</h1>
      <SwapPanel initialToToken={initialToken} />
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
