"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";

export function RadarSweep({ size = 280 }: { size?: number }): React.ReactNode {
  const sweepRef = useRef<SVGGElement>(null);
  const pingsRef = useRef<SVGGElement>(null);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) return;

    // Sweep rotation
    if (sweepRef.current) {
      gsap.to(sweepRef.current, {
        rotation: 360,
        duration: 4,
        repeat: -1,
        ease: "none",
        transformOrigin: "50% 50%",
      });
    }

    // Random pings
    if (pingsRef.current) {
      const createPing = (): void => {
        const angle = Math.random() * Math.PI * 2;
        const dist = 30 + Math.random() * 80;
        const cx = 140 + Math.cos(angle) * dist;
        const cy = 140 + Math.sin(angle) * dist;

        const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        circle.setAttribute("cx", String(cx));
        circle.setAttribute("cy", String(cy));
        circle.setAttribute("r", "0");
        circle.setAttribute("fill", Math.random() > 0.7 ? "#ef4444" : "#34d399");
        circle.setAttribute("opacity", "0");
        pingsRef.current?.appendChild(circle);

        gsap.to(circle, {
          r: 3 + Math.random() * 2,
          opacity: 0.8,
          duration: 0.3,
          ease: "power2.out",
          onComplete: () => {
            gsap.to(circle, {
              opacity: 0,
              r: 0,
              duration: 1.5,
              delay: 0.5 + Math.random() * 2,
              ease: "power2.in",
              onComplete: () => circle.remove(),
            });
          },
        });
      };

      const interval = setInterval(createPing, 800);
      return () => clearInterval(interval);
    }
  }, []);

  const r = size / 2;
  const rings = [0.25, 0.5, 0.75, 1];

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="opacity-60">
      {/* Grid rings */}
      {rings.map((scale) => (
        <circle
          key={scale}
          cx={r}
          cy={r}
          r={r * scale - 1}
          fill="none"
          stroke="#8b5cf6"
          strokeWidth="0.5"
          opacity={0.1 + scale * 0.05}
        />
      ))}

      {/* Cross lines */}
      <line x1={r} y1={0} x2={r} y2={size} stroke="#8b5cf6" strokeWidth="0.5" opacity="0.08" />
      <line x1={0} y1={r} x2={size} y2={r} stroke="#8b5cf6" strokeWidth="0.5" opacity="0.08" />
      <line x1={r - r * 0.7} y1={r - r * 0.7} x2={r + r * 0.7} y2={r + r * 0.7} stroke="#8b5cf6" strokeWidth="0.3" opacity="0.05" />
      <line x1={r + r * 0.7} y1={r - r * 0.7} x2={r - r * 0.7} y2={r + r * 0.7} stroke="#8b5cf6" strokeWidth="0.3" opacity="0.05" />

      {/* Sweep beam */}
      <g ref={sweepRef}>
        <defs>
          <linearGradient id="sweep-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          d={`M ${r} ${r} L ${r} ${r * 0.05} A ${r * 0.95} ${r * 0.95} 0 0 1 ${r + r * 0.65} ${r - r * 0.68} Z`}
          fill="url(#sweep-grad)"
        />
        <line x1={r} y1={r} x2={r} y2={r * 0.05} stroke="#8b5cf6" strokeWidth="1" opacity="0.5" />
      </g>

      {/* Center dot */}
      <circle cx={r} cy={r} r="2" fill="#8b5cf6" opacity="0.8" />
      <circle cx={r} cy={r} r="5" fill="none" stroke="#8b5cf6" strokeWidth="0.5" opacity="0.3" />

      {/* Pings */}
      <g ref={pingsRef} />
    </svg>
  );
}
