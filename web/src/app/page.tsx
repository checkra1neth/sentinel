"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { ArrowRight, ExternalLink } from "lucide-react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { DrawSVGPlugin } from "gsap/DrawSVGPlugin";
import { CustomEase } from "gsap/CustomEase";

gsap.registerPlugin(ScrollTrigger, SplitText, DrawSVGPlugin, CustomEase);

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3002";

interface Stats {
  totalScanned: number;
  totalSafe: number;
  totalCaution: number;
  totalDangerous: number;
}

// Shield SVG path for draw animation
const SHIELD_PATH = "M12 2s-4.2 1.8-8 3v8c0 5 3.5 7.5 8 9 4.5-1.5 8-4 8-9V5c-3.8-1.2-8-3-8-3Z";
const SCAN_CIRCLE = "M12 12m-8 0a8 8 0 1 0 16 0a8 8 0 1 0-16 0";
const CHECK_PATH = "M9 12l2 2 4-4";

export default function LandingPage(): React.ReactNode {
  const containerRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const headlineRef = useRef<HTMLHeadingElement>(null);
  const subRef = useRef<HTMLParagraphElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);
  const shieldRef = useRef<SVGSVGElement>(null);
  const statsRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef<HTMLDivElement>(null);
  const flowRef = useRef<HTMLDivElement>(null);
  const techRef = useRef<HTMLDivElement>(null);
  const gridBgRef = useRef<HTMLDivElement>(null);

  const [stats, setStats] = useState<Stats | null>(null);
  const [counters, setCounters] = useState({ scanned: 0, safe: 0, caution: 0, threats: 0 });

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

  // Main animation timeline
  useEffect(() => {
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) return;

    CustomEase.create("sentinel", "M0,0 C0.14,0 0.242,0.438 0.272,0.561 0.313,0.728 0.354,0.963 0.362,1 0.37,0.985 0.45,1 1,1");

    const ctx = gsap.context(() => {
      // ── Hero shield draw animation ──
      if (shieldRef.current) {
        const paths = shieldRef.current.querySelectorAll("path");
        gsap.set(paths, { drawSVG: "0%" });
        gsap.to(paths[0], { drawSVG: "100%", duration: 1.5, ease: "power2.inOut", delay: 0.3 });
        gsap.to(paths[1], { drawSVG: "100%", duration: 0.8, ease: "power2.out", delay: 1.2 });
        gsap.to(paths[2], { drawSVG: "100%", duration: 0.5, ease: "power2.out", delay: 1.6 });

        // Pulse glow after draw
        gsap.to(shieldRef.current, {
          filter: "drop-shadow(0 0 20px rgba(99,102,241,0.4))",
          duration: 1.5,
          delay: 2,
          ease: "power2.out",
          yoyo: true,
          repeat: -1,
          repeatDelay: 1,
        });
      }

      // ── Headline split text reveal ──
      if (headlineRef.current) {
        const split = new SplitText(headlineRef.current, { type: "lines,words" });
        gsap.set(split.words, { opacity: 0, y: 30, rotateX: -40 });
        gsap.to(split.words, {
          opacity: 1, y: 0, rotateX: 0,
          duration: 0.6, stagger: 0.04, ease: "sentinel",
          delay: 0.5,
        });
      }

      // ── Subtitle fade up ──
      if (subRef.current) {
        gsap.fromTo(subRef.current,
          { opacity: 0, y: 20 },
          { opacity: 1, y: 0, duration: 0.8, ease: "power2.out", delay: 1.2 }
        );
      }

      // ── CTA buttons scale in ──
      if (ctaRef.current) {
        gsap.fromTo(ctaRef.current,
          { opacity: 0, scale: 0.9 },
          { opacity: 1, scale: 1, duration: 0.5, ease: "back.out(1.7)", delay: 1.6 }
        );
      }

      // ── Grid background parallax ──
      if (gridBgRef.current) {
        gsap.to(gridBgRef.current, {
          y: -100,
          ease: "none",
          scrollTrigger: {
            trigger: containerRef.current,
            start: "top top",
            end: "bottom top",
            scrub: 1,
          },
        });
      }

      // ── Stats counter animation on scroll ──
      if (statsRef.current && stats) {
        ScrollTrigger.create({
          trigger: statsRef.current,
          start: "top 80%",
          once: true,
          onEnter: () => {
            const targets = [
              { key: "scanned" as const, value: stats.totalScanned },
              { key: "safe" as const, value: stats.totalSafe },
              { key: "caution" as const, value: stats.totalCaution },
              { key: "threats" as const, value: stats.totalDangerous },
            ];
            targets.forEach(({ key, value }) => {
              const obj = { v: 0 };
              gsap.to(obj, {
                v: value,
                duration: 1.5,
                ease: "power2.out",
                snap: { v: 1 },
                onUpdate: () => setCounters((prev) => ({ ...prev, [key]: Math.round(obj.v) })),
              });
            });
            gsap.fromTo(statsRef.current, { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 0.8, ease: "power2.out" });
          },
        });
      }

      // ── Feature cards stagger on scroll ──
      if (cardsRef.current) {
        const cards = cardsRef.current.querySelectorAll("[data-card]");
        gsap.set(cards, { opacity: 0, y: 60, scale: 0.9 });
        ScrollTrigger.batch(cards, {
          onEnter: (batch) => {
            gsap.to(batch, {
              opacity: 1, y: 0, scale: 1,
              duration: 0.7, stagger: 0.15, ease: "sentinel",
            });
          },
          start: "top 85%",
        });
      }

      // ── Flow steps slide in from left on scroll ──
      if (flowRef.current) {
        const steps = flowRef.current.querySelectorAll("[data-step]");
        steps.forEach((step, i) => {
          gsap.fromTo(step,
            { opacity: 0, x: -60, clipPath: "inset(0 100% 0 0)" },
            {
              opacity: 1, x: 0, clipPath: "inset(0 0% 0 0)",
              duration: 0.7, ease: "power3.out",
              scrollTrigger: { trigger: step, start: "top 85%" },
              delay: i * 0.05,
            }
          );
        });
      }

      // ── Tech pills scatter in ──
      if (techRef.current) {
        const pills = techRef.current.querySelectorAll("[data-pill]");
        gsap.set(pills, { opacity: 0, scale: 0, rotation: () => gsap.utils.random(-15, 15) });
        ScrollTrigger.create({
          trigger: techRef.current,
          start: "top 85%",
          once: true,
          onEnter: () => {
            gsap.to(pills, {
              opacity: 1, scale: 1, rotation: 0,
              duration: 0.4, stagger: { each: 0.05, from: "random" },
              ease: "back.out(2)",
            });
          },
        });
      }
    }, containerRef);

    return () => ctx.revert();
  }, [stats]);

  return (
    <div ref={containerRef} className="relative overflow-hidden">
      {/* Animated grid background */}
      <div
        ref={gridBgRef}
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          backgroundImage: `
            linear-gradient(rgba(99,102,241,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(99,102,241,0.03) 1px, transparent 1px)
          `,
          backgroundSize: "60px 60px",
        }}
      />
      {/* Radial gradient overlay */}
      <div className="pointer-events-none absolute inset-0 -z-10" style={{
        background: "radial-gradient(ellipse 60% 50% at 50% 30%, rgba(99,102,241,0.06) 0%, transparent 70%)",
      }} />

      <div className="mx-auto max-w-[1400px] px-6 lg:px-10">
        {/* ── HERO ── */}
        <div ref={heroRef} className="relative pt-24 lg:pt-40 pb-16 text-center">
          {/* Animated shield */}
          <div className="flex justify-center mb-8">
            <svg
              ref={shieldRef}
              width="64"
              height="64"
              viewBox="0 0 24 24"
              fill="none"
              strokeWidth="1"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-[#6366f1]"
            >
              <path d={SHIELD_PATH} stroke="currentColor" />
              <path d={SCAN_CIRCLE} stroke="rgba(99,102,241,0.3)" strokeWidth="0.5" />
              <path d={CHECK_PATH} stroke="#34d399" strokeWidth="1.5" />
            </svg>
          </div>

          <h1
            ref={headlineRef}
            className="text-3xl sm:text-4xl lg:text-6xl font-bold tracking-tight text-[#e8eaed] mb-6 leading-[1.15]"
            style={{ perspective: "600px" }}
          >
            Most security tools tell you what&apos;s dangerous.
            <br />
            <span className="text-[#6366f1]">Sentinel puts its money on what&apos;s safe.</span>
          </h1>

          <p
            ref={subRef}
            className="text-base lg:text-lg text-[#7a7f8a] max-w-2xl mx-auto mb-10 leading-relaxed"
            style={{ opacity: 0 }}
          >
            Three autonomous AI agents scan every token on X Layer, publish
            on-chain security verdicts, and invest in what they verify.
            Skin in the game.
          </p>

          <div ref={ctaRef} className="flex items-center justify-center gap-4 flex-wrap" style={{ opacity: 0 }}>
            <Link
              href="/feed"
              className="group inline-flex items-center gap-2 rounded-md bg-[#6366f1] px-7 py-3 text-sm font-semibold text-white hover:bg-[#5558e6] hover:shadow-[0_0_30px_rgba(99,102,241,0.35)] transition-all duration-300"
            >
              Open Threat Feed
              <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
            </Link>
            <a
              href="https://github.com/checkra1neth/sentinel"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-md border border-[#1a1d24] px-7 py-3 text-sm font-medium text-[#7a7f8a] hover:text-[#e8eaed] hover:border-[#6366f1]/30 transition-all duration-300"
            >
              GitHub
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>

        {/* ── LIVE STATS ── */}
        <div ref={statsRef} className="py-16" style={{ opacity: 0 }}>
          <div className="flex justify-center gap-8 sm:gap-16">
            {[
              { label: "Tokens Scanned", value: counters.scanned, color: "#e8eaed" },
              { label: "Safe", value: counters.safe, color: "#34d399" },
              { label: "Caution", value: counters.caution, color: "#f59e0b" },
              { label: "Threats Detected", value: counters.threats, color: "#ef4444" },
            ].map((s) => (
              <div key={s.label} className="text-center">
                <div className="text-3xl lg:text-5xl font-bold tabular-nums" style={{ color: s.color }}>
                  {s.value}
                </div>
                <div className="text-[10px] uppercase tracking-[0.2em] text-[#7a7f8a]/50 mt-2">{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── AGENT CARDS ── */}
        <div ref={cardsRef} className="grid grid-cols-1 md:grid-cols-3 gap-5 py-16">
          {[
            {
              name: "Scanner",
              color: "#22d3ee",
              desc: "Discovers new tokens via OKX dex-trenches, smart money signals, and hot tokens. Autonomous scan every 5 minutes.",
              detail: "4 data sources / 59+ tokens discovered",
            },
            {
              name: "Analyst",
              color: "#6366f1",
              desc: "Deep security analysis from 7 sources. Risk scoring 0-100. Publishes immutable verdicts on-chain to VerdictRegistry.",
              detail: "7 risk categories / on-chain verdicts",
            },
            {
              name: "Executor",
              color: "#34d399",
              desc: "Invests in SAFE tokens via Uniswap LP with risk-based range. Lower risk = wider exposure. Skin in the game.",
              detail: "Risk-based LP / Uniswap V3 & V4",
            },
          ].map((agent) => (
            <div
              key={agent.name}
              data-card
              className="relative rounded-lg border border-[#1a1d24]/50 p-6 overflow-hidden group hover:border-[#1a1d24] transition-colors duration-300"
              style={{ opacity: 0 }}
            >
              {/* Top accent line */}
              <div className="absolute top-0 left-0 right-0 h-px" style={{ backgroundColor: agent.color, opacity: 0.5 }} />
              {/* Hover glow */}
              <div
                className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-32 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-3xl -z-10"
                style={{ backgroundColor: agent.color }}
              />

              <div className="text-xs font-semibold uppercase tracking-[0.2em] mb-3" style={{ color: agent.color }}>
                {agent.name}
              </div>
              <p className="text-sm text-[#7a7f8a] leading-relaxed mb-4">{agent.desc}</p>
              <span className="text-[10px] font-mono text-[#7a7f8a]/40">{agent.detail}</span>
            </div>
          ))}
        </div>

        {/* ── HOW IT WORKS ── */}
        <div className="py-16">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.25em] text-[#7a7f8a]/60 mb-10 text-center">
            How Sentinel Works
          </h2>
          <div ref={flowRef} className="max-w-3xl mx-auto">
            {[
              { n: "01", title: "Discover", desc: "Scanner finds new tokens on X Layer via OKX OnchainOS skills", color: "#22d3ee" },
              { n: "02", title: "Analyze", desc: "Analyst performs deep scan — 7 data sources, risk score 0-100, verdict classification", color: "#6366f1" },
              { n: "03", title: "Publish", desc: "On-chain verdict to VerdictRegistry. Immutable. Verifiable by anyone.", color: "#f59e0b" },
              { n: "04", title: "Invest", desc: "Executor puts USDT into Uniswap LP for SAFE tokens. Risk-based range sizing.", color: "#34d399" },
              { n: "05", title: "Earn", desc: "LP fees flow back. Agents pay each other via x402. Self-sustaining economy.", color: "#34d399" },
            ].map((item) => (
              <div
                key={item.n}
                data-step
                className="flex items-start gap-5 py-4 border-b border-[#1a1d24]/20 last:border-0"
                style={{ opacity: 0 }}
              >
                <span
                  className="text-2xl font-bold tabular-nums shrink-0 w-10"
                  style={{ color: item.color, opacity: 0.3 }}
                >
                  {item.n}
                </span>
                <div>
                  <span className="text-sm font-semibold text-[#e8eaed]">{item.title}</span>
                  <p className="text-xs text-[#7a7f8a]/60 mt-1 leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── TECH STACK ── */}
        <div ref={techRef} className="py-16 pb-24 text-center">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.25em] text-[#7a7f8a]/60 mb-8">
            Built With
          </h2>
          <div className="flex flex-wrap justify-center gap-2.5 max-w-2xl mx-auto">
            {[
              "OKX OnchainOS", "Agentic Wallets", "14 OKX Skills", "8 Uniswap Skills",
              "x402 Protocol", "VerdictRegistry", "X Layer", "Uniswap V3/V4",
              "viem", "Next.js", "GSAP", "TypeScript",
            ].map((tech) => (
              <span
                key={tech}
                data-pill
                className="rounded-full border border-[#1a1d24]/50 px-4 py-1.5 text-[11px] text-[#7a7f8a]/60 hover:text-[#e8eaed] hover:border-[#6366f1]/30 transition-all duration-200 cursor-default"
                style={{ opacity: 0 }}
              >
                {tech}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
