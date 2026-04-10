"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { SwapPanel } from "../../components/swap-panel";
import { PageSkeleton } from "../../components/page-skeleton";

function TradeContent(): React.ReactNode {
  const searchParams = useSearchParams();
  const initialToken = searchParams.get("token") ?? undefined;
  const initialChain = searchParams.get("chain") ? Number(searchParams.get("chain")) : undefined;

  return (
    <div className="mx-auto max-w-[1400px] px-6 lg:px-10 py-8">
      <h1 className="text-lg font-semibold tracking-wide mb-6">Trade</h1>
      <SwapPanel initialToToken={initialToken} initialChain={initialChain} />
    </div>
  );
}

export default function TradePage(): React.ReactNode {
  return (
    <Suspense fallback={<PageSkeleton lines={6} />}>
      <TradeContent />
    </Suspense>
  );
}
