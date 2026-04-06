"use client";

import { useEffect, useRef } from "react";

const CHARS = "SENTINEL01█▓▒░◆■●○".split("");
const MOUSE_RADIUS = 140;

interface Dot {
  x: number; y: number;
  homeX: number; homeY: number;
  char: string; color: string; alpha: number;
  vx: number; vy: number; size: number;
}

export function AsciiShield(): React.ReactNode {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    const mouse = { x: -9999, y: -9999 };
    let dots: Dot[] = [];

    const resize = (): void => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      build(rect.width, rect.height);
    };

    const build = (w: number, h: number): void => {
      dots = [];
      const cx = w / 2;
      const cy = h * 0.48;
      const S = Math.min(w, h) * 0.38;
      const gap = 16;

      for (let gy = cy - S; gy < cy + S * 1.1; gy += gap) {
        const relY = (gy - cy) / S;
        let halfW: number;
        if (relY < -0.5) halfW = S * (0.55 + (relY + 1) * 0.9);
        else if (relY < 0.3) halfW = S * 0.85 - Math.abs(relY) * S * 0.1;
        else halfW = S * 0.75 * Math.max(0, 1 - (relY - 0.3) / 0.8);
        if (halfW < 4) continue;

        for (let gx = cx - halfW; gx <= cx + halfW; gx += gap) {
          const distFromCenter = Math.sqrt((gx - cx) ** 2 + (gy - cy) ** 2) / S;
          const isEdge = Math.abs(Math.abs(gx - cx) - halfW) < gap * 1.5;
          const bright = isEdge ? 0.7 : 0.12 + Math.random() * 0.2;
          const col = isEdge
            ? "#8b5cf6"
            : Math.random() > 0.6 ? "#06b6d4" : "#8b5cf6";

          dots.push({
            x: gx, y: gy, homeX: gx, homeY: gy,
            char: CHARS[Math.floor(Math.random() * CHARS.length)],
            color: col, alpha: bright,
            vx: 0, vy: 0,
            size: isEdge ? 14 : 12,
          });
        }
      }
    };

    const onMove = (e: MouseEvent): void => {
      const r = canvas.getBoundingClientRect();
      mouse.x = e.clientX - r.left;
      mouse.y = e.clientY - r.top;
    };
    const onLeave = (): void => { mouse.x = -9999; mouse.y = -9999; };

    canvas.addEventListener("mousemove", onMove);
    canvas.addEventListener("mouseleave", onLeave);
    window.addEventListener("resize", resize);
    resize();

    let tick = 0;
    const loop = (): void => {
      tick++;
      const r = canvas.getBoundingClientRect();
      ctx.clearRect(0, 0, r.width, r.height);

      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      for (const d of dots) {
        const dx = d.x - mouse.x;
        const dy = d.y - mouse.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < MOUSE_RADIUS && dist > 0) {
          const f = ((MOUSE_RADIUS - dist) / MOUSE_RADIUS) ** 2;
          d.vx += (dx / dist) * f * 12;
          d.vy += (dy / dist) * f * 12;
        }

        d.vx += (d.homeX - d.x) * 0.035;
        d.vy += (d.homeY - d.y) * 0.035;
        d.vx *= 0.9;
        d.vy *= 0.9;
        d.x += d.vx;
        d.y += d.vy;

        if (d.alpha < 0.5 && tick % 6 === 0 && Math.random() > 0.85) {
          d.char = CHARS[Math.floor(Math.random() * CHARS.length)];
        }

        const homeDist = Math.sqrt((d.x - d.homeX) ** 2 + (d.y - d.homeY) ** 2);
        const fade = Math.max(0.03, 1 - homeDist / 150);

        ctx.globalAlpha = d.alpha * fade;
        ctx.fillStyle = d.color;
        ctx.font = `${d.size}px 'JetBrains Mono', monospace`;
        ctx.fillText(d.char, d.x, d.y);
      }

      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      canvas.removeEventListener("mousemove", onMove);
      canvas.removeEventListener("mouseleave", onLeave);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas ref={canvasRef} className="w-full h-full" style={{ width: "100%", height: "100%" }} />;
}
