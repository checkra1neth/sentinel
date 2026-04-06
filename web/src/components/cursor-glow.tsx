"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";

/**
 * Glowing orb that follows the cursor with smooth lag.
 */
export function CursorGlow(): React.ReactNode {
  const glowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = glowRef.current;
    if (!el) return;

    const move = (e: MouseEvent): void => {
      gsap.to(el, {
        x: e.clientX,
        y: e.clientY,
        duration: 0.8,
        ease: "power3.out",
      });
    };

    window.addEventListener("mousemove", move);
    return () => window.removeEventListener("mousemove", move);
  }, []);

  return (
    <div
      ref={glowRef}
      className="pointer-events-none fixed top-0 left-0 -z-10 -translate-x-1/2 -translate-y-1/2 hidden sm:block"
      style={{
        width: 400,
        height: 400,
        borderRadius: "50%",
        background: "radial-gradient(circle, rgba(139,92,246,0.07) 0%, rgba(139,92,246,0.02) 40%, transparent 70%)",
        willChange: "transform",
      }}
    />
  );
}
