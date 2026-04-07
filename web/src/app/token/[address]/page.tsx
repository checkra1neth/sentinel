"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { TokenHero } from "../../../components/token-hero";
import { TokenTabs, type TokenTab } from "../../../components/token-tabs";
import { TabOverview } from "../../../components/tab-overview";
import { TabHolders } from "../../../components/tab-holders";
import { TabTraders } from "../../../components/tab-traders";
import { TabSecurity } from "../../../components/tab-security";
import { TabDevIntel } from "../../../components/tab-dev-intel";
import { fetchTokenPairs, fetchAnalysis, fetchTokenHolders } from "../../../lib/api";

export default function TokenProfilePage(): React.ReactNode {
  const params = useParams();
  const address = String(params.address ?? "");
  const [activeTab, setActiveTab] = useState<TokenTab>("Overview");

  const { data: pairs } = useQuery({
    queryKey: ["dex-pairs", address],
    queryFn: () => fetchTokenPairs(address),
    enabled: !!address,
  });

  const { data: verdict } = useQuery({
    queryKey: ["analysis", address],
    queryFn: () => fetchAnalysis(address),
    enabled: !!address,
  });

  const { data: holdersData } = useQuery({
    queryKey: ["holders-hero", address],
    queryFn: () => fetchTokenHolders(address),
    enabled: !!address,
  });

  const pair = pairs?.[0];
  const holdersArr = Array.isArray(holdersData?.data) ? (holdersData.data as Record<string, unknown>[]) : [];
  const smartMoneyCount = holdersArr.filter((h) => String(h.tag) === "3").length;

  return (
    <div className="mx-auto max-w-[1400px] px-6 lg:px-10">
      <div className="py-3 text-[11px] text-[#52525b] font-mono">
        <Link href="/discover" className="text-[#a1a1aa] hover:text-[#fafafa] transition-colors">Discover</Link>
        <span className="mx-1.5">/</span>
        {verdict?.tokenSymbol ?? pair?.baseToken?.symbol ?? address.slice(0, 8)}
      </div>

      <TokenHero
        address={address}
        name={verdict?.tokenName ?? pair?.baseToken?.name ?? ""}
        symbol={verdict?.tokenSymbol ?? pair?.baseToken?.symbol ?? ""}
        verdict={verdict?.verdict}
        riskScore={verdict?.riskScore}
        priceUsd={verdict?.priceUsd ?? (pair?.priceUsd ? Number(pair.priceUsd) : undefined)}
        priceChange24h={verdict?.priceChange24H ?? pair?.priceChange?.h24}
        marketCap={verdict?.marketCap ?? pair?.marketCap}
        liquidityUsd={verdict?.liquidityUsd ?? pair?.liquidity?.usd}
        volume24h={verdict?.volume24H ?? pair?.volume?.h24}
        holdersCount={holdersArr.length || verdict?.holders}
        smartMoneyCount={smartMoneyCount || undefined}
      />

      <TokenTabs active={activeTab} onChange={setActiveTab} />

      {activeTab === "Overview" && <TabOverview address={address} verdict={verdict ?? null} />}
      {activeTab === "Holders" && <TabHolders address={address} />}
      {activeTab === "Traders" && <TabTraders address={address} />}
      {activeTab === "Security" && <TabSecurity verdict={verdict ?? null} />}
      {activeTab === "Dev Intel" && <TabDevIntel address={address} />}
    </div>
  );
}
