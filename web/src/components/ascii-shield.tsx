"use client";

import { useEffect, useRef } from "react";

/**
 * ASCII canvas that renders a shield shape from characters.
 * Characters scatter away from the cursor and reform when idle.
 * Matrix-style falling characters in background.
 */

interface AsciiChar {
  x: number;
  y: number;
  homeX: number;
  homeY: number;
  char: string;
  color: string;
  alpha: number;
  vx: number;
  vy: number;
  size: number;
}

const CHARS = "SENTINEL01█▓▒░╬╠╣╦╩■□◆◇○●".split("");
const SHIELD_CHARS = "SENTINELSAFECAUTIONRISK".split("");
const MOUSE_RADIUS = 120;
const RETURN_FORCE = 0.04;
const FRICTION = 0.92;

function getShieldPoints(cx: number, cy: number, scale: number): Array<[number, number]> {
  const points: Array<[number, number]> = [];
  // Shield shape — top arc, sides, bottom point
  const steps = 200;
  for (let i = 0; i < steps; i++) {
    const t = i / steps;

    let x: number, y: number;

    if (t < 0.3) {
      // Top arc
      const a = (t / 0.3) * Math.PI;
      x = cx + Math.cos(Math.PI - a) * scale * 0.8;
      y = cy - scale * 0.9 + Math.sin(a) * scale * 0.15;
    } else if (t < 0.65) {
      // Sides going down
      const p = (t - 0.3) / 0.35;
      const side = i % 2 === 0 ? 1 : -1;
      x = cx + side * scale * (0.8 - p * 0.4);
      y = cy - scale * 0.75 + p * scale * 1.2;
    } else {
      // Bottom converge to point
      const p = (t - 0.65) / 0.35;
      const side = i % 2 === 0 ? 1 : -1;
      x = cx + side * scale * 0.4 * (1 - p);
      y = cy + scale * 0.45 + p * scale * 0.5;
    }

    points.push([x, y]);
  }

  // Fill interior
  const fill: Array<[number, number]> = [];
  for (let fy = cy - scale * 0.85; fy < cy + scale * 0.9; fy += 14) {
    // Width at this Y
    let halfW: number;
    const relY = (fy - cy) / scale;
    if (relY < -0.6) {
      halfW = scale * 0.8 * (1 - Math.pow((-0.6 - relY) / 0.3, 2) * 0.3);
    } else if (relY < 0.3) {
      halfW = scale * (0.8 - (relY + 0.6) * 0.2);
    } else {
      const p = (relY - 0.3) / 0.65;
      halfW = scale * 0.5 * (1 - p);
    }
    if (halfW < 5) continue;

    for (let fx = cx - halfW; fx < cx + halfW; fx += 12) {
      fill.push([fx, fy]);
    }
  }

  return [...points, ...fill];
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
    let chars: AsciiChar[] = [];
    let raindrops: Array<{ x: number; y: number; speed: number; char: string; alpha: number }> = [];

    const resize = (): void => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
      initChars(rect.width, rect.height);
      initRain(rect.width, rect.height);
    };

    const initChars = (w: number, h: number): void => {
      const cx = w / 2;
      const cy = h / 2;
      const scale = Math.min(w, h) * 0.32;
      const points = getShieldPoints(cx, cy, scale);

      chars = points.map(([x, y], i) => {
        const isEdge = i < 200;
        return {
          x, y, homeX: x, homeY: y,
          char: isEdge
            ? SHIELD_CHARS[i % SHIELD_CHARS.length]
            : CHARS[Math.floor(Math.random() * CHARS.length)],
          color: isEdge ? "#8b5cf6" : (Math.random() > 0.7 ? "#06b6d4" : "#8b5cf6"),
          alpha: isEdge ? 0.8 : 0.15 + Math.random() * 0.25,
          vx: 0, vy: 0,
          size: isEdge ? 11 : 9,
        };
      });
    };

    const initRain = (w: number, h: number): void => {
      raindrops = Array.from({ length: 40 }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        speed: 1 + Math.random() * 3,
        char: CHARS[Math.floor(Math.random() * CHARS.length)],
        alpha: 0.03 + Math.random() * 0.06,
      }));
    };

    const handleMove = (e: MouseEvent): void => {
      const rect = canvas.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
    };
    const handleLeave = (): void => { mouse.x = -9999; mouse.y = -9999; };

    canvas.addEventListener("mousemove", handleMove);
    canvas.addEventListener("mouseleave", handleLeave);
    window.addEventListener("resize", resize);

    resize();

    let tick = 0;
    const animate = (): void => {
      tick++;
      const rect = canvas.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;

      ctx.clearRect(0, 0, w, h);

      // Rain
      ctx.font = "10px 'JetBrains Mono', monospace";
      for (const drop of raindrops) {
        drop.y += drop.speed;
        if (drop.y > h) { drop.y = -10; drop.x = Math.random() * w; }
        if (tick % 4 === 0) drop.char = CHARS[Math.floor(Math.random() * CHARS.length)];
        ctx.globalAlpha = drop.alpha;
        ctx.fillStyle = "#8b5cf6";
        ctx.fillText(drop.char, drop.x, drop.y);
      }

      // Shield characters
      for (const c of chars) {
        // Mouse repulsion
        const dx = c.x - mouse.x;
        const dy = c.y - mouse.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < MOUSE_RADIUS && dist > 0) {
          const force = (MOUSE_RADIUS - dist) / MOUSE_RADIUS;
          const angle = Math.atan2(dy, dx);
          c.vx += Math.cos(angle) * force * 8;
          c.vy += Math.sin(angle) * force * 8;
        }

        // Return home
        c.vx += (c.homeX - c.x) * RETURN_FORCE;
        c.vy += (c.homeY - c.y) * RETURN_FORCE;

        // Friction
        c.vx *= FRICTION;
        c.vy *= FRICTION;

        c.x += c.vx;
        c.y += c.vy;

        // Occasional char change for interior
        if (c.alpha < 0.5 && tick % 8 === 0 && Math.random() > 0.9) {
          c.char = CHARS[Math.floor(Math.random() * CHARS.length)];
        }

        // Distance from home affects alpha
        const homeDist = Math.sqrt((c.x - c.homeX) ** 2 + (c.y - c.homeY) ** 2);
        const scatter = Math.min(homeDist / 100, 1);

        ctx.globalAlpha = c.alpha * (1 - scatter * 0.5);
        ctx.fillStyle = c.color;
        ctx.font = `${c.size}px 'JetBrains Mono', monospace`;
        ctx.fillText(c.char, c.x, c.y);
      }

      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(animate);
    };

    raf = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(raf);
      canvas.removeEventListener("mousemove", handleMove);
      canvas.removeEventListener("mouseleave", handleLeave);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full"
      style={{ width: "100%", height: "100%" }}
    />
  );
}
