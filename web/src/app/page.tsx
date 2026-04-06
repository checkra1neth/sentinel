"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Eye, Search, Radio } from "lucide-react";
import gsap from "gsap";
import { VerdictRow } from "../components/verdict-row";
import { InlineStats } from "../components/inline-stats";
import { LiveFeed } from "../components/live-feed";
import { ScanPulse } from "../components/scan-pulse";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3002";
const POLL_INTERVAL = 10_000;

interface Verdict {
  token: string;
  tokenName: string;
  tokenSymbol: string;
  riskScore: number;
  verdict: "SAFE" | "CAUTION" | "DANGEROUS";
  isHoneypot: boolean;
  hasRug: boolean;
  hasMint: boolean;
  isProxy: boolean;
  buyTax: number;
  sellTax: number;
  holderConcentration: number;
  risks: string[];
  priceUsd: number;
  marketCap: number;
  liquidityUsd: number;
  timestamp: number;
  txHash?: string;
  lpInvested?: string;
}

interface Stats {
  totalScanned: number;
  totalSafe: number;
  totalCaution: number;
  totalDangerous: number;
  totalLpInvested: string;
  lpPnl: string;
  events: Record<string, unknown>;
}

export default function Home(): React.ReactNode {
  const [verdicts, setVerdicts] = useState<Verdict[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);

  const headerRef = useRef<HTMLDivElement>(null);
  const statsRef = useRef<HTMLDivElement>(null);
  const feedTitleRef = useRef<HTMLDivElement>(null);
  const feedRef = useRef<HTMLDivElement>(null);
  const activityRef = useRef<HTMLDivElement>(null);
  const verdictRowRefs = useRef<(HTMLDivElement | null)[]>([]);
  const hasAnimated = useRef(false);

  const fetchData = useCallback(async (): Promise<void> => {
    try {
      const [verdictsRes, statsRes] = await Promise.all([
        fetch(`${API_URL}/api/verdicts?limit=30`),
        fetch(`${API_URL}/api/stats`),
      ]);

      if (verdictsRes.ok) {
        const data = (await verdictsRes.json()) as { verdicts: Verdict[] };
        setVerdicts(data.verdicts ?? []);
      }

      if (statsRes.ok) {
        const data = (await statsRes.json()) as Stats;
        setStats(data);
      }
    } catch {
      // server unavailable, keep stale data
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => {
      fetchData();
    }, POLL_INTERVAL);
    return (): void => clearInterval(interval);
  }, [fetchData]);

  // GSAP entrance animations
  useEffect(() => {
    if (hasAnimated.current) return;
    hasAnimated.current = true;

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (prefersReducedMotion) return;

    // Header fade in
    if (headerRef.current) {
      gsap.fromTo(
        headerRef.current,
        { opacity: 0, y: -10 },
        { opacity: 1, y: 0, duration: 0.3, ease: "power2.out" },
      );
    }

    // Stats row fade in
    if (statsRef.current) {
      gsap.fromTo(
        statsRef.current,
        { opacity: 0, y: 8 },
        { opacity: 1, y: 0, duration: 0.4, delay: 0.15, ease: "power2.out" },
      );
    }

    // Feed title
    if (feedTitleRef.current) {
      gsap.fromTo(
        feedTitleRef.current,
        { opacity: 0 },
        { opacity: 1, duration: 0.3, delay: 0.3, ease: "power2.out" },
      );
    }

    // Activity section
    if (activityRef.current) {
      gsap.fromTo(
        activityRef.current,
        { opacity: 0, y: 12 },
        { opacity: 1, y: 0, duration: 0.4, delay: 0.5, ease: "power2.out" },
      );
    }
  }, []);

  // Stagger verdict rows when they appear
  useEffect(() => {
    if (verdicts.length === 0) return;

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (prefersReducedMotion) return;

    const validRefs = verdictRowRefs.current.filter(Boolean);
    if (validRefs.length === 0) return;

    gsap.fromTo(
      validRefs,
      { opacity: 0, y: 16 },
      {
        opacity: 1,
        y: 0,
        duration: 0.35,
        stagger: 0.05,
        ease: "power2.out",
        delay: 0.35,
      },
    );
  }, [verdicts.length > 0]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="mx-auto max-w-[1400px] px-6 lg:px-10 py-8">
      {/* Header - left aligned, compact */}
      <div ref={headerRef} className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-sm font-semibold uppercase tracking-[0.25em] text-[#e8eaed] mb-1">
            SENTINEL
          </h1>
          <p className="text-xs text-[#7a7f8a]">
            Autonomous Security Oracle
          </p>
        </div>
        <ScanPulse />
      </div>

      {/* Inline stats row */}
      <div ref={statsRef} className="mb-10">
        <InlineStats
          totalScanned={stats?.totalScanned ?? 0}
          totalDangerous={stats?.totalDangerous ?? 0}
          totalSafe={stats?.totalSafe ?? 0}
          lpInvested={stats?.totalLpInvested ?? "$0"}
        />
      </div>

      {/* Threat feed */}
      <div className="mb-10">
        <div ref={feedTitleRef} className="flex items-center gap-2 mb-4">
          <Eye className="h-3.5 w-3.5 text-[#7a7f8a]" />
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[#7a7f8a]">
            Threat Feed
          </h2>
          <span className="text-[11px] text-[#7a7f8a]/40 tabular-nums">
            {verdicts.length}
          </span>
        </div>

        {verdicts.length === 0 ? (
          <div className="py-16 text-center border border-[#1a1d24]/30 rounded-md">
            <Search className="h-5 w-5 text-[#1a1d24] mx-auto mb-3" />
            <p className="text-xs text-[#7a7f8a]/40">
              Sentinel is scanning... Verdicts will appear here.
            </p>
          </div>
        ) : (
          <div
            ref={feedRef}
            className="rounded-md border border-[#1a1d24]/50 overflow-hidden"
          >
            {verdicts.map((v, i) => (
              <VerdictRow
                key={`${v.token}-${v.timestamp}`}
                ref={(el) => {
                  verdictRowRefs.current[i] = el;
                }}
                verdict={v}
              />
            ))}
          </div>
        )}
      </div>

      {/* Agent activity */}
      <div ref={activityRef}>
        <div className="flex items-center gap-2 mb-4">
          <Radio className="h-3.5 w-3.5 text-[#7a7f8a]" />
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[#7a7f8a]">
            Agent Activity
          </h2>
        </div>
        <LiveFeed />
      </div>
    </div>
  );
}
