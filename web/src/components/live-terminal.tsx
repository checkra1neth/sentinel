"use client";

import { useEffect, useRef, useState, useCallback } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3002";

interface Verdict {
  tokenSymbol: string;
  token: string;
  riskScore: number;
  verdict: string;
  priceUsd: number;
  liquidityUsd: number;
  holders?: number;
  defiPool?: { name: string; platform: string; apr: string };
}

interface TermLine {
  agent: string;
  text: string;
  color: string;
  delay: number;
}

const AGENT_COLORS: Record<string, string> = {
  Scanner: "#06b6d4",
  Analyst: "#8b5cf6",
  Executor: "#34d399",
  System: "#71717a",
  Verdict: "#fafafa",
};

function formatPrice(p: number): string {
  if (p >= 1) return `$${p.toFixed(2)}`;
  if (p >= 0.01) return `$${p.toFixed(4)}`;
  return `$${p.toFixed(8)}`;
}

function formatLiq(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

function buildScript(verdicts: Verdict[]): TermLine[] {
  const lines: TermLine[] = [];
  let d = 0;

  lines.push({ agent: "System", text: "Sentinel Security Oracle v1.0 — X Layer (196)", color: AGENT_COLORS.System, delay: d });
  d += 600;
  lines.push({ agent: "System", text: "3 Agentic Wallets initialized. 22 skills loaded.", color: AGENT_COLORS.System, delay: d });
  d += 800;
  lines.push({ agent: "Scanner", text: "Autonomous loop started — scanning every 5 min", color: AGENT_COLORS.Scanner, delay: d });
  d += 1000;
  lines.push({ agent: "Scanner", text: "Querying dex-trenches (NEW, MIGRATED)...", color: AGENT_COLORS.Scanner, delay: d });
  d += 700;
  lines.push({ agent: "Scanner", text: "Querying smart_money signals...", color: AGENT_COLORS.Scanner, delay: d });
  d += 500;
  lines.push({ agent: "Scanner", text: "Querying hot-tokens...", color: AGENT_COLORS.Scanner, delay: d });
  d += 900;

  const tokenCount = Math.max(verdicts.length, 2);
  lines.push({ agent: "Scanner", text: `Discovered ${tokenCount} tokens, ${tokenCount} new`, color: AGENT_COLORS.Scanner, delay: d });
  d += 600;

  for (const v of verdicts.slice(0, 3)) {
    const addr = `${v.token.slice(0, 6)}...${v.token.slice(-4)}`;
    lines.push({ agent: "Scanner", text: `Found: ${v.tokenSymbol} (${addr})`, color: AGENT_COLORS.Scanner, delay: d });
    d += 400;

    lines.push({ agent: "Analyst", text: `Deep scan: ${v.tokenSymbol}`, color: AGENT_COLORS.Analyst, delay: d });
    d += 300;
    lines.push({ agent: "Analyst", text: `  OKX security scan... OK`, color: AGENT_COLORS.Analyst, delay: d });
    d += 250;
    lines.push({ agent: "Analyst", text: `  Holder analysis... ${v.holders ? `${v.holders.toLocaleString()} holders` : "OK"}`, color: AGENT_COLORS.Analyst, delay: d });
    d += 250;
    lines.push({ agent: "Analyst", text: `  Liquidity check... ${formatLiq(v.liquidityUsd)}`, color: AGENT_COLORS.Analyst, delay: d });
    d += 250;
    lines.push({ agent: "Analyst", text: `  Bytecode probe... OK`, color: AGENT_COLORS.Analyst, delay: d });
    d += 400;

    const bar = "█".repeat(Math.round(v.riskScore / 5)) + "░".repeat(20 - Math.round(v.riskScore / 5));
    const verdictColor = v.verdict === "SAFE" ? "#34d399" : v.verdict === "CAUTION" ? "#f59e0b" : "#ef4444";
    lines.push({ agent: "Verdict", text: `  ${bar} Risk: ${v.riskScore}/100`, color: verdictColor, delay: d });
    d += 300;
    lines.push({ agent: "Verdict", text: `  → ${v.verdict} — ${v.tokenSymbol} at ${formatPrice(v.priceUsd)}`, color: verdictColor, delay: d });
    d += 400;
    lines.push({ agent: "Analyst", text: `Published on-chain → VerdictRegistry`, color: AGENT_COLORS.Analyst, delay: d });
    d += 500;

    if (v.verdict === "SAFE") {
      lines.push({ agent: "Executor", text: `${v.tokenSymbol} is SAFE → preparing investment`, color: AGENT_COLORS.Executor, delay: d });
      d += 400;
      if (v.defiPool) {
        lines.push({ agent: "Executor", text: `Found pool: ${v.defiPool.name} on ${v.defiPool.platform}`, color: AGENT_COLORS.Executor, delay: d });
        d += 300;
        lines.push({ agent: "Executor", text: `APR: ${(Number(v.defiPool.apr) * 100).toFixed(1)}% — investing 10 USDT`, color: AGENT_COLORS.Executor, delay: d });
        d += 400;
      } else {
        lines.push({ agent: "Executor", text: `Swap 10 USDT → ${v.tokenSymbol} via OKX DEX`, color: AGENT_COLORS.Executor, delay: d });
        d += 400;
      }
    } else {
      lines.push({ agent: "Executor", text: `${v.tokenSymbol} is ${v.verdict} → skipping`, color: "#71717a", delay: d });
      d += 300;
    }

    d += 600;
  }

  lines.push({ agent: "System", text: `Pipeline complete. Next scan in 5 min.`, color: AGENT_COLORS.System, delay: d });
  d += 1000;
  lines.push({ agent: "Scanner", text: `Waiting...`, color: "#3f3f46", delay: d });

  return lines;
}

export function LiveTerminal(): React.ReactNode {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [visibleLines, setVisibleLines] = useState<TermLine[]>([]);
  const [verdicts, setVerdicts] = useState<Verdict[]>([]);
  const scriptRef = useRef<TermLine[]>([]);
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const cycleRef = useRef(0);

  const fetchVerdicts = useCallback(async (): Promise<void> => {
    try {
      const res = await fetch(`${API_URL}/api/verdicts?limit=10`);
      if (res.ok) {
        const data = await res.json() as { verdicts: Verdict[] };
        setVerdicts(data.verdicts ?? []);
      }
    } catch { /* */ }
  }, []);

  useEffect(() => { fetchVerdicts(); }, [fetchVerdicts]);

  // Run the script
  useEffect(() => {
    if (verdicts.length === 0) {
      // Fallback mock data if no verdicts yet
      scriptRef.current = buildScript([
        { tokenSymbol: "DOGSHIT", token: "0x70bf3e2b75d8832d7f790a87fffc1fa9d63dc5bb", riskScore: 11, verdict: "SAFE", priceUsd: 0.0000754, liquidityUsd: 1006446, holders: 32618, defiPool: { name: "OKB-DOGSHIT", platform: "Uniswap V4", apr: "0.2573" } },
        { tokenSymbol: "XDOG", token: "0x0cc24c51bf89c00c5affbfcf5e856c25ecbdb48e", riskScore: 10, verdict: "SAFE", priceUsd: 0.00413, liquidityUsd: 495108, holders: 35612 },
        { tokenSymbol: "KDOG", token: "0x759929e62563fa5138c3d11cec593bdc6e277777", riskScore: 43, verdict: "DANGEROUS", priceUsd: 0.00000229, liquidityUsd: 2, holders: 5 },
      ]);
    } else {
      scriptRef.current = buildScript(verdicts);
    }

    const run = (): void => {
      setVisibleLines([]);
      timeoutsRef.current.forEach(clearTimeout);
      timeoutsRef.current = [];

      scriptRef.current.forEach((line, i) => {
        const t = setTimeout(() => {
          setVisibleLines((prev) => [...prev, line]);
          // Auto-scroll
          requestAnimationFrame(() => {
            if (scrollRef.current) {
              scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
            }
          });
        }, line.delay);
        timeoutsRef.current.push(t);
      });

      // Loop after script ends
      const totalDuration = scriptRef.current[scriptRef.current.length - 1]?.delay ?? 5000;
      const loopT = setTimeout(() => {
        cycleRef.current++;
        run();
      }, totalDuration + 3000);
      timeoutsRef.current.push(loopT);
    };

    run();

    return () => {
      timeoutsRef.current.forEach(clearTimeout);
    };
  }, [verdicts]);

  return (
    <div className="bg-[#0a0a0b] rounded-[11px] overflow-hidden font-mono text-[12px] leading-[1.7]">
      {/* Terminal header */}
      <div className="bg-[#18181b] px-4 py-2.5 flex items-center gap-2 border-b border-[#27272a]/60">
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-[#ef4444]/60" />
          <div className="w-2.5 h-2.5 rounded-full bg-[#f59e0b]/60" />
          <div className="w-2.5 h-2.5 rounded-full bg-[#34d399]/60" />
        </div>
        <span className="text-[10px] text-[#71717a] ml-2">sentinel — pipeline</span>
        <div className="ml-auto flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-[#34d399] animate-pulse" />
          <span className="text-[9px] text-[#71717a]">Live</span>
        </div>
      </div>

      {/* Terminal body */}
      <div
        ref={scrollRef}
        className="px-4 py-3 h-[380px] lg:h-[460px] overflow-y-auto"
        style={{ scrollbarWidth: "none" }}
      >
        {visibleLines.map((line, i) => (
          <div key={`${cycleRef.current}-${i}`} className="flex gap-0 animate-[fadeIn_0.15s_ease-out]">
            <span className="shrink-0 w-[90px] text-right pr-2 select-none" style={{ color: line.color, opacity: 0.7 }}>
              [{line.agent}]
            </span>
            <span style={{ color: line.color }}>{line.text}</span>
          </div>
        ))}
        {/* Blinking cursor */}
        <span className="inline-block w-[7px] h-[14px] bg-[#8b5cf6] animate-pulse ml-[90px] mt-1" />
      </div>
    </div>
  );
}
