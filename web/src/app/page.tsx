"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { ArrowRight, ExternalLink } from "lucide-react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { CustomEase } from "gsap/CustomEase";
import Lenis from "lenis";
import { ParticleNetwork } from "../components/particle-network";
import { RadarSweep } from "../components/radar-sweep";

gsap.registerPlugin(ScrollTrigger, SplitText, CustomEase);

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3002";

interface Stats {
  totalScanned: number;
  totalSafe: number;
  totalCaution: number;
  totalDangerous: number;
}

export default function LandingPage(): React.ReactNode {
  const containerRef = useRef<HTMLDivElement>(null);
  const headlineRef = useRef<HTMLHeadingElement>(null);
  const taglineRef = useRef<HTMLParagraphElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);
  const statsRef = useRef<HTMLDivElement>(null);
  const horizontalRef = useRef<HTMLDivElement>(null);
  const horizontalInnerRef = useRef<HTMLDivElement>(null);
  const stackRef = useRef<HTMLDivElement>(null);
  const outroRef = useRef<HTMLDivElement>(null);

  const [stats, setStats] = useState<Stats | null>(null);
  const [counters, setCounters] = useState({ scanned: 0, safe: 0, threats: 0 });

  const fetchStats = useCallback(async (): Promise<void> => {
    try {
      const res = await fetch(`${API_URL}/api/stats`);
      if (res.ok) {
        const data = await res.json();
        setStats((data.verdicts ?? data) as Stats);
      }
    } catch { /* */ }
  }, []);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  // Lenis smooth scroll
  useEffect(() => {
    const lenis = new Lenis({ lerp: 0.08, smoothWheel: true });
    const raf = (time: number): void => {
      lenis.raf(time);
      requestAnimationFrame(raf);
    };
    requestAnimationFrame(raf);
    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.lagSmoothing(0);
    return () => lenis.destroy();
  }, []);

  // GSAP animations
  useEffect(() => {
    if (typeof window === "undefined") return;
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) return;

    CustomEase.create("sentinel", "M0,0 C0.14,0 0.242,0.438 0.272,0.561 0.313,0.728 0.354,0.963 0.362,1 0.37,0.985 0.45,1 1,1");

    const ctx = gsap.context(() => {
      // ── Headline: SplitText scramble-like reveal ──
      if (headlineRef.current) {
        const split = new SplitText(headlineRef.current, { type: "chars,words,lines" });
        gsap.set(split.chars, { opacity: 0, y: 60, rotationX: -90, transformOrigin: "50% 50% -20px" });
        gsap.to(split.chars, {
          opacity: 1, y: 0, rotationX: 0,
          duration: 0.8, stagger: { each: 0.02, from: "start" },
          ease: "sentinel", delay: 0.4,
        });
      }

      // ── Tagline wipe-in ──
      if (taglineRef.current) {
        gsap.fromTo(taglineRef.current,
          { clipPath: "inset(0 100% 0 0)", opacity: 0 },
          { clipPath: "inset(0 0% 0 0)", opacity: 1, duration: 1, ease: "power3.out", delay: 1.4 }
        );
      }

      // ── CTA ──
      if (ctaRef.current) {
        gsap.fromTo(ctaRef.current,
          { opacity: 0, y: 30 },
          { opacity: 1, y: 0, duration: 0.6, ease: "power2.out", delay: 1.8 }
        );
      }

      // ── Stats counter on scroll ──
      if (statsRef.current && stats) {
        ScrollTrigger.create({
          trigger: statsRef.current,
          start: "top 80%",
          once: true,
          onEnter: () => {
            [
              { key: "scanned" as const, val: stats.totalScanned },
              { key: "safe" as const, val: stats.totalSafe },
              { key: "threats" as const, val: stats.totalDangerous },
            ].forEach(({ key, val }) => {
              const o = { v: 0 };
              gsap.to(o, {
                v: val, duration: 2, ease: "power2.out", snap: { v: 1 },
                onUpdate: () => setCounters((p) => ({ ...p, [key]: Math.round(o.v) })),
              });
            });
          },
        });

        gsap.fromTo(statsRef.current,
          { opacity: 0, y: 50 },
          {
            opacity: 1, y: 0, duration: 0.8, ease: "power2.out",
            scrollTrigger: { trigger: statsRef.current, start: "top 85%" },
          }
        );
      }

      // ── Horizontal scroll section ──
      if (horizontalRef.current && horizontalInnerRef.current) {
        const inner = horizontalInnerRef.current;
        const totalWidth = inner.scrollWidth - window.innerWidth;

        gsap.to(inner, {
          x: -totalWidth,
          ease: "none",
          scrollTrigger: {
            trigger: horizontalRef.current,
            start: "top top",
            end: () => `+=${totalWidth}`,
            scrub: 1,
            pin: true,
            anticipatePin: 1,
          },
        });
      }

      // ── Stack cards parallax ──
      if (stackRef.current) {
        const cards = stackRef.current.querySelectorAll("[data-stack]");
        cards.forEach((card, i) => {
          gsap.fromTo(card,
            { opacity: 0, y: 100, scale: 0.85, rotationX: 10 },
            {
              opacity: 1, y: 0, scale: 1, rotationX: 0,
              duration: 0.8, ease: "sentinel",
              scrollTrigger: { trigger: card, start: "top 90%", end: "top 40%", scrub: 1 },
            }
          );
        });
      }

      // ── Outro ──
      if (outroRef.current) {
        gsap.fromTo(outroRef.current,
          { opacity: 0, scale: 0.9 },
          {
            opacity: 1, scale: 1, duration: 1, ease: "power2.out",
            scrollTrigger: { trigger: outroRef.current, start: "top 80%" },
          }
        );
      }
    }, containerRef);

    return () => ctx.revert();
  }, [stats]);

  return (
    <div ref={containerRef}>
      {/* ═══════════════ HERO ═══════════════ */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        {/* Particle canvas background */}
        <div className="absolute inset-0 -z-10">
          <ParticleNetwork className="absolute inset-0" />
        </div>

        {/* Vignette overlay */}
        <div className="absolute inset-0 -z-10 pointer-events-none" style={{
          background: "radial-gradient(ellipse 70% 60% at 50% 50%, transparent 30%, #08090d 100%)",
        }} />

        <div className="relative z-10 text-center px-6 max-w-[900px]">
          {/* Radar */}
          <div className="flex justify-center mb-8">
            <RadarSweep size={200} />
          </div>

          <h1
            ref={headlineRef}
            className="text-3xl sm:text-5xl lg:text-[3.5rem] font-bold tracking-tight text-[#e8eaed] leading-[1.15] mb-6"
            style={{ perspective: "800px" }}
          >
            Sentinel puts its money on what&apos;s safe
          </h1>

          <p
            ref={taglineRef}
            className="text-base lg:text-lg text-[#7a7f8a] max-w-xl mx-auto mb-10 leading-relaxed"
            style={{ opacity: 0 }}
          >
            Autonomous AI agents that scan, analyze, and invest on X Layer.
            Every verdict is on-chain. Every position is real.
          </p>

          <div ref={ctaRef} className="flex items-center justify-center gap-4 flex-wrap" style={{ opacity: 0 }}>
            <Link
              href="/feed"
              className="group inline-flex items-center gap-2 rounded-md bg-[#6366f1] px-7 py-3 text-sm font-semibold text-white hover:bg-[#5558e6] hover:shadow-[0_0_40px_rgba(99,102,241,0.3)] transition-all duration-300"
            >
              Enter App
              <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform duration-200" />
            </Link>
            <a
              href="https://github.com/checkra1neth/sentinel"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-md border border-[#1a1d24] px-7 py-3 text-sm font-medium text-[#7a7f8a] hover:text-[#e8eaed] hover:border-[#6366f1]/20 transition-all duration-300"
            >
              Source
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2">
          <span className="text-[10px] uppercase tracking-[0.3em] text-[#7a7f8a]/30">Scroll</span>
          <div className="w-px h-8 bg-gradient-to-b from-[#6366f1]/40 to-transparent" />
        </div>
      </section>

      {/* ═══════════════ LIVE STATS ═══════════════ */}
      <section ref={statsRef} className="py-24 px-6" style={{ opacity: 0 }}>
        <div className="max-w-[1400px] mx-auto">
          <div className="flex justify-center gap-10 sm:gap-20">
            {[
              { label: "Scanned", value: counters.scanned, color: "#e8eaed" },
              { label: "Verified Safe", value: counters.safe, color: "#34d399" },
              { label: "Threats Found", value: counters.threats, color: "#ef4444" },
            ].map((s) => (
              <div key={s.label} className="text-center">
                <div className="text-4xl lg:text-6xl font-bold tabular-nums" style={{ color: s.color }}>{s.value}</div>
                <div className="text-[10px] uppercase tracking-[0.25em] text-[#7a7f8a]/40 mt-2">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════ HORIZONTAL SCROLL — HOW IT WORKS ═══════════════ */}
      <section ref={horizontalRef} className="relative overflow-hidden">
        <div ref={horizontalInnerRef} className="flex items-center gap-0 h-screen" style={{ width: "fit-content" }}>
          {/* Title panel */}
          <div className="shrink-0 w-screen h-screen flex items-center justify-center px-6">
            <div className="max-w-md">
              <span className="text-[10px] uppercase tracking-[0.3em] text-[#6366f1]/50 mb-4 block">Pipeline</span>
              <h2 className="text-3xl lg:text-4xl font-bold text-[#e8eaed] leading-tight">
                Five steps from discovery to profit
              </h2>
            </div>
          </div>

          {/* Step panels */}
          {[
            { n: "01", title: "Discover", desc: "Scanner agent queries OKX dex-trenches, smart money signals, and hot tokens every 5 minutes. 59+ tokens discovered autonomously.", color: "#22d3ee" },
            { n: "02", title: "Analyze", desc: "Analyst performs deep scan from 7 data sources. OKX security, risk levels, holder analysis, bytecode probe, liquidity, price action, community.", color: "#6366f1" },
            { n: "03", title: "Verdict", desc: "Risk score 0-100 calculated. SAFE / CAUTION / DANGEROUS. Published on-chain to VerdictRegistry smart contract. Immutable.", color: "#f59e0b" },
            { n: "04", title: "Invest", desc: "Executor finds Uniswap LP pool via OKX DeFi skill. Invests with risk-based range: low risk = wide ±20%, high risk = tight ±3%.", color: "#34d399" },
            { n: "05", title: "Compound", desc: "LP fees earned. Agents pay each other via x402 protocol. Self-funding security oracle that gets smarter and richer.", color: "#34d399" },
          ].map((step) => (
            <div key={step.n} className="shrink-0 w-[400px] h-screen flex items-center px-8">
              <div>
                <span className="text-5xl font-bold tabular-nums block mb-4" style={{ color: step.color, opacity: 0.15 }}>
                  {step.n}
                </span>
                <h3 className="text-xl font-bold text-[#e8eaed] mb-3">{step.title}</h3>
                <p className="text-sm text-[#7a7f8a] leading-relaxed">{step.desc}</p>
                <div className="mt-4 h-px w-16" style={{ backgroundColor: step.color, opacity: 0.3 }} />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ═══════════════ AGENT STACK ═══════════════ */}
      <section className="py-24 px-6">
        <div ref={stackRef} className="max-w-[1400px] mx-auto space-y-6">
          {[
            {
              name: "Scanner",
              color: "#22d3ee",
              skills: ["dex-trenches", "dex-signal", "dex-token", "dex-market"],
              desc: "Token discovery across 4 sources. Deduplication. Already-scanned filtering. Autonomous 5-minute loop.",
              stat: "59+ tokens",
            },
            {
              name: "Analyst",
              color: "#6366f1",
              skills: ["security", "dex-token", "memepump", "onchain-gateway", "defi-invest"],
              desc: "7-source security analysis. On-chain verdict publishing. DeFi pool discovery with APR data.",
              stat: "7 risk categories",
            },
            {
              name: "Executor",
              color: "#34d399",
              skills: ["defi-invest", "defi-portfolio", "dex-swap", "liquidity-planner"],
              desc: "Uniswap LP investment with risk-based range sizing. Position tracking. Self-funding via LP fees.",
              stat: "Risk-based LP",
            },
          ].map((agent) => (
            <div
              key={agent.name}
              data-stack
              className="rounded-lg border border-[#1a1d24]/30 p-8 flex flex-col sm:flex-row items-start gap-6"
              style={{ opacity: 0 }}
            >
              <div className="shrink-0 w-20 pt-1">
                <span className="text-xs font-bold uppercase tracking-[0.2em]" style={{ color: agent.color }}>
                  {agent.name}
                </span>
                <div className="mt-2 text-[10px] font-mono text-[#7a7f8a]/30">{agent.stat}</div>
              </div>
              <div className="flex-1">
                <p className="text-sm text-[#7a7f8a] leading-relaxed mb-3">{agent.desc}</p>
                <div className="flex flex-wrap gap-1.5">
                  {agent.skills.map((s) => (
                    <span key={s} className="rounded-full border border-[#1a1d24]/30 px-2.5 py-0.5 text-[10px] text-[#7a7f8a]/40">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ═══════════════ OUTRO CTA ═══════════════ */}
      <section ref={outroRef} className="py-32 px-6 text-center" style={{ opacity: 0 }}>
        <div className="max-w-lg mx-auto">
          <h2 className="text-2xl lg:text-3xl font-bold text-[#e8eaed] mb-4">
            See it live
          </h2>
          <p className="text-sm text-[#7a7f8a] mb-8">
            Every verdict on-chain. Every LP position real. Open-source.
          </p>
          <Link
            href="/feed"
            className="group inline-flex items-center gap-2 rounded-md bg-[#6366f1] px-8 py-3 text-sm font-semibold text-white hover:bg-[#5558e6] hover:shadow-[0_0_40px_rgba(99,102,241,0.3)] transition-all duration-300"
          >
            Open Threat Feed
            <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform duration-200" />
          </Link>
        </div>

        {/* Tech pills */}
        <div className="mt-16 flex flex-wrap justify-center gap-2 max-w-2xl mx-auto">
          {[
            "OKX OnchainOS", "Agentic Wallets", "14 OKX Skills", "8 Uniswap Skills",
            "x402 Protocol", "VerdictRegistry", "X Layer", "Uniswap V3/V4",
          ].map((tech) => (
            <span
              key={tech}
              className="rounded-full border border-[#1a1d24]/30 px-3 py-1 text-[10px] text-[#7a7f8a]/40"
            >
              {tech}
            </span>
          ))}
        </div>
      </section>
    </div>
  );
}
