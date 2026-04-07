"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import {
  ArrowRight, ExternalLink, Radar, BarChart3, Terminal,
  Search, Brain, DollarSign, Zap, Link2, CloudUpload,
  Wallet, Shield, Activity, Bell, Sparkles, Database,
  Users, Coins, Heart, Network, Bolt,
} from "lucide-react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import Lenis from "lenis";
import { TiltFrame } from "../components/tilt-frame";
import { PipelineGsap } from "../components/pipeline-gsap";
import { HeroAgents } from "../components/hero-agents";

gsap.registerPlugin(ScrollTrigger, SplitText);

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3002";

interface Stats { totalScanned: number; totalSafe: number; totalDangerous: number }

const SKILLS = [
  { icon: Zap, label: "Swap Tokens" },
  { icon: Link2, label: "Bridge Assets" },
  { icon: CloudUpload, label: "Deploy Contract" },
  { icon: Wallet, label: "Manage LP" },
  { icon: Shield, label: "Contract Audit" },
  { icon: Activity, label: "Price Feed" },
  { icon: Bell, label: "Event Watch" },
  { icon: Sparkles, label: "Yield Farm" },
  { icon: Database, label: "State Query" },
  { icon: Users, label: "DAO Vote" },
  { icon: Coins, label: "Mint Asset" },
  { icon: Heart, label: "Revoke Perms" },
  { icon: Network, label: "Graph Index" },
  { icon: Bolt, label: "Flash Loan" },
];

const FEED_LINES = [
  { time: "14:22:01", agent: "SCANNER", agentColor: "#06b6d4", text: "Detected new liquidity pool: PEPE/WETH (0x4a...f2)" },
  { time: "14:22:04", agent: "ANALYST", agentColor: "#8b5cf6", text: 'Risk Audit for PEPE:', badge: "SAFE", badgeColor: "#34d399", extra: "Score: 92/100" },
  { time: "14:22:08", agent: "EXECUTOR", agentColor: "#34d399", text: "Opening LP position for PEPE. Range: \u00b115%. Tick: 194820" },
  { time: "14:23:45", agent: "SCANNER", agentColor: "#06b6d4", text: "High volatility detected on MOONDOG/WETH. Relaying...", dim: true },
  { time: "14:23:50", agent: "ANALYST", agentColor: "#8b5cf6", text: "Risk Audit for MOONDOG:", badge: "CAUTION", badgeColor: "#f59e0b", extra: "Low Liquidity ( < $1k )", dim: true },
  { time: "14:23:52", agent: "EXECUTOR", agentColor: "#34d399", text: "Execution Skipped. Risk threshold exceeded.", dim: true },
  { time: "14:25:12", agent: "SCANNER", agentColor: "#06b6d4", text: "Scanned 42 active contracts. All within stability parameters.", dim: true },
  { time: "14:28:30", agent: "ANALYST", agentColor: "#8b5cf6", text: 'Verdict for WETH/USDC:', badge: "SAFE", badgeColor: "#34d399", extra: "Re-balancing recommended.", dim: true },
];

