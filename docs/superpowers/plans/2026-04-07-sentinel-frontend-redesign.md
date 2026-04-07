# Sentinel Frontend Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite entire Sentinel frontend to institutional analytics quality (Arkham/Nansen/Messari/Glassnode level) — data-dense, content-first, zero decoration.

**Architecture:** Full rewrite of 4 pages (landing, feed, agents, portfolio) and shared components. Replace decorative UI (colored borders, fake sparklines, animated dots, card patterns) with data tables, text-line summaries, and terminal-style logs. Geist font, single accent color, monochrome palette.

**Tech Stack:** Next.js 16, React 19, Tailwind CSS 4, Geist font, viem/wagmi (existing). Remove: gsap, lenis.

**Spec:** `docs/superpowers/specs/2026-04-07-sentinel-frontend-redesign.md`

---

### Task 1: Install Geist font, remove GSAP/Lenis, update globals.css

**Files:**
- Modify: `web/package.json`
- Modify: `web/src/app/layout.tsx`
- Modify: `web/src/app/globals.css`

- [ ] **Step 1: Install geist, remove gsap and lenis**

```bash
cd /Users/pavelmackevic/Projects/agentra/web
npm install geist
npm uninstall gsap lenis
```

- [ ] **Step 2: Rewrite layout.tsx — Geist font, clean nav, remove gradient divider**

Replace entire `web/src/app/layout.tsx` with:

