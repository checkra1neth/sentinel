"use client";

import { useRef, useEffect, type ReactNode } from "react";
import gsap from "gsap";

/**
 * 3D tilt frame with:
 * - Mouse-reactive perspective tilt
 * - Animated rotating gradient border
 * - Glowing reflection beneath
 * - Floating shadow
 */
export function TiltFrame({ children }: { children: ReactNode }): React.ReactNode {
  const containerRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const reflectionRef = useRef<HTMLDivElement>(null);
  const borderAngle = useRef(0);
  const rafRef = useRef(0);

  useEffect(() => {
    const container = containerRef.current;
    const frame = frameRef.current;
    const glow = glowRef.current;
    const reflection = reflectionRef.current;
    if (!container || !frame) return;

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) return;

    // Rotate border gradient
    const animateBorder = (): void => {
      borderAngle.current = (borderAngle.current + 0.3) % 360;
      frame.style.setProperty("--border-angle", `${borderAngle.current}deg`);
      rafRef.current = requestAnimationFrame(animateBorder);
    };
    rafRef.current = requestAnimationFrame(animateBorder);

    // Mouse tilt
    const handleMove = (e: MouseEvent): void => {
      const rect = container.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const rotateY = ((e.clientX - centerX) / (rect.width / 2)) * 6;
      const rotateX = ((centerY - e.clientY) / (rect.height / 2)) * 4;

      gsap.to(frame, {
        rotateX,
        rotateY,
        duration: 0.6,
        ease: "power2.out",
        overwrite: true,
      });

      // Move glow to follow cursor
      if (glow) {
        const glowX = ((e.clientX - rect.left) / rect.width) * 100;
        const glowY = ((e.clientY - rect.top) / rect.height) * 100;
        gsap.to(glow, {
          background: `radial-gradient(600px circle at ${glowX}% ${glowY}%, rgba(139,92,246,0.12), transparent 60%)`,
          duration: 0.3,
          overwrite: true,
        });
      }

      // Reflection follows tilt
      if (reflection) {
        gsap.to(reflection, {
          rotateX: -rotateX * 0.5,
          rotateY: rotateY * 0.5,
          duration: 0.6,
          ease: "power2.out",
          overwrite: true,
        });
      }
    };

    const handleLeave = (): void => {
      gsap.to(frame, { rotateX: 0, rotateY: 0, duration: 0.8, ease: "power3.out" });
      if (glow) gsap.to(glow, { background: "transparent", duration: 0.5 });
      if (reflection) gsap.to(reflection, { rotateX: 0, rotateY: 0, duration: 0.8, ease: "power3.out" });
    };

    container.addEventListener("mousemove", handleMove);
    container.addEventListener("mouseleave", handleLeave);

    return () => {
      cancelAnimationFrame(rafRef.current);
      container.removeEventListener("mousemove", handleMove);
      container.removeEventListener("mouseleave", handleLeave);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative"
      style={{ perspective: "1200px" }}
    >
      {/* Main frame with rotating gradient border */}
      <div
        ref={frameRef}
        className="relative rounded-xl overflow-hidden"
        style={{
          transformStyle: "preserve-3d",
          willChange: "transform",
          padding: "1px",
          background: `conic-gradient(from var(--border-angle, 0deg), #8b5cf6, #06b6d4, #34d399, #8b5cf6)`,
          // @ts-expect-error css custom property
          "--border-angle": "0deg",
        }}
      >
        {/* Inner content */}
        <div className="relative rounded-[11px] overflow-hidden bg-[#09090b]">
          {/* Hover glow overlay */}
          <div
            ref={glowRef}
            className="absolute inset-0 z-10 pointer-events-none rounded-[11px]"
          />

          {/* Scanline effect */}
          <div
            className="absolute inset-0 z-10 pointer-events-none opacity-[0.03]"
            style={{
              backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.03) 2px, rgba(255,255,255,0.03) 4px)",
            }}
          />

          {children}
        </div>
      </div>

      {/* Reflection beneath */}
      <div
        ref={reflectionRef}
        className="absolute -bottom-2 left-[5%] right-[5%] h-[60%] rounded-xl -z-10 blur-2xl opacity-20"
        style={{
          transformStyle: "preserve-3d",
          background: "conic-gradient(from 180deg, rgba(139,92,246,0.3), rgba(6,182,212,0.2), rgba(52,211,153,0.2), rgba(139,92,246,0.3))",
        }}
      />

      {/* Drop shadow glow */}
      <div className="absolute -bottom-8 left-[10%] right-[10%] h-16 -z-20 blur-3xl opacity-15 rounded-full bg-[#8b5cf6]" />
    </div>
  );
}
