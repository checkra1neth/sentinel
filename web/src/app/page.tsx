"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { Shield, Radar, Eye, Coins, ArrowRight, ExternalLink } from "lucide-react";
import gsap from "gsap";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3002";

interface Stats {
  totalScanned: number;
  totalSafe: number;
  totalCaution: number;
  totalDangerous: number;
  totalLpInvested: number;
}

export default function LandingPage(): React.ReactNode {
  const heroRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const subtitleRef = useRef<HTMLParagraphElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const statsRef = useRef<HTMLDivElement>(null);
  const archRef = useRef<HTMLDivElement>(null);
  const flowRef = useRef<HTMLDivElement>(null);

  const [stats, setStats] = useState<Stats | null>(null);

  const fetchStats = useCallback(async (): Promise<void> => {
    try {
      const res = await fetch(`${API_URL}/api/stats`);
      if (res.ok) {
        const data = await res.json();
        setStats((data.verdicts ?? data) as Stats);
      }
    } catch { /* */ }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) return;

    const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

    // Hero sequence
    tl.fromTo(titleRef.current, { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 0.8 })
      .fromTo(subtitleRef.current, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.6 }, "-=0.4")
      .fromTo(ctaRef.current, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.5 }, "-=0.3");

    // Stats counter
    if (statsRef.current) {
      tl.fromTo(statsRef.current, { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.6 }, "-=0.2");
    }

    // Feature grid stagger
    if (gridRef.current) {
      const cards = gridRef.current.querySelectorAll("[data-card]");
      tl.fromTo(cards, { opacity: 0, y: 40, scale: 0.95 }, {
        opacity: 1, y: 0, scale: 1, duration: 0.5, stagger: 0.12,
      }, "-=0.3");
    }

    // Architecture
    if (archRef.current) {
      tl.fromTo(archRef.current, { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.6 }, "-=0.1");
    }

    // Flow steps
    if (flowRef.current) {
      const steps = flowRef.current.querySelectorAll("[data-step]");
      tl.fromTo(steps, { opacity: 0, x: -20 }, {
        opacity: 1, x: 0, duration: 0.4, stagger: 0.1,
      }, "-=0.3");
    }
  }, []);

  return (
    <div className="mx-auto max-w-[1400px] px-6 lg:px-10">
      {/* Hero */}
      <div ref={heroRef} className="py-20 lg:py-32 text-center">
        <h1
          ref={titleRef}
          className="text-4xl lg:text-6xl font-bold tracking-tight text-[#e8eaed] mb-6 leading-[1.1]"
          style={{ opacity: 0 }}
        >
          Most security tools tell you<br />
          what&apos;s dangerous.<br />
          <span className="text-[#6366f1]">Sentinel puts its money<br />on what&apos;s safe.</span>
        </h1>
        <p
          ref={subtitleRef}
          className="text-lg text-[#7a7f8a] max-w-2xl mx-auto mb-10 leading-relaxed"
          style={{ opacity: 0 }}
        >
          Three autonomous AI agents scan every token on X Layer, publish
          on-chain security verdicts, and invest in what they verify as safe.
          Skin in the game.
        </p>
        <div ref={ctaRef} className="flex items-center justify-center gap-4" style={{ opacity: 0 }}>
          <Link
            href="/feed"
            className="inline-flex items-center gap-2 rounded-md bg-[#6366f1] px-6 py-3 text-sm font-semibold text-white hover:bg-[#5558e6] hover:shadow-[0_0_24px_rgba(99,102,241,0.3)] transition-all"
          >
            Open Threat Feed
            <ArrowRight className="h-4 w-4" />
          </Link>
          <a
            href="https://github.com/checkra1neth/sentinel"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-md border border-[#1a1d24] px-6 py-3 text-sm font-medium text-[#7a7f8a] hover:text-[#e8eaed] hover:border-[#6366f1]/30 transition-all"
          >
            GitHub
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>

      {/* Live stats */}
      {stats && (
        <div ref={statsRef} className="flex justify-center gap-12 mb-20" style={{ opacity: 0 }}>
          {[
            { label: "Scanned", value: stats.totalScanned, color: "#e8eaed" },
            { label: "Safe", value: stats.totalSafe, color: "#34d399" },
            { label: "Caution", value: stats.totalCaution, color: "#f59e0b" },
            { label: "Threats", value: stats.totalDangerous, color: "#ef4444" },
          ].map((s) => (
            <div key={s.label} className="text-center">
              <div className="text-3xl font-bold tabular-nums" style={{ color: s.color }}>{s.value}</div>
              <div className="text-[11px] uppercase tracking-[0.15em] text-[#7a7f8a]/60 mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Feature grid */}
      <div ref={gridRef} className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-20">
        <div data-card className="rounded-lg border border-[#1a1d24]/50 p-6" style={{ borderTopColor: "#22d3ee", borderTopWidth: 2, opacity: 0 }}>
          <Radar className="h-5 w-5 text-[#22d3ee] mb-4" />
          <h3 className="text-sm font-semibold text-[#e8eaed] mb-2">Scanner Agent</h3>
          <p className="text-xs text-[#7a7f8a] leading-relaxed">
            Discovers new tokens via OKX dex-trenches, smart money signals, and hot tokens.
            Runs autonomously every 5 minutes scanning X Layer for new deployments.
          </p>
        </div>
        <div data-card className="rounded-lg border border-[#1a1d24]/50 p-6" style={{ borderTopColor: "#6366f1", borderTopWidth: 2, opacity: 0 }}>
          <Shield className="h-5 w-5 text-[#6366f1] mb-4" />
          <h3 className="text-sm font-semibold text-[#e8eaed] mb-2">Analyst Agent</h3>
          <p className="text-xs text-[#7a7f8a] leading-relaxed">
            Deep security analysis from 7 sources: OKX security scan, risk levels, holder analysis,
            bytecode probe, liquidity check, price action, and community metrics.
          </p>
        </div>
        <div data-card className="rounded-lg border border-[#1a1d24]/50 p-6" style={{ borderTopColor: "#34d399", borderTopWidth: 2, opacity: 0 }}>
          <Coins className="h-5 w-5 text-[#34d399] mb-4" />
          <h3 className="text-sm font-semibold text-[#e8eaed] mb-2">Executor Agent</h3>
          <p className="text-xs text-[#7a7f8a] leading-relaxed">
            Invests in SAFE-rated tokens via Uniswap LP with risk-based position sizing.
            Range width adapts to risk score: lower risk = wider exposure.
          </p>
        </div>
      </div>

      {/* How it works */}
      <div ref={archRef} className="mb-20" style={{ opacity: 0 }}>
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#7a7f8a] mb-8 text-center">
          How Sentinel Works
        </h2>
        <div ref={flowRef} className="max-w-3xl mx-auto space-y-4">
          {[
            { step: "01", title: "Discover", desc: "Scanner finds new tokens on X Layer via OKX OnchainOS skills (dex-trenches, smart money, hot tokens)", color: "#22d3ee" },
            { step: "02", title: "Analyze", desc: "Analyst performs deep security scan using 7 data sources, calculates risk score 0-100, classifies SAFE / CAUTION / DANGEROUS", color: "#6366f1" },
            { step: "03", title: "Publish", desc: "Verdict published on-chain to VerdictRegistry smart contract on X Layer. Immutable, verifiable.", color: "#f59e0b" },
            { step: "04", title: "Invest", desc: "If SAFE: Executor invests in Uniswap LP pool with risk-based range. Skin in the game.", color: "#34d399" },
            { step: "05", title: "Earn", desc: "LP fees flow back to agent wallets. Agents pay each other via x402 protocol. Self-sustaining economy.", color: "#34d399" },
          ].map((item) => (
            <div key={item.step} data-step className="flex items-start gap-4 py-3" style={{ opacity: 0 }}>
              <span className="text-xs font-mono tabular-nums shrink-0 w-6" style={{ color: item.color }}>{item.step}</span>
              <div className="h-px flex-shrink-0 w-8 mt-2" style={{ backgroundColor: item.color, opacity: 0.3 }} />
              <div>
                <span className="text-sm font-semibold text-[#e8eaed]">{item.title}</span>
                <p className="text-xs text-[#7a7f8a] mt-0.5 leading-relaxed">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tech stack */}
      <div className="text-center pb-20">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#7a7f8a] mb-6">
          Built With
        </h2>
        <div className="flex flex-wrap justify-center gap-3">
          {[
            "OKX OnchainOS", "Agentic Wallets", "14 OKX Skills", "8 Uniswap Skills",
            "x402 Protocol", "VerdictRegistry", "X Layer", "Uniswap V3/V4",
          ].map((tech) => (
            <span
              key={tech}
              className="rounded-full border border-[#1a1d24] px-3 py-1 text-[11px] text-[#7a7f8a]"
            >
              {tech}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
