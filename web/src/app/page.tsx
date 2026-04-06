"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { ArrowRight, ExternalLink, Radar, Shield, BarChart3, Lock, Coins, Zap, Search, Eye, GitBranch, Layers } from "lucide-react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import Lenis from "lenis";
import { AuroraBg } from "../components/aurora-bg";
import { CursorGlow } from "../components/cursor-glow";
import { TiltFrame } from "../components/tilt-frame";

gsap.registerPlugin(ScrollTrigger, SplitText);

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3002";

interface Stats { totalScanned: number; totalSafe: number; totalDangerous: number }

export default function LandingPage(): React.ReactNode {
  const containerRef = useRef<HTMLDivElement>(null);
  const heroH1Ref = useRef<HTMLHeadingElement>(null);
  const heroSubRef = useRef<HTMLParagraphElement>(null);
  const heroCtaRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  const [stats, setStats] = useState<Stats | null>(null);
  const [counters, setCounters] = useState({ scanned: 0, safe: 0, threats: 0 });

  const fetchStats = useCallback(async (): Promise<void> => {
    try {
      const res = await fetch(`${API_URL}/api/stats`);
      if (res.ok) { const d = await res.json(); setStats((d.verdicts ?? d) as Stats); }
    } catch { /* */ }
  }, []);
  useEffect(() => { fetchStats(); }, [fetchStats]);

  useEffect(() => {
    const lenis = new Lenis({ lerp: 0.08, smoothWheel: true });
    const raf = (t: number): void => { lenis.raf(t); requestAnimationFrame(raf); };
    requestAnimationFrame(raf);
    lenis.on("scroll", ScrollTrigger.update);
    return () => lenis.destroy();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const ctx = gsap.context(() => {
      if (heroH1Ref.current) {
        const split = new SplitText(heroH1Ref.current, { type: "lines" });
        gsap.set(split.lines, { opacity: 0, y: 40 });
        gsap.to(split.lines, { opacity: 1, y: 0, duration: 0.7, stagger: 0.12, ease: "power3.out", delay: 0.2 });
      }
      if (heroSubRef.current) gsap.fromTo(heroSubRef.current, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.6, delay: 0.7 });
      if (heroCtaRef.current) gsap.fromTo(heroCtaRef.current, { opacity: 0, y: 15 }, { opacity: 1, y: 0, duration: 0.5, delay: 0.9 });
      if (previewRef.current) gsap.fromTo(previewRef.current, { opacity: 0, y: 40, scale: 0.97 }, { opacity: 1, y: 0, scale: 1, duration: 0.8, delay: 1.1 });

      document.querySelectorAll("[data-reveal]").forEach((el) => {
        gsap.fromTo(el, { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.6, scrollTrigger: { trigger: el, start: "top 88%" } });
      });

      if (stats) {
        const el = document.getElementById("live-counters");
        if (el) ScrollTrigger.create({ trigger: el, start: "top 80%", once: true, onEnter: () => {
          [{ k: "scanned" as const, v: stats.totalScanned }, { k: "safe" as const, v: stats.totalSafe }, { k: "threats" as const, v: stats.totalDangerous }].forEach(({ k, v }) => {
            const o = { n: 0 };
            gsap.to(o, { n: v, duration: 1.5, snap: { n: 1 }, onUpdate: () => setCounters((p) => ({ ...p, [k]: Math.round(o.n) })) });
          });
        }});
      }
    }, containerRef);
    return () => ctx.revert();
  }, [stats]);

  return (
    <div ref={containerRef} className="relative">
      <AuroraBg />
      <CursorGlow />

      {/* HERO */}
      <section className="relative pt-24 lg:pt-36 pb-16 px-6">
        <div className="max-w-[1100px] mx-auto text-center">
          <p className="text-[11px] uppercase tracking-[0.3em] text-[#a1a1aa]/50 mb-6">Self-Funding Security Oracle on X Layer</p>
          <h1 ref={heroH1Ref} className="text-[clamp(2.2rem,5vw,4rem)] font-bold tracking-[-0.02em] text-[#fafafa] leading-[1.15] mb-6 max-w-[800px] mx-auto">
            Autonomous agents that scan tokens, publish verdicts, and invest in what they trust.
          </h1>
          <p ref={heroSubRef} className="text-base text-[#a1a1aa] max-w-[520px] mx-auto mb-8 leading-relaxed" style={{ opacity: 0 }}>
            Three AI agents with real wallets. Every security verdict on-chain. Every LP position verifiable. Skin in the game.
          </p>
          <div ref={heroCtaRef} className="flex items-center justify-center gap-3 mb-16" style={{ opacity: 0 }}>
            <Link href="/feed" className="group inline-flex items-center gap-2 rounded-lg bg-[#8b5cf6] px-6 py-3 text-sm font-semibold text-white hover:bg-[#7c3aed] transition-all">
              Open Threat Feed <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
            </Link>
            <a href="https://github.com/checkra1neth/sentinel" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-lg border border-[#27272a] px-6 py-3 text-sm font-medium text-[#a1a1aa] hover:text-[#fafafa] hover:border-[#3f3f46] transition-all">
              GitHub <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>

          {/* Product preview — 3D tilt frame with rotating gradient border */}
          <div ref={previewRef} style={{ opacity: 0 }}>
            <TiltFrame>
              <div className="bg-[#18181b] px-4 py-2.5 flex items-center gap-2 border-b border-[#27272a]/60">
                <div className="flex gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-[#ef4444]/60" /><div className="w-2.5 h-2.5 rounded-full bg-[#f59e0b]/60" /><div className="w-2.5 h-2.5 rounded-full bg-[#34d399]/60" /></div>
                <span className="text-[10px] font-mono text-[#71717a] ml-2">sentinel.app/feed</span>
                <div className="ml-auto flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#34d399] animate-pulse" />
                  <span className="text-[9px] text-[#71717a]">Live</span>
                </div>
              </div>
              <iframe src="/feed" className="w-full h-[420px] lg:h-[520px] pointer-events-none" title="Sentinel Threat Feed Preview" loading="lazy" />
            </TiltFrame>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="py-24 px-6">
        <div className="max-w-[1100px] mx-auto">
          <p data-reveal className="text-[11px] uppercase tracking-[0.3em] text-[#a1a1aa]/40 mb-3" style={{ opacity: 0 }}>Features</p>
          <h2 data-reveal className="text-2xl lg:text-3xl font-bold text-[#fafafa] mb-4" style={{ opacity: 0 }}>Everything the oracle needs.</h2>
          <p data-reveal className="text-sm text-[#a1a1aa]/60 mb-12 max-w-lg" style={{ opacity: 0 }}>Built on OKX OnchainOS with 22 AI skills. Designed for autonomous operation on X Layer.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-10">
            {[
              { icon: Radar, title: "Token Discovery", desc: "Scans dex-trenches, smart money signals, hot tokens, and migrated pairs. 4 sources, 59+ tokens discovered." },
              { icon: Shield, title: "Security Analysis", desc: "7 independent risk signals from OKX security scan, bytecode probe, holder analysis, and price action." },
              { icon: BarChart3, title: "Risk Scoring", desc: "0-100 composite score. SAFE / CAUTION / DANGEROUS. Every factor weighted and transparent." },
              { icon: Lock, title: "On-Chain Verdicts", desc: "Published to VerdictRegistry smart contract on X Layer. Immutable. Verifiable by anyone." },
              { icon: Coins, title: "LP Investment", desc: "Executor invests in Uniswap pools for SAFE tokens. Risk-based range: lower risk = wider position." },
              { icon: Zap, title: "x402 Payments", desc: "Agents pay each other via x402 protocol. Machine-to-machine payments. Self-sustaining economy." },
            ].map((f) => (
              <div key={f.title} data-reveal className="flex flex-col" style={{ opacity: 0 }}>
                <f.icon className="h-5 w-5 text-[#a1a1aa]/40 mb-4" />
                <h3 className="text-sm font-semibold text-[#fafafa] mb-2">{f.title}</h3>
                <p className="text-sm text-[#a1a1aa]/50 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* THESIS */}
      <section className="py-24 px-6">
        <div className="max-w-[1100px] mx-auto rounded-2xl bg-[#18181b]/50 border border-[#27272a]/40 px-8 sm:px-16 py-16">
          <p data-reveal className="text-[11px] uppercase tracking-[0.3em] text-[#8b5cf6]/60 mb-4" style={{ opacity: 0 }}>Why Sentinel</p>
          <h2 data-reveal className="text-2xl lg:text-[2rem] font-bold text-[#fafafa] leading-[1.3] mb-6 max-w-2xl" style={{ opacity: 0 }}>
            Most security tools grade tokens then walk away. Sentinel grades them, then bets its own money on the result.
          </h2>
          <p data-reveal className="text-sm text-[#a1a1aa]/50 leading-relaxed max-w-lg" style={{ opacity: 0 }}>
            If the analysis is wrong, the agent loses capital. If it&apos;s right, the agent earns LP fees. Aligned incentives. No subscription. No trust required.
          </p>
        </div>
      </section>

      {/* PIPELINE */}
      <section className="py-24 px-6">
        <div className="max-w-[1100px] mx-auto">
          <p data-reveal className="text-[11px] uppercase tracking-[0.3em] text-[#a1a1aa]/40 mb-3" style={{ opacity: 0 }}>Architecture</p>
          <h2 data-reveal className="text-2xl lg:text-3xl font-bold text-[#fafafa] mb-12" style={{ opacity: 0 }}>The pipeline.</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {[
              { n: "1", title: "Discover", desc: "Scanner queries OKX dex-trenches, signals, and hot tokens every 5 min", icon: Search },
              { n: "2", title: "Analyze", desc: "Analyst runs 7-source deep scan. Risk score 0-100 calculated", icon: Eye },
              { n: "3", title: "Publish", desc: "Verdict published on-chain to VerdictRegistry. Immutable record", icon: GitBranch },
              { n: "4", title: "Invest", desc: "Executor finds Uniswap pool, invests with risk-based LP range", icon: Layers },
              { n: "5", title: "Earn", desc: "LP fees compound. Agents pay each other via x402. Self-sustaining", icon: Zap },
            ].map((s) => (
              <div key={s.n} data-reveal className="rounded-lg border border-[#27272a]/40 p-5 flex flex-col" style={{ opacity: 0 }}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs font-mono tabular-nums text-[#8b5cf6]/40">{s.n}</span>
                  <s.icon className="h-3.5 w-3.5 text-[#a1a1aa]/30" />
                </div>
                <h3 className="text-sm font-semibold text-[#fafafa] mb-2">{s.title}</h3>
                <p className="text-xs text-[#a1a1aa]/50 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* AGENTS */}
      <section className="py-24 px-6">
        <div className="max-w-[1100px] mx-auto">
          <p data-reveal className="text-[11px] uppercase tracking-[0.3em] text-[#a1a1aa]/40 mb-3" style={{ opacity: 0 }}>Agents</p>
          <h2 data-reveal className="text-2xl lg:text-3xl font-bold text-[#fafafa] mb-12" style={{ opacity: 0 }}>Three wallets. Three roles.</h2>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {[
              { name: "Scanner", color: "#06b6d4", addr: "0x38c7...db2", desc: "Discovers tokens via 4 OKX data sources. Runs autonomously every 5 minutes. Pays Analyst via x402.", skills: ["dex-trenches", "dex-signal", "dex-token", "dex-market"] },
              { name: "Analyst", color: "#8b5cf6", addr: "0x8743...03", desc: "Deep security analysis from 7 sources. Publishes on-chain verdicts. Pays Executor for LP investment.", skills: ["security", "dex-token", "memepump", "onchain-gateway"] },
              { name: "Executor", color: "#34d399", addr: "0x7500...00", desc: "Invests in Uniswap LP for SAFE tokens. Risk-based range sizing. Earns LP fees that fund the pipeline.", skills: ["defi-invest", "defi-portfolio", "dex-swap", "liquidity-planner"] },
            ].map((a) => (
              <div key={a.name} data-reveal className="rounded-lg border border-[#27272a]/40 p-6" style={{ opacity: 0 }}>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: a.color }}>{a.name}</span>
                  <span className="text-[10px] font-mono text-[#71717a]">{a.addr}</span>
                </div>
                <p className="text-sm text-[#a1a1aa]/60 leading-relaxed mb-4">{a.desc}</p>
                <div className="flex flex-wrap gap-1.5">
                  {a.skills.map((s) => <span key={s} className="text-[10px] text-[#71717a] bg-[#27272a]/30 rounded px-2 py-0.5">{s}</span>)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* STATS */}
      <section id="live-counters" className="py-24 px-6 text-center">
        <p data-reveal className="text-[11px] uppercase tracking-[0.3em] text-[#a1a1aa]/40 mb-8" style={{ opacity: 0 }}>Live on X Layer</p>
        <div className="flex justify-center gap-16 sm:gap-24">
          {[
            { label: "Scanned", val: counters.scanned, color: "#fafafa" },
            { label: "Verified Safe", val: counters.safe, color: "#34d399" },
            { label: "Threats Found", val: counters.threats, color: "#ef4444" },
          ].map((s) => (
            <div key={s.label}>
              <div className="text-4xl sm:text-5xl font-bold tabular-nums" style={{ color: s.color }}>{s.val}</div>
              <div className="text-[10px] uppercase tracking-[0.25em] text-[#71717a] mt-2">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6">
        <div className="max-w-[1100px] mx-auto rounded-2xl bg-[#18181b]/50 border border-[#27272a]/40 py-16 text-center">
          <h2 data-reveal className="text-2xl lg:text-3xl font-bold text-[#fafafa] mb-4" style={{ opacity: 0 }}>See it live.</h2>
          <p data-reveal className="text-sm text-[#a1a1aa]/50 mb-8" style={{ opacity: 0 }}>Every verdict on-chain. Every position real. All code open-source.</p>
          <div data-reveal className="flex items-center justify-center gap-3" style={{ opacity: 0 }}>
            <Link href="/feed" className="group inline-flex items-center gap-2 rounded-lg bg-[#8b5cf6] px-6 py-3 text-sm font-semibold text-white hover:bg-[#7c3aed] transition-all">
              Open Threat Feed <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
            </Link>
            <a href="https://github.com/checkra1neth/sentinel" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-lg border border-[#27272a] px-6 py-3 text-sm font-medium text-[#a1a1aa] hover:text-[#fafafa] transition-all">
              Get the Source <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
      </section>

      {/* TECH + FOOTER */}
      <footer className="py-12 px-6 border-t border-[#27272a]/30">
        <div className="max-w-[1100px] mx-auto">
          <div className="flex flex-wrap justify-center gap-2 mb-8">
            {["OKX OnchainOS", "Agentic Wallets", "14 OKX Skills", "8 Uniswap Skills", "x402 Protocol", "VerdictRegistry", "X Layer", "Uniswap V3/V4"].map((t) => (
              <span key={t} className="rounded-full border border-[#27272a]/40 px-4 py-1.5 text-[11px] text-[#71717a]">{t}</span>
            ))}
          </div>
          <div className="flex items-center justify-between text-[11px] text-[#71717a]">
            <span>Sentinel</span>
            <div className="flex gap-6">
              {[{ l: "Feed", h: "/feed" }, { l: "Portfolio", h: "/portfolio" }, { l: "Agents", h: "/agents" }, { l: "GitHub", h: "https://github.com/checkra1neth/sentinel" }].map((lk) => (
                <a key={lk.l} href={lk.h} className="hover:text-[#a1a1aa] transition-colors">{lk.l}</a>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
