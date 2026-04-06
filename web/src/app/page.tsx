"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { ArrowRight, ExternalLink } from "lucide-react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { CustomEase } from "gsap/CustomEase";
import Lenis from "lenis";
import { AuroraBg } from "../components/aurora-bg";
import { CursorGlow } from "../components/cursor-glow";
import { ParticleNetwork } from "../components/particle-network";
import { RadarSweep } from "../components/radar-sweep";

gsap.registerPlugin(ScrollTrigger, SplitText, CustomEase);

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3002";

interface Stats { totalScanned: number; totalSafe: number; totalDangerous: number }

export default function LandingPage(): React.ReactNode {
  const containerRef = useRef<HTMLDivElement>(null);
  const heroTitleRef = useRef<HTMLHeadingElement>(null);
  const heroAccentRef = useRef<HTMLHeadingElement>(null);
  const taglineRef = useRef<HTMLParagraphElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);
  const scanLineRef = useRef<HTMLDivElement>(null);
  const s2TitleRef = useRef<HTMLHeadingElement>(null);
  const s3Ref = useRef<HTMLDivElement>(null);
  const outroTitleRef = useRef<HTMLHeadingElement>(null);

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

  // Lenis
  useEffect(() => {
    const lenis = new Lenis({ lerp: 0.07, smoothWheel: true });
    const raf = (time: number): void => { lenis.raf(time); requestAnimationFrame(raf); };
    requestAnimationFrame(raf);
    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.lagSmoothing(0);
    return () => lenis.destroy();
  }, []);

  // All GSAP
  useEffect(() => {
    if (typeof window === "undefined") return;
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) return;

    CustomEase.create("sentinel", "M0,0 C0.14,0 0.242,0.438 0.272,0.561 0.313,0.728 0.354,0.963 0.362,1 0.37,0.985 0.45,1 1,1");

    const ctx = gsap.context(() => {
      // ── Hero title: 3D char reveal ──
      if (heroTitleRef.current) {
        const split = new SplitText(heroTitleRef.current, { type: "chars" });
        gsap.set(split.chars, { opacity: 0, y: 80, rotationX: -90, transformOrigin: "50% 100%" });
        gsap.to(split.chars, {
          opacity: 1, y: 0, rotationX: 0,
          duration: 0.9, stagger: { each: 0.025, from: "start" },
          ease: "sentinel", delay: 0.3,
        });
      }

      // ── Accent line: wipe ──
      if (heroAccentRef.current) {
        const split2 = new SplitText(heroAccentRef.current, { type: "chars" });
        gsap.set(split2.chars, { opacity: 0, y: 40, scale: 0.5 });
        gsap.to(split2.chars, {
          opacity: 1, y: 0, scale: 1,
          duration: 0.6, stagger: { each: 0.02, from: "center" },
          ease: "back.out(2)", delay: 1.0,
        });
      }

      // ── Tagline ──
      if (taglineRef.current) {
        gsap.fromTo(taglineRef.current,
          { opacity: 0, y: 20, filter: "blur(8px)" },
          { opacity: 1, y: 0, filter: "blur(0px)", duration: 0.8, ease: "power2.out", delay: 1.6 }
        );
      }

      // ── CTA ──
      if (ctaRef.current) {
        gsap.fromTo(ctaRef.current,
          { opacity: 0, y: 20 },
          { opacity: 1, y: 0, duration: 0.5, ease: "power2.out", delay: 2.0 }
        );
      }

      // ── Scan line sweep (repeating) ──
      if (scanLineRef.current) {
        gsap.set(scanLineRef.current, { y: "-10vh", opacity: 0 });
        gsap.to(scanLineRef.current, {
          y: "110vh", opacity: 1, duration: 3, ease: "none",
          repeat: -1, repeatDelay: 4, delay: 2.5,
          onRepeat: () => { gsap.set(scanLineRef.current, { y: "-10vh" }); },
        });
      }

      // ── Section 2 title reveal on scroll ──
      if (s2TitleRef.current) {
        const s2split = new SplitText(s2TitleRef.current, { type: "lines" });
        gsap.set(s2split.lines, { opacity: 0, y: 50, clipPath: "inset(0 0 100% 0)" });
        ScrollTrigger.create({
          trigger: s2TitleRef.current,
          start: "top 75%",
          once: true,
          onEnter: () => {
            gsap.to(s2split.lines, {
              opacity: 1, y: 0, clipPath: "inset(0 0 0% 0)",
              duration: 0.8, stagger: 0.15, ease: "power3.out",
            });
          },
        });
      }

      // ── Section 3 cards ──
      if (s3Ref.current) {
        const cards = s3Ref.current.querySelectorAll("[data-agent]");
        cards.forEach((card) => {
          gsap.fromTo(card,
            { opacity: 0, y: 80, scale: 0.92 },
            {
              opacity: 1, y: 0, scale: 1,
              duration: 0.8, ease: "sentinel",
              scrollTrigger: { trigger: card, start: "top 85%" },
            }
          );
        });
      }

      // ── Stats counter ──
      if (stats) {
        const statsEl = document.getElementById("live-stats");
        if (statsEl) {
          ScrollTrigger.create({
            trigger: statsEl,
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
        }
      }

      // ── Outro ──
      if (outroTitleRef.current) {
        const outSplit = new SplitText(outroTitleRef.current, { type: "chars" });
        gsap.set(outSplit.chars, { opacity: 0, scale: 0 });
        ScrollTrigger.create({
          trigger: outroTitleRef.current,
          start: "top 80%",
          once: true,
          onEnter: () => {
            gsap.to(outSplit.chars, {
              opacity: 1, scale: 1,
              duration: 0.4, stagger: { each: 0.02, from: "random" },
              ease: "back.out(3)",
            });
          },
        });
      }
    }, containerRef);

    return () => ctx.revert();
  }, [stats]);

  return (
    <div ref={containerRef} className="relative">
      <AuroraBg />
      <CursorGlow />

      {/* Noise overlay */}
      <div className="pointer-events-none fixed inset-0 -z-10 opacity-[0.03]" style={{
        backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        backgroundRepeat: "repeat",
      }} />

      {/* Scan line */}
      <div
        ref={scanLineRef}
        className="pointer-events-none fixed left-0 right-0 h-px z-50"
        style={{
          background: "linear-gradient(90deg, transparent 0%, rgba(139,92,246,0.4) 30%, rgba(139,92,246,0.6) 50%, rgba(139,92,246,0.4) 70%, transparent 100%)",
          boxShadow: "0 0 20px 4px rgba(139,92,246,0.15)",
          opacity: 0,
        }}
      />

      {/* ═══ HERO ═══ */}
      <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden px-6">
        {/* Particle bg — hero only */}
        <div className="absolute inset-0 -z-10 opacity-40">
          <ParticleNetwork />
        </div>

        {/* Radar — absolute, background visual */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 -z-10 opacity-20">
          <RadarSweep size={500} />
        </div>

        <div className="relative max-w-[800px] text-center" style={{ perspective: "1000px" }}>
          <h1
            ref={heroTitleRef}
            className="text-[clamp(2rem,6vw,4.5rem)] font-bold tracking-tight text-[#fafafa] leading-[1.1] mb-2"
          >
            Security you can verify.
          </h1>
          <h2
            ref={heroAccentRef}
            className="text-[clamp(2rem,6vw,4.5rem)] font-bold tracking-tight leading-[1.1] mb-8"
            style={{ color: "#8b5cf6" }}
          >
            Convictions you can see.
          </h2>

          <p
            ref={taglineRef}
            className="text-sm sm:text-base text-[#a1a1aa] max-w-md mx-auto mb-10 leading-relaxed"
            style={{ opacity: 0 }}
          >
            Three AI agents. Autonomous scanning. On-chain verdicts.
            LP positions on every SAFE token. X Layer.
          </p>

          <div ref={ctaRef} className="flex items-center justify-center gap-4 flex-wrap" style={{ opacity: 0 }}>
            <Link
              href="/feed"
              className="group inline-flex items-center gap-2 rounded-lg bg-[#8b5cf6] px-8 py-3.5 text-sm font-semibold text-white hover:bg-[#7c3aed] hover:shadow-[0_0_50px_rgba(139,92,246,0.25)] transition-all duration-500"
            >
              Enter App
              <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform duration-300" />
            </Link>
            <a
              href="https://github.com/checkra1neth/sentinel"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-[#27272a] bg-[#09090b]/50 backdrop-blur-sm px-8 py-3.5 text-sm font-medium text-[#a1a1aa] hover:text-[#fafafa] hover:border-[#8b5cf6]/20 transition-all duration-500"
            >
              Source
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>

        {/* Scroll cue */}
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 opacity-30">
          <div className="w-5 h-8 rounded-full border border-[#a1a1aa]/30 flex items-start justify-center p-1.5">
            <div className="w-0.5 h-1.5 bg-[#a1a1aa]/50 rounded-full animate-bounce" />
          </div>
        </div>
      </section>

      {/* ═══ SECTION 2 — THE THESIS ═══ */}
      <section className="py-32 px-6">
        <div className="max-w-[700px] mx-auto">
          <h2
            ref={s2TitleRef}
            className="text-2xl sm:text-3xl lg:text-[2.5rem] font-bold text-[#fafafa] leading-[1.2] mb-8"
          >
            Most security tools grade tokens then walk away.
            Sentinel grades them, then bets its own money on the result.
          </h2>
          <p className="text-sm text-[#a1a1aa]/60 leading-relaxed max-w-lg">
            If the analysis is wrong, the agent loses capital.
            If it is right, the agent earns LP fees.
            Aligned incentives. No subscription. No trust required.
          </p>
        </div>
      </section>

      {/* ═══ LIVE NUMBERS ═══ */}
      <section id="live-stats" className="py-24 px-6">
        <div className="max-w-[1400px] mx-auto flex justify-center gap-12 sm:gap-24">
          {[
            { label: "Scanned", value: counters.scanned, color: "#fafafa" },
            { label: "Safe", value: counters.safe, color: "#34d399" },
            { label: "Threats", value: counters.threats, color: "#ef4444" },
          ].map((s) => (
            <div key={s.label} className="text-center">
              <div className="text-4xl sm:text-6xl lg:text-7xl font-bold tabular-nums" style={{ color: s.color }}>{s.value}</div>
              <div className="text-[9px] uppercase tracking-[0.3em] text-[#a1a1aa]/30 mt-3">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ═══ AGENTS ═══ */}
      <section className="py-24 px-6">
        <div ref={s3Ref} className="max-w-[1400px] mx-auto grid grid-cols-1 lg:grid-cols-3 gap-px bg-[#27272a]/20 rounded-xl overflow-hidden">
          {[
            {
              name: "SCANNER",
              accent: "#06b6d4",
              number: "01",
              headline: "See everything",
              body: "Queries 4 OKX data sources every 5 minutes. New token launches, migrated pairs, smart money moves, trending assets. Nothing escapes the scan.",
            },
            {
              name: "ANALYST",
              accent: "#8b5cf6",
              number: "02",
              headline: "Trust nothing",
              body: "7 independent risk signals: honeypot detection, tax analysis, holder concentration, rug history, bytecode inspection, liquidity depth, price volatility.",
            },
            {
              name: "EXECUTOR",
              accent: "#34d399",
              number: "03",
              headline: "Back your words",
              body: "Every SAFE verdict gets capital behind it. Uniswap LP with risk-proportional range. The wider the range, the deeper the conviction.",
            },
          ].map((agent) => (
            <div
              key={agent.name}
              data-agent
              className="relative bg-[#09090b] p-8 sm:p-10 flex flex-col"
              style={{ opacity: 0 }}
            >
              <span className="text-6xl font-bold tabular-nums absolute top-6 right-8" style={{ color: agent.accent, opacity: 0.06 }}>
                {agent.number}
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-[0.3em] mb-6" style={{ color: agent.accent }}>
                {agent.name}
              </span>
              <h3 className="text-xl sm:text-2xl font-bold text-[#fafafa] mb-4 leading-tight">{agent.headline}</h3>
              <p className="text-sm text-[#a1a1aa]/60 leading-relaxed">{agent.body}</p>
              <div className="mt-auto pt-8">
                <div className="h-px w-full" style={{ background: `linear-gradient(90deg, ${agent.accent}30, transparent)` }} />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ═══ OUTRO ═══ */}
      <section className="py-32 px-6 text-center">
        <h2
          ref={outroTitleRef}
          className="text-3xl sm:text-4xl lg:text-5xl font-bold text-[#fafafa] mb-6"
        >
          See it live
        </h2>
        <p className="text-sm text-[#a1a1aa]/50 mb-10 max-w-md mx-auto">
          Every verdict on-chain. Every position real. All code open-source.
        </p>
        <Link
          href="/feed"
          className="group inline-flex items-center gap-2 rounded-lg bg-[#8b5cf6] px-8 py-3.5 text-sm font-semibold text-white hover:bg-[#7c3aed] hover:shadow-[0_0_50px_rgba(139,92,246,0.25)] transition-all duration-500"
        >
          Open Threat Feed
          <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform duration-300" />
        </Link>

        <div className="mt-16 flex flex-wrap justify-center gap-2 max-w-xl mx-auto">
          {["OKX OnchainOS", "Agentic Wallets", "22 AI Skills", "x402", "VerdictRegistry", "X Layer", "Uniswap V3/V4"].map((t) => (
            <span key={t} className="rounded-full border border-[#27272a]/20 px-3 py-1 text-[10px] text-[#a1a1aa]/30">{t}</span>
          ))}
        </div>
      </section>
    </div>
  );
}
