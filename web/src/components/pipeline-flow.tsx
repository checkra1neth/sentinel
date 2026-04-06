"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import gsap from "gsap";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3002";

interface Verdict {
  tokenSymbol: string;
  verdict: "SAFE" | "CAUTION" | "DANGEROUS";
  riskScore: number;
  token: string;
}

const VERDICT_COLORS: Record<string, string> = {
  SAFE: "#34d399",
  CAUTION: "#f59e0b",
  DANGEROUS: "#ef4444",
};

const NODE_COLORS = {
  Scanner: "#22d3ee",
  Analyst: "#6366f1",
  Executor: "#34d399",
};

interface Packet {
  id: string;
  symbol: string;
  verdict?: "SAFE" | "CAUTION" | "DANGEROUS";
  phase: number; // 0=discovered, 1=analyzing, 2=verdict, 3=investing, 4=done
}

export function PipelineFlow(): React.ReactNode {
  const svgRef = useRef<SVGSVGElement>(null);
  const packetsRef = useRef<Packet[]>([]);
  const [packets, setPackets] = useState<Packet[]>([]);
  const [verdicts, setVerdicts] = useState<Verdict[]>([]);
  const idCounter = useRef(0);

  // Fetch recent verdicts for realistic data
  const fetchVerdicts = useCallback(async (): Promise<void> => {
    try {
      const res = await fetch(`${API_URL}/api/verdicts?limit=20`);
      if (res.ok) {
        const data = await res.json() as { verdicts: Verdict[] };
        setVerdicts(data.verdicts ?? []);
      }
    } catch { /* */ }
  }, []);

  useEffect(() => { fetchVerdicts(); }, [fetchVerdicts]);

  // Spawn packets from real verdicts
  useEffect(() => {
    if (verdicts.length === 0) return;

    let idx = 0;
    const spawn = (): void => {
      const v = verdicts[idx % verdicts.length];
      idx++;
      const id = `pkt-${idCounter.current++}`;
      const packet: Packet = { id, symbol: v.tokenSymbol, phase: 0 };
      packetsRef.current = [...packetsRef.current, packet];
      setPackets([...packetsRef.current]);

      // Animate through pipeline phases
      const advance = (phase: number, delay: number): void => {
        setTimeout(() => {
          const p = packetsRef.current.find((x) => x.id === id);
          if (!p) return;
          p.phase = phase;
          if (phase === 2) p.verdict = v.verdict;
          setPackets([...packetsRef.current]);

          // Animate the DOM element
          const el = document.getElementById(id);
          if (el) {
            gsap.fromTo(el,
              { scale: 1.3, opacity: 0.5 },
              { scale: 1, opacity: 1, duration: 0.3, ease: "power2.out" }
            );
          }
        }, delay);
      };

      advance(1, 800);  // → Analyst
      advance(2, 2200); // → Verdict
      advance(3, 3200); // → Executor (if SAFE)
      advance(4, 4500); // → Done (remove)

      // Clean up
      setTimeout(() => {
        packetsRef.current = packetsRef.current.filter((x) => x.id !== id);
        setPackets([...packetsRef.current]);
      }, 5000);
    };

    spawn();
    const interval = setInterval(spawn, 2500);
    return () => clearInterval(interval);
  }, [verdicts]);

  // Node positions (SVG coordinates)
  const nodes = [
    { x: 80, y: 100, label: "Scanner", sub: "Discover", color: NODE_COLORS.Scanner },
    { x: 300, y: 100, label: "Analyst", sub: "Analyze", color: NODE_COLORS.Analyst },
    { x: 520, y: 100, label: "Executor", sub: "Invest", color: NODE_COLORS.Executor },
  ];

  const getPacketX = (phase: number): number => {
    if (phase === 0) return 80;
    if (phase === 1) return 190;
    if (phase === 2) return 300;
    if (phase === 3) return 410;
    return 520;
  };

  return (
    <div className="w-full max-w-[620px] mx-auto">
      <svg ref={svgRef} viewBox="0 0 600 200" className="w-full" style={{ overflow: "visible" }}>
        {/* Connection lines */}
        <line x1={110} y1={100} x2={270} y2={100} stroke="#1a1d24" strokeWidth="1" strokeDasharray="4 4" />
        <line x1={330} y1={100} x2={490} y2={100} stroke="#1a1d24" strokeWidth="1" strokeDasharray="4 4" />

        {/* Arrow indicators */}
        <polygon points="265,96 275,100 265,104" fill="#1a1d24" />
        <polygon points="485,96 495,100 485,104" fill="#1a1d24" />

        {/* VerdictRegistry line (from Analyst down) */}
        <line x1={300} y1={130} x2={300} y2={170} stroke="#1a1d24" strokeWidth="1" strokeDasharray="3 3" />
        <rect x={245} y={170} width={110} height={22} rx={4} fill="none" stroke="#1a1d24" strokeWidth="0.5" />
        <text x={300} y={184} textAnchor="middle" fill="#7a7f8a" fontSize="8" opacity="0.4" fontFamily="monospace">VerdictRegistry</text>

        {/* Nodes */}
        {nodes.map((node) => (
          <g key={node.label}>
            {/* Glow */}
            <circle cx={node.x} cy={node.y} r={28} fill={node.color} opacity={0.04} />
            {/* Border */}
            <circle cx={node.x} cy={node.y} r={22} fill="none" stroke={node.color} strokeWidth="1" opacity={0.3} />
            {/* Inner */}
            <circle cx={node.x} cy={node.y} r={3} fill={node.color} opacity={0.6} />
            {/* Label */}
            <text x={node.x} y={node.y - 32} textAnchor="middle" fill={node.color} fontSize="10" fontWeight="600" letterSpacing="0.1em">
              {node.label.toUpperCase()}
            </text>
            <text x={node.x} y={node.y + 42} textAnchor="middle" fill="#7a7f8a" fontSize="9" opacity="0.4">
              {node.sub}
            </text>
          </g>
        ))}

        {/* Animated packets */}
        {packets.map((pkt) => {
          const x = getPacketX(pkt.phase);
          const color = pkt.verdict ? VERDICT_COLORS[pkt.verdict] : "#7a7f8a";
          const showInvest = pkt.phase >= 3 && pkt.verdict === "SAFE";
          const rejected = pkt.phase >= 3 && pkt.verdict !== "SAFE" && pkt.verdict !== undefined;

          return (
            <g key={pkt.id} id={pkt.id}>
              {/* Packet dot */}
              <circle
                cx={x}
                cy={rejected ? 60 : 70}
                r={4}
                fill={color}
                opacity={pkt.phase === 4 ? 0.3 : 0.9}
              >
                <animate attributeName="cx" to={x} dur="0.5s" fill="freeze" />
              </circle>
              {/* Label */}
              <text
                x={x}
                y={rejected ? 54 : 62}
                textAnchor="middle"
                fill={color}
                fontSize="7"
                fontFamily="monospace"
                fontWeight="500"
                opacity={pkt.phase === 4 ? 0.2 : 0.7}
              >
                {pkt.symbol}
              </text>
              {/* Verdict label */}
              {pkt.verdict && pkt.phase >= 2 && (
                <text
                  x={x}
                  y={rejected ? 72 : 82}
                  textAnchor="middle"
                  fill={color}
                  fontSize="6"
                  fontFamily="monospace"
                  opacity={0.5}
                >
                  {pkt.verdict}
                </text>
              )}
              {/* Invest arrow for SAFE */}
              {showInvest && (
                <text x={x} y={82} textAnchor="middle" fill="#34d399" fontSize="7" opacity={0.6}>
                  LP
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