```tsx
import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import { NavLinks } from "../components/nav-links";
import { ConnectButton } from "../components/connect-button";

export const metadata: Metadata = {
  title: "Sentinel | Security Oracle",
  description: "Autonomous security oracle on X Layer. 3 AI agents scan, analyze, and invest.",
};

export default function RootLayout({ children }: { children: React.ReactNode }): React.ReactNode {
  return (
    <html lang="en" className={`dark ${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="bg-[#09090b] text-[#fafafa] font-sans antialiased">
        <nav className="sticky top-0 z-50 bg-[#09090b]/80 backdrop-blur-sm border-b border-white/[0.06]">
          <div className="mx-auto max-w-[1400px] h-12 px-6 flex items-center justify-between">
            <span className="text-sm font-semibold tracking-wide">SENTINEL</span>
            <NavLinks />
            <ConnectButton />
          </div>
        </nav>
        <main>{children}</main>
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Rewrite globals.css — stripped palette**

Replace entire `web/src/app/globals.css` with:

```css
@import "tailwindcss";

@theme inline {
  --font-sans: var(--font-geist-sans);
  --font-mono: var(--font-geist-mono);
  --color-background: #09090b;
  --color-foreground: #fafafa;
}

body {
  background: #09090b;
  color: #fafafa;
}

/* Scrollbar */
.feed-scroll::-webkit-scrollbar { width: 4px; }
.feed-scroll::-webkit-scrollbar-track { background: transparent; }
.feed-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.06); border-radius: 2px; }

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

- [ ] **Step 4: Verify dev server starts**

```bash
cd /Users/pavelmackevic/Projects/agentra/web && npm run dev
```

Expected: Server starts on localhost:3000 with Geist font loaded.

- [ ] **Step 5: Commit**

```bash
cd /Users/pavelmackevic/Projects/agentra/web
git add -A
git commit -m "chore: install geist font, remove gsap/lenis, strip globals.css"
```

---

### Task 2: Clean nav components

**Files:**
- Rewrite: `web/src/components/nav-links.tsx`
- Rewrite: `web/src/components/connect-button.tsx`

- [ ] **Step 1: Rewrite nav-links.tsx — minimal, no decorations**

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/feed", label: "Feed" },
  { href: "/portfolio", label: "Portfolio" },
  { href: "/agents", label: "Agents" },
];

export function NavLinks(): React.ReactNode {
  const pathname = usePathname();

  return (
    <div className="flex items-center gap-1">
      {LINKS.map((link) => {
        const active = pathname === link.href;
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`px-3 py-1 text-xs font-medium transition-colors ${
              active
                ? "text-[#fafafa] bg-white/[0.06] rounded"
                : "text-[#a1a1aa] hover:text-[#fafafa]"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Rewrite connect-button.tsx — minimal**

```tsx
"use client";

import { useAccount, useConnect, useDisconnect } from "wagmi";
import { injected } from "wagmi/connectors";

export function ConnectButton(): React.ReactNode {
  const { address, isConnected } = useAccount();
  const { connect } = useConnect();
  const { disconnect } = useDisconnect();

  if (isConnected && address) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs font-mono text-[#a1a1aa]">
          {address.slice(0, 6)}...{address.slice(-4)}
        </span>
        <button
          onClick={() => disconnect()}
          className="text-xs text-[#a1a1aa] hover:text-[#fafafa] transition-colors cursor-pointer"
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => connect({ connector: injected() })}
      className="text-xs text-[#06b6d4] hover:text-[#fafafa] transition-colors cursor-pointer"
    >
      Connect
    </button>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add web/src/components/nav-links.tsx web/src/components/connect-button.tsx
git commit -m "refactor: clean nav components — minimal, no decorations"
```

---

### Task 3: Delete decorative components

**Files:**
- Delete: `web/src/components/tilt-frame.tsx`
- Delete: `web/src/components/pipeline-gsap.tsx`
- Delete: `web/src/components/hero-agents.tsx`
- Delete: `web/src/components/aurora-bg.tsx`
- Delete: `web/src/components/cursor-glow.tsx`
- Delete: `web/src/components/scan-pulse.tsx`
- Delete: `web/src/components/inline-stats.tsx`

- [ ] **Step 1: Delete all decorative component files**

```bash
cd /Users/pavelmackevic/Projects/agentra/web/src/components
rm -f tilt-frame.tsx pipeline-gsap.tsx hero-agents.tsx aurora-bg.tsx cursor-glow.tsx scan-pulse.tsx inline-stats.tsx
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "chore: delete decorative components (tilt-frame, pipeline, hero, aurora, glow, pulse, inline-stats)"
```

---

### Task 4: Rewrite Landing Page

**Files:**
- Rewrite: `web/src/app/page.tsx`

- [ ] **Step 1: Rewrite page.tsx — data-first landing**

```tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3002";

interface Stats {
  totalScanned: number;
  totalSafe: number;
  totalDangerous: number;
}

interface Verdict {
  token: string;
  tokenSymbol: string;
  riskScore: number;
  verdict: "SAFE" | "CAUTION" | "DANGEROUS";
  priceUsd: number;
  liquidityUsd: number;
  timestamp: number;
}

const VERDICT_COLOR: Record<string, string> = {
  SAFE: "#34d399",
  CAUTION: "#f59e0b",
  DANGEROUS: "#ef4444",
};

function formatUsd(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
  if (v >= 1) return `$${v.toFixed(2)}`;
  return `$${v.toFixed(6)}`;
}

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

export default function LandingPage(): React.ReactNode {
  const [stats, setStats] = useState<Stats | null>(null);
  const [verdicts, setVerdicts] = useState<Verdict[]>([]);

  const fetchData = useCallback(async (): Promise<void> => {
    try {
      const [statsRes, verdictsRes] = await Promise.all([
        fetch(`${API_URL}/api/stats`),
        fetch(`${API_URL}/api/verdicts?limit=5`),
      ]);
      if (statsRes.ok) {
        const d = await statsRes.json();
        setStats((d.verdicts ?? d) as Stats);
      }
      if (verdictsRes.ok) {
        const d = await verdictsRes.json();
        setVerdicts((d.verdicts ?? []) as Verdict[]);
      }
    } catch { /* server unavailable */ }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <div className="mx-auto max-w-[1400px] px-6 lg:px-10">
      {/* Hero */}
      <section className="py-24 lg:py-32 flex flex-col lg:flex-row items-start justify-between gap-16">
        <div className="flex-1 max-w-xl">
          <h1 className="text-4xl lg:text-5xl font-bold tracking-tight mb-4">
            Sentinel
          </h1>
          <p className="text-[#a1a1aa] text-lg leading-relaxed mb-8">
            Autonomous security oracle on X Layer. Three AI agents work in sequence: Scanner discovers tokens, Analyst scores risk, Executor invests in what&apos;s safe.
          </p>
          <Link
            href="/feed"
            className="inline-block text-sm font-medium text-[#09090b] bg-[#06b6d4] px-6 py-2.5 rounded hover:opacity-90 transition-opacity"
          >
            Open Dashboard
          </Link>
        </div>
        <div className="font-mono text-right">
          <div className="text-5xl font-bold tabular-nums">
            {stats?.totalScanned?.toLocaleString() ?? "—"}
          </div>
          <div className="text-sm text-[#a1a1aa] mt-1">tokens scanned</div>
        </div>
      </section>

      {/* Metrics line */}
      <div className="border-y border-white/[0.06] py-4 text-sm text-[#a1a1aa] font-mono flex flex-wrap gap-x-6 gap-y-1">
        <span>{stats?.totalScanned ?? 0} scanned</span>
        <span className="text-[#34d399]">{stats?.totalSafe ?? 0} safe</span>
        <span className="text-[#ef4444]">{stats?.totalDangerous ?? 0} threats</span>
        <span>3 autonomous agents</span>
        <span>X Layer (chain 196)</span>
      </div>

      {/* How it works + live verdicts */}
      <section className="py-16 lg:py-24 flex flex-col lg:flex-row gap-16">
        <div className="flex-1 space-y-8 text-sm text-[#a1a1aa] leading-relaxed">
          <div>
            <h3 className="text-[#fafafa] font-medium mb-1">Scanner</h3>
            <p>Monitors X Layer for new liquidity pairs every 5 minutes. Sources include dex-trenches, smart money signals, and trending tokens.</p>
          </div>
          <div>
            <h3 className="text-[#fafafa] font-medium mb-1">Analyst</h3>
            <p>Deep 7-signal risk scan: honeypot detection, rug history, tax analysis, holder concentration, liquidity depth, price volatility, community size. Publishes verdicts on-chain.</p>
          </div>
          <div>
            <h3 className="text-[#fafafa] font-medium mb-1">Executor</h3>
            <p>Invests in tokens rated SAFE via Uniswap V3 LP positions. Risk-based range sizing: lower risk means wider exposure. Tracks all positions and P&L.</p>
          </div>
        </div>

        {/* Live verdicts table */}
        <div className="flex-1">
          <h3 className="text-xs font-medium text-[#a1a1aa] uppercase tracking-wider mb-3">Recent Verdicts</h3>
          {verdicts.length === 0 ? (
            <p className="text-sm text-[#52525b]">No verdicts yet.</p>
          ) : (
            <table className="w-full text-xs font-mono">
              <thead>
                <tr className="text-[#52525b] text-left">
                  <th className="pb-2 font-medium">Token</th>
                  <th className="pb-2 font-medium">Verdict</th>
                  <th className="pb-2 font-medium text-right">Risk</th>
                  <th className="pb-2 font-medium text-right">Price</th>
                  <th className="pb-2 font-medium text-right">Liq</th>
                  <th className="pb-2 font-medium text-right">Age</th>
                </tr>
              </thead>
              <tbody>
                {verdicts.map((v) => (
                  <tr key={`${v.token}-${v.timestamp}`} className="border-t border-white/[0.04]">
                    <td className="py-2 text-[#fafafa]">{v.tokenSymbol}</td>
                    <td className="py-2" style={{ color: VERDICT_COLOR[v.verdict] }}>{v.verdict}</td>
                    <td className="py-2 text-right text-[#a1a1aa]">{v.riskScore}</td>
                    <td className="py-2 text-right text-[#a1a1aa]">{formatUsd(v.priceUsd)}</td>
                    <td className="py-2 text-right text-[#a1a1aa]">{formatUsd(v.liquidityUsd)}</td>
                    <td className="py-2 text-right text-[#52525b]">{timeAgo(v.timestamp)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/[0.06] py-6 flex items-center justify-between text-xs text-[#52525b] font-mono">
        <span>Sentinel &copy; 2026</span>
        <div className="flex gap-6">
          <a href="https://github.com/westerq/agentra" target="_blank" rel="noopener noreferrer" className="hover:text-[#a1a1aa] transition-colors">GitHub</a>
          <a href="https://www.okx.com/xlayer/explorer" target="_blank" rel="noopener noreferrer" className="hover:text-[#a1a1aa] transition-colors">Explorer</a>
        </div>
      </footer>
    </div>
  );
}
```

- [ ] **Step 2: Verify landing renders**

Open http://localhost:3000 — should show clean hero with live stats, metrics line, how-it-works text, verdicts table, minimal footer.

- [ ] **Step 3: Commit**

```bash
git add web/src/app/page.tsx
git commit -m "feat: rewrite landing page — data-first, zero decoration"
```

---

### Task 5: Rewrite scan-input and agent-panel as minimal components

**Files:**
- Rewrite: `web/src/components/scan-input.tsx`
- Rewrite: `web/src/components/agent-panel.tsx`

- [ ] **Step 1: Rewrite scan-input.tsx — field + button only**

```tsx
"use client";

import { useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002";

interface ScanInputProps {
  onVerdictReceived: (v: Record<string, unknown>) => void;
}

export function ScanInput({ onVerdictReceived }: ScanInputProps): React.ReactNode {
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleScan = async (): Promise<void> => {
    if (!address || loading) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_URL}/api/scan/${address}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Caller": "0x8Ce01CF638681e12AFfD10e2feb1E7E3C50b7509",
        },
      });
      if (!res.ok) throw new Error(`Scan failed: ${res.status}`);
      const data = (await res.json()) as { verdict?: Record<string, unknown> };
      onVerdictReceived(data.verdict ?? data);
      setAddress("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Scan failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mb-6">
      <div className="flex gap-2">
        <input
          type="text"
          value={address}
          onChange={(e) => { setAddress(e.target.value); setError(""); }}
          onKeyDown={(e) => { if (e.key === "Enter") handleScan(); }}
          placeholder="Token address..."
          className="flex-1 bg-transparent border border-white/[0.06] rounded px-3 py-2 text-sm font-mono text-[#fafafa] placeholder:text-[#52525b] outline-none focus:border-[#06b6d4]/40 transition-colors"
        />
        <button
          onClick={handleScan}
          disabled={!address || loading}
          className="px-4 py-2 text-sm font-medium bg-[#06b6d4] text-[#09090b] rounded hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed transition-opacity cursor-pointer"
        >
          {loading ? "..." : "Scan"}
        </button>
      </div>
      {error && <p className="mt-1 text-xs text-[#ef4444]">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 2: Rewrite agent-panel.tsx — single text line**

```tsx
"use client";

import { useState, useEffect, useCallback } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3002";

interface Agent {
  name: string;
  walletAddress: string;
}

function truncAddr(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export function AgentPanel(): React.ReactNode {
  const [agents, setAgents] = useState<Agent[]>([]);

  const fetchAgents = useCallback(async (): Promise<void> => {
    try {
      const res = await fetch(`${API_URL}/api/agents`);
      if (res.ok) {
        const data = (await res.json()) as { agents?: Agent[] };
        setAgents(data.agents ?? []);
      }
    } catch { /* */ }
  }, []);

  useEffect(() => {
    fetchAgents();
    const iv = setInterval(fetchAgents, 10_000);
    return () => clearInterval(iv);
  }, [fetchAgents]);

  if (agents.length === 0) return null;

  return (
    <div className="mb-6 text-xs font-mono text-[#52525b] flex flex-wrap gap-x-4 gap-y-1">
      {agents.map((a) => (
        <span key={a.name}>
          <span className="text-[#a1a1aa]">{a.name}</span>{" "}
          {truncAddr(a.walletAddress)}
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#34d399] ml-1.5 align-middle" />
        </span>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add web/src/components/scan-input.tsx web/src/components/agent-panel.tsx
git commit -m "refactor: scan-input and agent-panel — minimal text-line components"
```

---

### Task 6: Rewrite Feed Page

**Files:**
- Rewrite: `web/src/app/feed/page.tsx`
- Rewrite: `web/src/components/verdict-row.tsx` → delete, inline as table row
- Rewrite: `web/src/components/live-feed.tsx`

- [ ] **Step 1: Rewrite live-feed.tsx — terminal text log**

```tsx
"use client";

import { useAgentEvents } from "../lib/ws";

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString("en-US", { hour12: false });
}

export function LiveFeed(): React.ReactNode {
  const { events, connected } = useAgentEvents();

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-[#52525b] uppercase tracking-wider">Activity</span>
        <span className="text-xs font-mono text-[#52525b]">
          {connected ? "connected" : "disconnected"}
        </span>
      </div>
      <div className="max-h-60 overflow-y-auto feed-scroll font-mono text-xs text-[#52525b] space-y-0.5">
        {events.length === 0 && <p>Waiting for agent events...</p>}
        {[...events].reverse().slice(0, 50).map((evt, i) => (
          <div key={`${evt.timestamp}-${i}`}>
            <span className="text-[#a1a1aa]/40">{formatTime(evt.timestamp)}</span>{" "}
            <span className="text-[#a1a1aa]">{evt.agent}</span>{" "}
            {evt.message}
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Delete verdict-row.tsx**

```bash
rm -f /Users/pavelmackevic/Projects/agentra/web/src/components/verdict-row.tsx
```

- [ ] **Step 3: Rewrite feed/page.tsx — data table layout**

```tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { ScanInput } from "../../components/scan-input";
import { AgentPanel } from "../../components/agent-panel";
import { LiveFeed } from "../../components/live-feed";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3002";

interface Verdict {
  token: string;
  tokenName: string;
  tokenSymbol: string;
  riskScore: number;
  verdict: "SAFE" | "CAUTION" | "DANGEROUS";
  priceUsd: number;
  marketCap: number;
  liquidityUsd: number;
  buyTax: number;
  sellTax: number;
  holderConcentration: number;
  risks: string[];
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
}

const VC: Record<string, string> = { SAFE: "#34d399", CAUTION: "#f59e0b", DANGEROUS: "#ef4444" };

function fmt(v: number): string {
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(1)}K`;
  if (v >= 1) return `$${v.toFixed(2)}`;
  return `$${v.toFixed(6)}`;
}

function ago(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  return `${Math.floor(s / 3600)}h`;
}

export default function FeedPage(): React.ReactNode {
  const [verdicts, setVerdicts] = useState<Verdict[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const fetchData = useCallback(async (): Promise<void> => {
    try {
      const [vRes, sRes] = await Promise.all([
        fetch(`${API_URL}/api/verdicts?limit=30`),
        fetch(`${API_URL}/api/stats`),
      ]);
      if (vRes.ok) {
        const d = await vRes.json();
        setVerdicts((d.verdicts ?? []) as Verdict[]);
      }
      if (sRes.ok) {
        const d = await sRes.json();
        setStats((d.verdicts ?? d) as Stats);
      }
    } catch { /* */ }
  }, []);

  useEffect(() => {
    fetchData();
    const iv = setInterval(fetchData, 10_000);
    return () => clearInterval(iv);
  }, [fetchData]);

  const handleVerdict = useCallback((v: Record<string, unknown>): void => {
    setVerdicts((prev) => [v as unknown as Verdict, ...prev]);
  }, []);

  const toggleRow = (key: string): void => {
    setExpanded((prev) => (prev === key ? null : key));
  };

  return (
    <div className="mx-auto max-w-[1400px] px-6 lg:px-10 py-8">
      <ScanInput onVerdictReceived={handleVerdict} />

      {/* Stats line */}
      <div className="mb-4 text-xs font-mono text-[#52525b] flex flex-wrap gap-x-4 gap-y-1">
        <span>Scanned <span className="text-[#a1a1aa]">{stats?.totalScanned ?? 0}</span></span>
        <span>Safe <span className="text-[#34d399]">{stats?.totalSafe ?? 0}</span></span>
        <span>Threats <span className="text-[#ef4444]">{stats?.totalDangerous ?? 0}</span></span>
        <span>LP <span className="text-[#a1a1aa]">{stats?.totalLpInvested ?? "$0"}</span></span>
      </div>

      <AgentPanel />

      {/* Threat Feed table */}
      <div className="mb-10">
        <h2 className="text-xs text-[#52525b] uppercase tracking-wider mb-3">Threat Feed</h2>
        {verdicts.length === 0 ? (
          <p className="text-sm text-[#52525b] py-8">No verdicts yet. Scan a token or wait for the autonomous scanner.</p>
        ) : (
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="text-[#52525b] text-left border-b border-white/[0.06]">
                <th className="pb-2 font-medium">Verdict</th>
                <th className="pb-2 font-medium">Token</th>
                <th className="pb-2 font-medium text-right">Risk</th>
                <th className="pb-2 font-medium text-right hidden sm:table-cell">Price</th>
                <th className="pb-2 font-medium text-right hidden md:table-cell">MCap</th>
                <th className="pb-2 font-medium text-right hidden md:table-cell">Liq</th>
                <th className="pb-2 font-medium text-right hidden lg:table-cell">Tax</th>
                <th className="pb-2 font-medium text-right">Age</th>
              </tr>
            </thead>
            <tbody>
              {verdicts.map((v) => {
                const key = `${v.token}-${v.timestamp}`;
                const isExpanded = expanded === key;
                return (
                  <tr
                    key={key}
                    className="border-b border-white/[0.03] hover:bg-white/[0.02] cursor-pointer transition-colors"
                    onClick={() => toggleRow(key)}
                  >
                    <td className="py-2 font-medium" style={{ color: VC[v.verdict] }}>{v.verdict}</td>
                    <td className="py-2 text-[#fafafa]">{v.tokenSymbol}</td>
                    <td className="py-2 text-right text-[#a1a1aa]">{v.riskScore}</td>
                    <td className="py-2 text-right text-[#a1a1aa] hidden sm:table-cell">{fmt(v.priceUsd)}</td>
                    <td className="py-2 text-right text-[#a1a1aa] hidden md:table-cell">{fmt(v.marketCap)}</td>
                    <td className="py-2 text-right text-[#a1a1aa] hidden md:table-cell">{fmt(v.liquidityUsd)}</td>
                    <td className="py-2 text-right text-[#a1a1aa] hidden lg:table-cell">{v.buyTax}/{v.sellTax}%</td>
                    <td className="py-2 text-right text-[#52525b]">{ago(v.timestamp)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <LiveFeed />
    </div>
  );
}
```

Note: Row expansion (click to show details) is handled by state but the expanded detail panel is omitted for V1 — the table itself provides all key data. Can be added as a follow-up.

- [ ] **Step 4: Verify feed page renders with API data**

Open http://localhost:3000/feed — should show scan input, stats line, agent line, data table, activity log.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: rewrite feed page — data table layout, terminal activity log"
```

---

### Task 7: Rewrite Agents Page

**Files:**
- Rewrite: `web/src/app/agents/page.tsx`

- [ ] **Step 1: Rewrite agents/page.tsx — horizontal sections + event table**

```tsx
"use client";

import { useState, useEffect, useCallback } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3002";

interface Agent { id: string; name: string; walletAddress: string; usdtBalance: string; }
interface Stats { totalScanned: number; totalSafe: number; totalCaution: number; totalDangerous: number; }
interface EventStats { totalEvents: number; byAgent: Record<string, number>; }
interface AgentEvent { timestamp: number; agent: string; type: string; message: string; txHash?: string; }

const ROLE_META: Record<string, { role: string; skills: string[] }> = {
  Scanner: { role: "Token Discovery", skills: ["dex-trenches", "dex-signal", "dex-token"] },
  Analyst: { role: "Security Analysis", skills: ["security", "dex-token", "dex-trenches", "onchain-gateway"] },
  Executor: { role: "LP Investment", skills: ["defi-invest", "defi-portfolio", "dex-swap", "liquidity-planner"] },
};

const TYPE_COLOR: Record<string, string> = { verdict: "#34d399", "new-token": "#06b6d4", invest: "#34d399", error: "#ef4444" };

function truncAddr(a: string): string { return `${a.slice(0, 6)}...${a.slice(-4)}`; }
function fmtTime(ts: number): string { return new Date(ts).toLocaleTimeString("en-US", { hour12: false }); }

export default function AgentsPage(): React.ReactNode {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [eventStats, setEventStats] = useState<EventStats | null>(null);
  const [events, setEvents] = useState<AgentEvent[]>([]);

  const fetchData = useCallback(async (): Promise<void> => {
    try {
      const [aR, sR, eR] = await Promise.all([
        fetch(`${API_URL}/api/agents`),
        fetch(`${API_URL}/api/stats`),
        fetch(`${API_URL}/api/events/history?limit=50`),
      ]);
      if (aR.ok) { const d = await aR.json(); setAgents((d as { agents: Agent[] }).agents ?? []); }
      if (sR.ok) { const d = await sR.json(); setStats((d as { verdicts: Stats }).verdicts ?? null); setEventStats((d as { events: EventStats }).events ?? null); }
      if (eR.ok) { const d = await eR.json(); setEvents((d as { events: AgentEvent[] }).events ?? []); }
    } catch { /* */ }
  }, []);

  useEffect(() => { fetchData(); const iv = setInterval(fetchData, 10_000); return () => clearInterval(iv); }, [fetchData]);

  return (
    <div className="mx-auto max-w-[1400px] px-6 lg:px-10 py-8">
      <h1 className="text-xl font-bold tracking-tight mb-6">Agents</h1>

      {/* Stats line */}
      <div className="mb-6 text-xs font-mono text-[#52525b] flex flex-wrap gap-x-4 gap-y-1">
        <span>Scanned <span className="text-[#a1a1aa]">{stats?.totalScanned ?? 0}</span></span>
        <span>Safe <span className="text-[#34d399]">{stats?.totalSafe ?? 0}</span></span>
        <span>Caution <span className="text-[#f59e0b]">{stats?.totalCaution ?? 0}</span></span>
        <span>Dangerous <span className="text-[#ef4444]">{stats?.totalDangerous ?? 0}</span></span>
        <span>Events <span className="text-[#a1a1aa]">{eventStats?.totalEvents ?? 0}</span></span>
      </div>

      {/* Agent sections */}
      <div className="space-y-1 mb-10">
        {agents.map((agent) => {
          const meta = ROLE_META[agent.name] ?? ROLE_META.Scanner;
          const agentEvents = events.filter((e) => e.agent === agent.name).slice(0, 3);
          const evtCount = eventStats?.byAgent[agent.name] ?? 0;

          return (
            <div key={agent.id} className="border border-white/[0.06] rounded px-5 py-4">
              {/* Header line */}
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm font-mono mb-2">
                <span className="font-medium text-[#fafafa]">{agent.name.toUpperCase()}</span>
                <span className="text-[#52525b]">{meta.role}</span>
                <a
                  href={`https://www.oklink.com/xlayer/address/${agent.walletAddress}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#52525b] hover:text-[#a1a1aa] transition-colors"
                >
                  {truncAddr(agent.walletAddress)}
                </a>
                <span className="text-[#a1a1aa]">{Number(agent.usdtBalance).toFixed(2)} USDT</span>
                <span className="text-[#52525b] ml-auto">{evtCount} events</span>
              </div>

              {/* Skills */}
              <div className="text-xs font-mono text-[#52525b] mb-2">
                {meta.skills.join(" · ")}
              </div>

              {/* Recent events */}
              {agentEvents.length > 0 && (
                <div className="text-xs font-mono text-[#52525b] space-y-0.5">
                  {agentEvents.map((evt, i) => (
                    <div key={`${evt.timestamp}-${i}`}>
                      <span className="text-[#a1a1aa]/40">{fmtTime(evt.timestamp)}</span>{" "}
                      {evt.message}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Event Log table */}
      <h2 className="text-xs text-[#52525b] uppercase tracking-wider mb-3">Event Log</h2>
      <div className="max-h-96 overflow-y-auto feed-scroll">
        <table className="w-full text-xs font-mono">
          <thead>
            <tr className="text-[#52525b] text-left border-b border-white/[0.06]">
              <th className="pb-2 font-medium w-20">Type</th>
              <th className="pb-2 font-medium w-20">Time</th>
              <th className="pb-2 font-medium w-20">Agent</th>
              <th className="pb-2 font-medium">Message</th>
            </tr>
          </thead>
          <tbody>
            {events.length === 0 && (
              <tr><td colSpan={4} className="py-6 text-[#52525b]">Waiting for agent events...</td></tr>
            )}
            {[...events].reverse().slice(0, 50).map((evt, i) => (
              <tr key={`${evt.timestamp}-${i}`} className="border-b border-white/[0.03]">
                <td className="py-1.5" style={{ color: TYPE_COLOR[evt.type] ?? "#a1a1aa" }}>{evt.type.toUpperCase()}</td>
                <td className="py-1.5 text-[#52525b]">{fmtTime(evt.timestamp)}</td>
                <td className="py-1.5 text-[#a1a1aa]">{evt.agent}</td>
                <td className="py-1.5 text-[#52525b]">{evt.message}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify agents page**

Open http://localhost:3000/agents — should show stats line, 3 agent sections, event log table.

- [ ] **Step 3: Commit**

```bash
git add web/src/app/agents/page.tsx
git commit -m "feat: rewrite agents page — horizontal sections, event log table"
```

---

### Task 8: Rewrite Portfolio Page

**Files:**
- Rewrite: `web/src/app/portfolio/page.tsx`

- [ ] **Step 1: Rewrite portfolio/page.tsx — positions table**

```tsx
"use client";

import { useState, useEffect, useCallback } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3002";

interface LpPosition {
  token: string;
  tokenSymbol: string;
  poolName: string;
  platformName: string;
  amountInvested: string;
  apr: string;
  tvl: string;
  range: number;
  timestamp: number;
}

interface Portfolio {
  positions: LpPosition[];
  totalInvested: number;
  totalPositions: number;
  avgApr: number;
  executorAddress: string;
}

function fmt(v: number): string {
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(1)}K`;
  return `$${v.toFixed(2)}`;
}

function ago(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

function truncAddr(a: string): string { return `${a.slice(0, 6)}...${a.slice(-4)}`; }

export default function PortfolioPage(): React.ReactNode {
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);

  const fetchData = useCallback(async (): Promise<void> => {
    try {
      const res = await fetch(`${API_URL}/api/portfolio`);
      if (res.ok) setPortfolio(await res.json() as Portfolio);
    } catch { /* */ }
  }, []);

  useEffect(() => {
    fetchData();
    const iv = setInterval(fetchData, 15_000);
    return () => clearInterval(iv);
  }, [fetchData]);

  return (
    <div className="mx-auto max-w-[1400px] px-6 lg:px-10 py-8">
      <h1 className="text-xl font-bold tracking-tight mb-6">Portfolio</h1>

      {/* Summary line */}
      <div className="mb-6 text-xs font-mono text-[#52525b] flex flex-wrap gap-x-4 gap-y-1">
        <span>Invested <span className="text-[#a1a1aa]">{fmt(portfolio?.totalInvested ?? 0)}</span></span>
        <span>Positions <span className="text-[#a1a1aa]">{portfolio?.totalPositions ?? 0}</span></span>
        <span>Avg APR <span className="text-[#a1a1aa]">{(portfolio?.avgApr ?? 0).toFixed(1)}%</span></span>
        {portfolio?.executorAddress && (
          <span>
            Executor{" "}
            <a
              href={`https://www.oklink.com/xlayer/address/${portfolio.executorAddress}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#52525b] hover:text-[#a1a1aa] transition-colors"
            >
              {truncAddr(portfolio.executorAddress)}
            </a>
          </span>
        )}
      </div>

      {/* Positions table */}
      {!portfolio || portfolio.positions.length === 0 ? (
        <p className="text-sm text-[#52525b] py-8">
          No positions yet. Executor invests in tokens rated SAFE.
        </p>
      ) : (
        <table className="w-full text-xs font-mono">
          <thead>
            <tr className="text-[#52525b] text-left border-b border-white/[0.06]">
              <th className="pb-2 font-medium">Token</th>
              <th className="pb-2 font-medium">Pool</th>
              <th className="pb-2 font-medium text-right">Invested</th>
              <th className="pb-2 font-medium text-right">APR</th>
              <th className="pb-2 font-medium text-right hidden sm:table-cell">TVL</th>
              <th className="pb-2 font-medium text-right hidden sm:table-cell">Range</th>
              <th className="pb-2 font-medium text-right">Age</th>
            </tr>
          </thead>
          <tbody>
            {portfolio.positions.map((p, i) => (
              <tr key={`${p.token}-${i}`} className="border-b border-white/[0.03]">
                <td className="py-2 text-[#fafafa]">{p.tokenSymbol}</td>
                <td className="py-2 text-[#a1a1aa]">{p.poolName}</td>
                <td className="py-2 text-right text-[#a1a1aa]">{fmt(Number(p.amountInvested))}</td>
                <td className="py-2 text-right text-[#34d399]">{(Number(p.apr) * 100).toFixed(1)}%</td>
                <td className="py-2 text-right text-[#a1a1aa] hidden sm:table-cell">{fmt(Number(p.tvl))}</td>
                <td className="py-2 text-right text-[#a1a1aa] hidden sm:table-cell">±{p.range}%</td>
                <td className="py-2 text-right text-[#52525b]">{ago(p.timestamp)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify portfolio page**

Open http://localhost:3000/portfolio — should show summary line and positions table (or empty state).

- [ ] **Step 3: Commit**

```bash
git add web/src/app/portfolio/page.tsx
git commit -m "feat: rewrite portfolio page — positions table, summary line"
```

---

### Task 9: Final cleanup and verification

**Files:**
- Verify: all pages render with backend running
- Clean: unused imports, dead CSS

- [ ] **Step 1: Check for broken imports referencing deleted files**

```bash
cd /Users/pavelmackevic/Projects/agentra/web
grep -r "tilt-frame\|pipeline-gsap\|hero-agents\|aurora-bg\|cursor-glow\|scan-pulse\|inline-stats\|verdict-row\|gsap\|lenis\|ScrollTrigger\|SplitText" src/ --include="*.tsx" --include="*.ts" -l
```

Expected: no results. If any files reference deleted components, fix the imports.

- [ ] **Step 2: Verify all pages render**

1. http://localhost:3000 — landing with live stats
2. http://localhost:3000/feed — scan input, stats, table, activity
3. http://localhost:3000/agents — agent sections, event log
4. http://localhost:3000/portfolio — positions table

- [ ] **Step 3: Verify no AI slop patterns remain**

Check all pages for: colored accent borders, fake sparklines, animated ping dots, cards-with-icons, gradient backgrounds. None should exist.

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "chore: final cleanup — verify all pages, remove dead imports"
```
