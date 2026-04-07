"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Eye, Shield, Radio } from "lucide-react";
import gsap from "gsap";
import { VerdictRow } from "../../components/verdict-row";
import { InlineStats } from "../../components/inline-stats";
import { LiveFeed } from "../../components/live-feed";
import { ScanInput } from "../../components/scan-input";
import { AgentPanel } from "../../components/agent-panel";

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

  const statsRef = useRef<HTMLDivElement>(null);
  const scanInputRef = useRef<HTMLDivElement>(null);
  const agentPanelRef = useRef<HTMLDivElement>(null);
  const feedTitleRef = useRef<HTMLDivElement>(null);
  const feedRef = useRef<HTMLDivElement>(null);
  const activityRef = useRef<HTMLDivElement>(null);
  const verdictRowRefs = useRef<(HTMLDivElement | null)[]>([]);
  const newVerdictRef = useRef<HTMLDivElement>(null);
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
        const data = await statsRes.json();
        setStats((data.verdicts ?? data) as Stats);
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

  // Handle new verdict from scan input
  const handleVerdictReceived = useCallback(
    (v: Record<string, unknown>): void => {
      const newVerdict = v as unknown as Verdict;
      setVerdicts((prev) => [newVerdict, ...prev]);

      // Animate the new verdict sliding in
      requestAnimationFrame(() => {
        const el = newVerdictRef.current;
        if (el) {
          gsap.fromTo(
            el,
            { opacity: 0, y: -20, scale: 0.98 },
            {
              opacity: 1,
              y: 0,
              scale: 1,
              duration: 0.4,
              ease: "power2.out",
            },
          );
        }
      });
    },
    [],
  );

  // Handle "Scan Again" from verdict row
  const handleScanAgain = useCallback(
    async (token: string): Promise<void> => {
      try {
        const res = await fetch(`${API_URL}/api/scan/${token}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Caller": "0x8Ce01CF638681e12AFfD10e2feb1E7E3C50b7509",
          },
        });
        if (!res.ok) return;
        const data = (await res.json()) as {
          verdict?: Record<string, unknown>;
        };
        const newVerdict = (data.verdict ?? data) as unknown as Verdict;
        setVerdicts((prev) => [newVerdict, ...prev]);
      } catch {
        // silent fail
      }
    },
    [],
  );

  // GSAP entrance animations
  useEffect(() => {
    if (hasAnimated.current) return;
    hasAnimated.current = true;

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (prefersReducedMotion) return;

    // Stats row fade in
    if (statsRef.current) {
      gsap.fromTo(
        statsRef.current,
        { opacity: 0, y: 8 },
        { opacity: 1, y: 0, duration: 0.4, delay: 0.15, ease: "power2.out" },
      );
    }

    // Scan input
    if (scanInputRef.current) {
      gsap.fromTo(
        scanInputRef.current,
        { opacity: 0, y: 8 },
        { opacity: 1, y: 0, duration: 0.4, delay: 0.2, ease: "power2.out" },
      );
    }

    // Agent panel
    if (agentPanelRef.current) {
      gsap.fromTo(
        agentPanelRef.current,
        { opacity: 0 },
        { opacity: 1, duration: 0.3, delay: 0.25, ease: "power2.out" },
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
      {/* Scan input — top priority */}
      <div ref={scanInputRef} className="mb-6">
        <ScanInput onVerdictReceived={handleVerdictReceived} />
      </div>

      {/* Stats cards */}
      <div ref={statsRef} className="mb-6">
        <InlineStats
          totalScanned={stats?.totalScanned ?? 0}
          totalDangerous={stats?.totalDangerous ?? 0}
          totalSafe={stats?.totalSafe ?? 0}
          lpInvested={stats?.totalLpInvested ?? "$0"}
        />
      </div>

      {/* Agent pipeline bar */}
      <div ref={agentPanelRef}>
        <AgentPanel />
      </div>

      {/* Threat feed */}
      <div className="mb-10">
        <div ref={feedTitleRef} className="flex items-center gap-2 mb-4">
          <Eye className="h-3.5 w-3.5 text-[#a1a1aa]" />
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[#a1a1aa]">
            Threat Feed
          </h2>
          <span className="text-[11px] text-[#a1a1aa]/40 tabular-nums">
            {verdicts.length}
          </span>
        </div>

        {verdicts.length === 0 ? (
          <div className="py-20 text-center border border-white/[0.06] rounded-lg bg-[#111318]/50">
            <Shield className="h-10 w-10 text-[#8b5cf6]/20 mx-auto mb-4" />
            <p className="text-sm text-[#a1a1aa]/60 mb-1 font-medium">
              No verdicts yet
            </p>
            <p className="text-xs text-[#a1a1aa]/30 max-w-sm mx-auto leading-relaxed">
              Enter a token address above to scan, or wait for the autonomous
              scanner to discover tokens.
            </p>
          </div>
        ) : (
          <div
            ref={feedRef}
            className="rounded-lg border border-white/[0.06] overflow-hidden"
          >
            {verdicts.map((v, i) => (
              <VerdictRow
                key={`${v.token}-${v.timestamp}`}
                ref={(el) => {
                  if (i === 0) {
                    newVerdictRef.current = el;
                  }
                  verdictRowRefs.current[i] = el;
                }}
                verdict={v}
                onScanAgain={handleScanAgain}
              />
            ))}
          </div>
        )}
      </div>

      {/* Agent activity */}
      <div ref={activityRef}>
        <div className="flex items-center gap-2 mb-4">
          <Radio className="h-3.5 w-3.5 text-[#a1a1aa]" />
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[#a1a1aa]">
            Agent Activity
          </h2>
        </div>
        <LiveFeed />
      </div>
    </div>
  );
}
