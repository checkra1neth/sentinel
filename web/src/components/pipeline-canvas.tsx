"use client";

import { useEffect, useRef, useState, useCallback } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3002";

interface Verdict {
  tokenSymbol: string;
  verdict: string;
  riskScore: number;
}

const VERDICT_COLORS: Record<string, string> = {
  SAFE: "#34d399",
  CAUTION: "#f59e0b",
  DANGEROUS: "#ef4444",
};

interface Orb {
  id: number;
  symbol: string;
  verdict: string;
  riskScore: number;
  progress: number; // 0-1 along the path
  speed: number;
  color: string;
  alive: boolean;
  radius: number;
}

/**
 * Canvas-based pipeline: 3 agent nodes, orbs travel between them.
 * Orbs carry real token names and get colored by verdict.
 */
export function PipelineCanvas(): React.ReactNode {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const orbsRef = useRef<Orb[]>([]);
  const idRef = useRef(0);
  const [verdicts, setVerdicts] = useState<Verdict[]>([]);

  const fetchVerdicts = useCallback(async (): Promise<void> => {
    try {
      const res = await fetch(`${API_URL}/api/verdicts?limit=15`);
      if (res.ok) {
        const d = await res.json() as { verdicts: Verdict[] };
        setVerdicts(d.verdicts?.length ? d.verdicts : [
          { tokenSymbol: "DOGSHIT", verdict: "SAFE", riskScore: 11 },
          { tokenSymbol: "XDOG", verdict: "SAFE", riskScore: 10 },
          { tokenSymbol: "KDOG", verdict: "DANGEROUS", riskScore: 43 },
          { tokenSymbol: "banmao", verdict: "CAUTION", riskScore: 20 },
        ]);
      }
    } catch {
      setVerdicts([
        { tokenSymbol: "DOGSHIT", verdict: "SAFE", riskScore: 11 },
        { tokenSymbol: "XDOG", verdict: "SAFE", riskScore: 10 },
        { tokenSymbol: "KDOG", verdict: "DANGEROUS", riskScore: 43 },
      ]);
    }
  }, []);

  useEffect(() => { fetchVerdicts(); }, [fetchVerdicts]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || verdicts.length === 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let tick = 0;
    let vIdx = 0;

    const resize = (): void => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const getNodePositions = (w: number, h: number) => {
      const cy = h * 0.45;
      const pad = w * 0.12;
      return [
        { x: pad + w * 0.05, y: cy, label: "SCANNER", color: "#06b6d4" },
        { x: w / 2, y: cy, label: "ANALYST", color: "#8b5cf6" },
        { x: w - pad - w * 0.05, y: cy, label: "EXECUTOR", color: "#34d399" },
      ];
    };

    // Path interpolation between nodes
    const lerpPath = (progress: number, w: number, h: number): { x: number; y: number; phase: number } => {
      const nodes = getNodePositions(w, h);
      if (progress < 0.33) {
        const t = progress / 0.33;
        return { x: nodes[0].x + (nodes[1].x - nodes[0].x) * t, y: nodes[0].y + Math.sin(t * Math.PI) * -30, phase: 0 };
      } else if (progress < 0.66) {
        const t = (progress - 0.33) / 0.33;
        return { x: nodes[1].x + (nodes[2].x - nodes[1].x) * t, y: nodes[1].y + Math.sin(t * Math.PI) * -30, phase: 1 };
      } else {
        const t = (progress - 0.66) / 0.34;
        return { x: nodes[2].x, y: nodes[2].y + t * 60, phase: 2 };
      }
    };

    const spawnOrb = (): void => {
      const v = verdicts[vIdx % verdicts.length];
      vIdx++;
      orbsRef.current.push({
        id: idRef.current++,
        symbol: v.tokenSymbol,
        verdict: v.verdict,
        riskScore: v.riskScore,
        progress: 0,
        speed: 0.003 + Math.random() * 0.002,
        color: "#71717a",
        alive: true,
        radius: 5,
      });
    };

    let spawnTimer = 0;

    const loop = (): void => {
      tick++;
      spawnTimer++;
      const rect = canvas.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;

      if (spawnTimer > 90) { spawnOrb(); spawnTimer = 0; }

      ctx.clearRect(0, 0, w, h);
      const nodes = getNodePositions(w, h);

      // Draw connection lines
      ctx.setLineDash([4, 6]);
      ctx.strokeStyle = "#27272a";
      ctx.lineWidth = 1;
      for (let i = 0; i < nodes.length - 1; i++) {
        ctx.beginPath();
        ctx.moveTo(nodes[i].x, nodes[i].y);
        const midY = nodes[i].y - 30;
        ctx.quadraticCurveTo((nodes[i].x + nodes[i + 1].x) / 2, midY, nodes[i + 1].x, nodes[i + 1].y);
        ctx.stroke();
      }
      ctx.setLineDash([]);

      // Draw executor exit line
      ctx.strokeStyle = "#27272a";
      ctx.setLineDash([3, 5]);
      ctx.beginPath();
      ctx.moveTo(nodes[2].x, nodes[2].y + 20);
      ctx.lineTo(nodes[2].x, nodes[2].y + 70);
      ctx.stroke();
      ctx.setLineDash([]);

      // Draw nodes
      for (const n of nodes) {
        // Glow
        const grad = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, 40);
        grad.addColorStop(0, n.color + "15");
        grad.addColorStop(1, "transparent");
        ctx.fillStyle = grad;
        ctx.fillRect(n.x - 40, n.y - 40, 80, 80);

        // Ring
        ctx.beginPath();
        ctx.arc(n.x, n.y, 20, 0, Math.PI * 2);
        ctx.strokeStyle = n.color;
        ctx.lineWidth = 1.5;
        ctx.globalAlpha = 0.4;
        ctx.stroke();

        // Center dot
        ctx.beginPath();
        ctx.arc(n.x, n.y, 3, 0, Math.PI * 2);
        ctx.fillStyle = n.color;
        ctx.globalAlpha = 0.8;
        ctx.fill();

        // Pulsing outer ring
        const pulseR = 20 + Math.sin(tick * 0.03) * 4;
        ctx.beginPath();
        ctx.arc(n.x, n.y, pulseR, 0, Math.PI * 2);
        ctx.strokeStyle = n.color;
        ctx.lineWidth = 0.5;
        ctx.globalAlpha = 0.15;
        ctx.stroke();

        // Label
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = n.color;
        ctx.font = "600 9px 'Space Grotesk', sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(n.label, n.x, n.y - 30);

        ctx.globalAlpha = 1;
      }

      // Verdict labels under analyst
      ctx.globalAlpha = 0.2;
      ctx.fillStyle = "#a1a1aa";
      ctx.font = "8px 'JetBrains Mono', monospace";
      ctx.textAlign = "center";
      ctx.fillText("VerdictRegistry", nodes[1].x, nodes[1].y + 45);

      // LP label under executor
      ctx.fillText("Uniswap LP", nodes[2].x, nodes[2].y + 80);
      ctx.globalAlpha = 1;

      // Update and draw orbs
      for (const orb of orbsRef.current) {
        orb.progress += orb.speed;

        // Color transition at analyst (0.33)
        if (orb.progress > 0.33 && orb.color === "#71717a") {
          orb.color = VERDICT_COLORS[orb.verdict] ?? "#71717a";
          orb.radius = 6;
        }

        // Kill dangerous orbs after analyst
        if (orb.verdict !== "SAFE" && orb.progress > 0.5) {
          orb.alive = false;
        }

        if (orb.progress > 1) orb.alive = false;

        const pos = lerpPath(orb.progress, w, h);

        // Trail
        const trailLen = 5;
        for (let t = 1; t <= trailLen; t++) {
          const tp = lerpPath(Math.max(0, orb.progress - t * 0.008), w, h);
          ctx.beginPath();
          ctx.arc(tp.x, tp.y, orb.radius * (1 - t / trailLen) * 0.6, 0, Math.PI * 2);
          ctx.fillStyle = orb.color;
          ctx.globalAlpha = 0.1 * (1 - t / trailLen);
          ctx.fill();
        }

        // Orb
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, orb.radius, 0, Math.PI * 2);
        ctx.fillStyle = orb.color;
        ctx.globalAlpha = orb.alive ? 0.9 : 0.2;
        ctx.fill();

        // Glow
        const orbGrad = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, orb.radius * 3);
        orbGrad.addColorStop(0, orb.color + "30");
        orbGrad.addColorStop(1, "transparent");
        ctx.fillStyle = orbGrad;
        ctx.globalAlpha = 0.6;
        ctx.fillRect(pos.x - orb.radius * 3, pos.y - orb.radius * 3, orb.radius * 6, orb.radius * 6);

        // Label
        ctx.globalAlpha = orb.alive ? 0.7 : 0.15;
        ctx.fillStyle = orb.color;
        ctx.font = "600 10px 'JetBrains Mono', monospace";
        ctx.textAlign = "center";
        ctx.fillText(orb.symbol, pos.x, pos.y - 14);

        // Verdict label after analyst
        if (orb.progress > 0.35 && orb.progress < 0.6) {
          ctx.font = "600 8px 'Space Grotesk', sans-serif";
          ctx.globalAlpha = 0.5;
          ctx.fillText(orb.verdict, pos.x, pos.y + 18);
        }

        // Risk score near analyst
        if (orb.progress > 0.28 && orb.progress < 0.38) {
          ctx.font = "9px 'JetBrains Mono', monospace";
          ctx.globalAlpha = 0.4;
          ctx.fillText(`${orb.riskScore}/100`, pos.x, pos.y + 18);
        }

        ctx.globalAlpha = 1;
      }

      // Cleanup dead orbs
      orbsRef.current = orbsRef.current.filter((o) => o.alive || o.progress < 1.2);

      raf = requestAnimationFrame(loop);
    };

    spawnOrb(); // Initial orb
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [verdicts]);

  return (
    <div className="bg-[#0a0a0b] rounded-[11px] overflow-hidden">
      <div className="bg-[#18181b] px-4 py-2.5 flex items-center gap-2 border-b border-[#27272a]/60">
        <div className="flex gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-[#ef4444]/60" /><div className="w-2.5 h-2.5 rounded-full bg-[#f59e0b]/60" /><div className="w-2.5 h-2.5 rounded-full bg-[#34d399]/60" /></div>
        <span className="text-[10px] font-mono text-[#71717a] ml-2">sentinel — pipeline</span>
        <div className="ml-auto flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-[#34d399] animate-pulse" />
          <span className="text-[9px] text-[#71717a]">Live</span>
        </div>
      </div>
      <canvas ref={canvasRef} className="w-full" style={{ width: "100%", height: 320 }} />
    </div>
  );
}