export default function LandingPage(): React.ReactNode {
  const containerRef = useRef<HTMLDivElement>(null);
  const heroH1Ref = useRef<HTMLHeadingElement>(null);
  const heroSubRef = useRef<HTMLParagraphElement>(null);
  const heroCtaRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  const [stats, setStats] = useState<Stats | null>(null);

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
    }, containerRef);
    return () => ctx.revert();
  }, [stats]);

  return (
    <div ref={containerRef} className="relative" style={{ backgroundImage: "radial-gradient(circle, #3d494c 1px, transparent 1px)", backgroundSize: "24px 24px" }}>

      {/* ═══ HERO ═══ */}
      <section className="relative pt-20 lg:pt-32 pb-16 px-8 lg:px-24 overflow-hidden">
        <div className="flex flex-col lg:flex-row items-center gap-16 max-w-[1400px] mx-auto">
          <div className="flex-1 space-y-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 border font-mono text-xs tracking-widest uppercase" style={{ background: "rgba(76,215,246,0.06)", borderColor: "rgba(76,215,246,0.2)", color: "#4cd7f6" }}>
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#4cd7f6] opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#4cd7f6]" />
              </span>
              Network Status: Sovereign
            </div>
            <h1 ref={heroH1Ref} className="text-6xl md:text-8xl font-black tracking-tighter uppercase leading-none text-[#e1e2e8]">
              Agent <br /> Economy <br /> <span className="text-[#4cd7f6] drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)]">Hub</span>
            </h1>
            <p ref={heroSubRef} className="max-w-xl text-[#bcc9cd] text-lg leading-relaxed font-mono" style={{ opacity: 0 }}>
              3 autonomous AI agents working together: Scanner discovers tokens, Analyst scores risk, Executor manages Uniswap V3 LP positions. All on Base.
            </p>
            <div ref={heroCtaRef} className="flex gap-6" style={{ opacity: 0 }}>
              <Link href="/feed" className="bg-[#06b6d4] px-8 py-4 text-[#003640] font-bold uppercase tracking-widest hover:shadow-[0_8px_20px_-6px_rgba(0,0,0,0.5),_0_4px_8px_-2px_rgba(0,0,0,0.3)] transition-all text-sm">
                Launch Protocol
              </Link>
              <a href="https://github.com/westerq/agentra" target="_blank" rel="noopener noreferrer" className="border border-[#869397] px-8 py-4 font-bold uppercase tracking-widest hover:bg-white/5 transition-all text-sm text-[#bcc9cd]">
                Read Docs
              </a>
            </div>
          </div>
          <div ref={previewRef} className="flex-1 relative w-full max-w-2xl" style={{ opacity: 0 }}>
            <HeroAgents />
          </div>
        </div>
      </section>

      {/* ═══ STATS BAR ═══ */}
      <section className="border-y border-[#3d494c]/40 py-8 overflow-hidden" style={{ background: "rgba(25,28,32,0.7)" }}>
        <div className="max-w-[1400px] mx-auto px-8 flex flex-wrap justify-between gap-12">
          {[
            { label: "Active Units", value: "3 Agents", color: "#4cd7f6" },
            { label: "Capabilities", value: "14 Skills", color: "#e1e2e8" },
            { label: "Protocol Value", value: stats ? `$${(stats.totalScanned * 0.01).toFixed(1)}M TVL` : "$2.4M TVL", color: "#e1e2e8" },
            { label: "Engine Verdicts", value: stats ? `${stats.totalScanned.toLocaleString()} Total` : "1,247 Total", color: "#e1e2e8" },
            { label: "System Health", value: "99.7%", color: "#45dfa4" },
          ].map((s) => (
            <div key={s.label} data-reveal className="flex flex-col" style={{ opacity: 0 }}>
              <span className="text-[#bcc9cd] text-[10px] font-mono uppercase tracking-widest">{s.label}</span>
              <span className="text-3xl font-bold" style={{ color: s.color }}>{s.value}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ═══ LIVE PIPELINE ═══ */}
      <section className="py-20 px-8 lg:px-24">
        <div className="max-w-4xl mx-auto">
          <TiltFrame>
            <PipelineGsap />
          </TiltFrame>
        </div>
      </section>

      {/* ═══ PROTOCOL WORKFLOW ═══ */}
      <section className="py-32 px-8 lg:px-24">
        <div className="text-center mb-20">
          <h2 data-reveal className="text-4xl font-bold tracking-tighter uppercase mb-4 text-[#e1e2e8]" style={{ opacity: 0 }}>Protocol Workflow</h2>
          <p data-reveal className="font-mono text-[#bcc9cd] text-sm tracking-widest" style={{ opacity: 0 }}>AUTONOMOUS_OPERATING_SYSTEM_V1</p>
        </div>
        <div className="relative grid grid-cols-1 md:grid-cols-3 gap-0 max-w-6xl mx-auto">
          {/* connection line removed — slop indicator */}
          {[
            { icon: Radar, title: "Discover", color: "#06b6d4", desc: "Continuous scanning of Base blockchain for new liquidity pairs and emerging trends in the agentic economy." },
            { icon: BarChart3, title: "Analyze", color: "#8b5cf6", desc: "Deep risk scoring including contract audit verification, liquidity depth analysis, and holder distribution." },
            { icon: Terminal, title: "Execute", color: "#34d399", desc: "Automated position management on Uniswap V3, optimizing for yield while mitigating impermanent loss." },
          ].map((step) => (
            <div key={step.title} data-reveal className="p-8 border border-[#3d494c]/30 flex flex-col items-center text-center group transition-all" style={{ background: "rgba(29,32,36,0.7)", backdropFilter: "blur(12px)", opacity: 0 }}>
              <div className="w-16 h-16 rounded-lg flex items-center justify-center mb-8" style={{ background: `${step.color}10` }}>
                <step.icon className="w-7 h-7" style={{ color: step.color }} />
              </div>
              <h3 className="text-xl font-bold mb-4 uppercase text-[#e1e2e8]">{step.title}</h3>
              <p className="text-[#bcc9cd] font-mono text-xs leading-loose">{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ═══ CORE AGENTS ═══ */}
      <section className="py-20 px-8 lg:px-24" style={{ background: "rgba(25,28,32,0.5)" }}>
        <div className="max-w-[1400px] mx-auto">
          <div className="flex justify-between items-end mb-16">
            <div>
              <h2 data-reveal className="text-5xl font-black uppercase tracking-tighter text-[#e1e2e8]" style={{ opacity: 0 }}>Core Agents</h2>
              <p data-reveal className="text-[#bcc9cd] font-mono mt-2" style={{ opacity: 0 }}>Specialized entities programmed for specific on-chain objectives.</p>
            </div>
            <div className="hidden md:block h-px flex-1 mx-12 bg-[#3d494c]" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {[
              {
                tag: "DISCOVERY_UNIT", name: "SCANNER", color: "#06b6d4",
                metrics: [{ k: "Tokens Tracked", v: "12,450+" }, { k: "LPs Monitored", v: "843" }, { k: "Avg. Ping", v: "1.2s" }],
                tags: ["Web3_Stream", "Base_Mempool", "Contract_Radar"], cta: "Access Stream", href: "/feed",
              },
              {
                tag: "RISK_ENGINE", name: "ANALYST", color: "#8b5cf6",
                metrics: [{ k: "Models Loaded", v: "8 AI Engines" }, { k: "Accuracy Rate", v: "94.2%" }, { k: "Safety Ratio", v: "1.88x" }],
                tags: ["LLM_Risk_Score", "Honeypot_Check", "Dev_Wallet_Audit"], cta: "Run Diagnostic", href: "/feed",
              },
              {
                tag: "CAPITAL_MANAGER", name: "EXECUTOR", color: "#34d399",
                metrics: [{ k: "Active Vaults", v: "24 Contracts" }, { k: "Weekly Volume", v: "$4.8M" }, { k: "Success Rate", v: "100%" }],
                tags: ["Uni_V3_Router", "Auto_Compound", "Gas_Optimized"], cta: "Manage LP", href: "/portfolio",
              },
            ].map((a) => (
              <div key={a.name} data-reveal className="p-8 transition-all" style={{ background: "rgba(29,32,36,0.7)", backdropFilter: "blur(12px)", boxShadow: "0 8px 20px -6px rgba(0,0,0,0.5), 0 2px 6px -2px rgba(0,0,0,0.3)", opacity: 0 }}>
                <div className="flex justify-between items-center mb-8">
                  <div className="px-3 py-1 font-mono text-[10px] font-bold" style={{ background: `${a.color}15`, color: a.color }}>{a.tag}</div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#34d399] animate-pulse" />
                    <span className="font-mono text-[10px] text-[#e1e2e8]">LIVE</span>
                  </div>
                </div>
                <h3 className="text-3xl font-bold mb-6 tracking-tighter text-[#e1e2e8]">{a.name}</h3>
                <div className="space-y-4 mb-8">
                  {a.metrics.map((m) => (
                    <div key={m.k} className="flex justify-between text-xs font-mono">
                      <span className="text-[#bcc9cd]">{m.k}</span>
                      <span style={{ color: a.color }}>{m.v}</span>
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2 mb-8">
                  {a.tags.map((t) => (
                    <span key={t} className="px-2 py-1 text-[8px] font-mono uppercase" style={{ background: "rgba(51,53,58,0.8)", color: "#bcc9cd" }}>{t}</span>
                  ))}
                </div>
                <Link href={a.href} className="block w-full py-3 text-center font-mono font-bold uppercase text-xs transition-all hover:bg-white/5 border border-white/[0.08] rounded" style={{ color: a.color }}>
                  {a.cta} &gt;
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ LIVE FEED TERMINAL ═══ */}
      <section className="py-24 px-8 lg:px-24">
        <div data-reveal className="max-w-4xl mx-auto" style={{ opacity: 0 }}>
          <div className="p-3 flex items-center justify-between" style={{ background: "#111318", border: "1px solid rgba(255,255,255,0.06)", borderBottom: "none", borderRadius: "8px 8px 0 0" }}>
            <div className="flex gap-2">
              <div className="w-3 h-3 rounded-full bg-[#ef4444]/40" />
              <div className="w-3 h-3 rounded-full bg-[#f59e0b]/40" />
              <div className="w-3 h-3 rounded-full bg-[#34d399]/40" />
            </div>
            <span className="font-mono text-[10px] text-[#bcc9cd]">AGENT_VERDICTS_LOG_V2.0</span>
            <Activity className="w-3.5 h-3.5 text-[#bcc9cd]" />
          </div>
          <div className="p-6 font-mono text-xs space-y-3 h-80 overflow-y-auto feed-scroll" style={{ background: "#0c0e13", border: "1px solid rgba(255,255,255,0.06)", borderTop: "none", borderRadius: "0 0 8px 8px", boxShadow: "0 12px 24px -8px rgba(0,0,0,0.5), 0 4px 8px -2px rgba(0,0,0,0.3)" }}>
            {FEED_LINES.map((line, i) => (
              <div key={i} className="flex gap-4" style={{ opacity: line.dim ? 0.5 : 1 }}>
                <span className="text-[#bcc9cd] shrink-0">[{line.time}]</span>
                <span className="shrink-0" style={{ color: line.agentColor }}>{line.agent}:</span>
                <span className="text-[#e1e2e8]">
                  {line.text}
                  {line.badge && (
                    <> <span className="px-2 mx-1" style={{ background: `${line.badgeColor}20`, color: line.badgeColor }}>{line.badge}</span> {line.extra}</>
                  )}
                </span>
              </div>
            ))}
            <div className="flex gap-4">
              <span className="text-[#bcc9cd]">[14:30:00]</span>
              <span className="animate-pulse text-[#34d399]">_</span>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ ONCHAIN SKILLS ═══ */}
      <section className="py-32 px-8 lg:px-24">
        <div className="max-w-[1400px] mx-auto">
          <div className="mb-16">
            <h2 data-reveal className="text-5xl font-black uppercase tracking-tighter text-[#e1e2e8]" style={{ opacity: 0 }}>OnchainOS Skills</h2>
            <p data-reveal className="text-[#bcc9cd] font-mono mt-4 max-w-2xl" style={{ opacity: 0 }}>The modular capabilities of Agentra. Each skill can be combined to create complex automated workflows on Base.</p>
          </div>
          <div data-reveal className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-px border border-[#3d494c]/20" style={{ background: "rgba(61,73,76,0.2)", opacity: 0 }}>
            {SKILLS.map((s) => (
              <div key={s.label} className="p-6 flex flex-col items-center justify-center gap-4 group transition-colors" style={{ background: "#111318" }}>
                <s.icon className="w-5 h-5 text-[#4cd7f6] group-hover:scale-110 transition-transform" />
                <span className="font-mono text-[10px] uppercase font-bold tracking-widest text-center text-[#e1e2e8]">{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ CTA ═══ */}
      <section className="py-32 px-8">
        <div data-reveal className="max-w-5xl mx-auto bg-[#06b6d4] relative overflow-hidden group" style={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-gradient-to-r from-[#06b6d4]/80 to-transparent" />
          <div className="relative z-10 p-12 lg:p-20 flex flex-col lg:flex-row items-center justify-between gap-12">
            <div className="space-y-6">
              <h2 className="text-5xl font-black text-[#003640] leading-none uppercase tracking-tighter">Ready to <br /> scale your agents?</h2>
              <p className="text-[#003640]/80 font-mono max-w-md">Connect your wallet to start deploying autonomous agents on Base blockchain today.</p>
            </div>
            <Link href="/agents" className="bg-white text-[#06b6d4] px-10 py-5 font-black uppercase tracking-widest text-xl hover:scale-105 transition-all shadow-[0_16px_32px_-8px_rgba(0,0,0,0.55),_0_8px_16px_-4px_rgba(0,0,0,0.3)]">
              Launch Dashboard
            </Link>
          </div>
        </div>
      </section>

      {/* ═══ FOOTER ═══ */}
      <footer className="w-full flex flex-col md:flex-row justify-between items-center px-12 gap-8 py-12 border-t font-mono text-[10px] uppercase tracking-widest" style={{ background: "#111318", borderColor: "rgba(134,147,151,0.1)" }}>
        <div className="flex flex-col items-center md:items-start gap-4">
          <div className="text-[#4cd7f6] font-bold text-lg tracking-widest">AGENTRA</div>
          <div className="text-[#bcc9cd]">&copy; 2026 AGENTRA. BUILT ON BASE.</div>
        </div>
        <div className="flex gap-12">
          {[
            { l: "GitHub", h: "https://github.com/westerq/agentra" },
            { l: "Docs", h: "#" },
            { l: "Twitter", h: "#" },
            { l: "Status", h: "#" },
          ].map((lk) => (
            <a key={lk.l} href={lk.h} target="_blank" rel="noopener noreferrer" className="text-[#bcc9cd] hover:text-white underline decoration-[#4cd7f6] transition-colors">{lk.l}</a>
          ))}
        </div>
        <div className="flex items-center gap-2 px-3 py-1 border border-[#869397]/20" style={{ background: "#1a1c23" }}>
          <div className="w-2 h-2 rounded-full bg-[#4cd7f6] animate-pulse" />
          <span className="text-[#bcc9cd]">Base Mainnet Connected</span>
        </div>
      </footer>
    </div>
  );
}
