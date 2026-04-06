"use client";

import { useEffect, useRef } from "react";

/**
 * Full-screen animated aurora / gradient mesh background.
 * Uses canvas with multiple overlapping radial gradients that drift.
 */
export function AuroraBg(): React.ReactNode {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let t = 0;

    const orbs = [
      { x: 0.3, y: 0.2, r: 0.5, color: [99, 102, 241], speed: 0.0003, phase: 0 },      // indigo
      { x: 0.7, y: 0.3, r: 0.4, color: [34, 211, 238], speed: 0.0004, phase: 2 },       // cyan
      { x: 0.5, y: 0.7, r: 0.45, color: [52, 211, 153], speed: 0.00035, phase: 4 },     // emerald
      { x: 0.2, y: 0.8, r: 0.35, color: [139, 92, 246], speed: 0.00025, phase: 1 },     // violet
      { x: 0.8, y: 0.6, r: 0.3, color: [99, 102, 241], speed: 0.00045, phase: 3 },      // indigo2
    ];

    const resize = (): void => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const animate = (): void => {
      t++;
      const w = canvas.width;
      const h = canvas.height;

      ctx.fillStyle = "#09090b";
      ctx.fillRect(0, 0, w, h);

      for (const orb of orbs) {
        const cx = w * (orb.x + Math.sin(t * orb.speed + orb.phase) * 0.15);
        const cy = h * (orb.y + Math.cos(t * orb.speed * 0.7 + orb.phase) * 0.1);
        const radius = Math.min(w, h) * orb.r;

        const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
        const [r, g, b] = orb.color;
        gradient.addColorStop(0, `rgba(${r},${g},${b},0.08)`);
        gradient.addColorStop(0.4, `rgba(${r},${g},${b},0.03)`);
        gradient.addColorStop(1, `rgba(${r},${g},${b},0)`);

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, w, h);
      }

      raf = requestAnimationFrame(animate);
    };

    raf = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 -z-20 pointer-events-none"
    />
  );
}
