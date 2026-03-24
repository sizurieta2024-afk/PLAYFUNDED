"use client";

import { useRef, useCallback, type ReactNode } from "react";

interface GlowingCardProps {
  children: ReactNode;
  className?: string;
  glowColor?: string; // e.g. "201,168,76" for gold
}

export function GlowingCard({
  children,
  className = "",
  glowColor = "201,168,76",
}: GlowingCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    rafRef.current = requestAnimationFrame(() => {
      if (!cardRef.current) return;
      const rect = cardRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const cx = rect.width / 2;
      const cy = rect.height / 2;

      // Distance from center — fade glow at edges
      const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
      const maxDist = Math.sqrt(cx ** 2 + cy ** 2);
      const intensity = Math.max(0, 1 - dist / maxDist);

      // Angle from cursor to card center
      const angle = Math.atan2(y - cy, x - cx) * (180 / Math.PI) + 90;

      cardRef.current.style.setProperty("--glow-angle", `${angle}deg`);
      cardRef.current.style.setProperty(
        "--glow-opacity",
        String(intensity * 0.8),
      );
    });
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (cardRef.current) {
      cardRef.current.style.setProperty("--glow-opacity", "0");
    }
  }, []);

  return (
    <div
      ref={cardRef}
      className={`relative ${className}`}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={
        {
          "--glow-angle": "0deg",
          "--glow-opacity": "0",
          "--glow-color": glowColor,
        } as React.CSSProperties
      }
    >
      {/* Border glow overlay */}
      <div
        className="pointer-events-none absolute -inset-px rounded-2xl transition-opacity duration-300"
        style={{
          background: `conic-gradient(from var(--glow-angle) at 50% 50%, transparent 20%, rgba(var(--glow-color), var(--glow-opacity)) 40%, rgba(var(--glow-color), calc(var(--glow-opacity) * 0.5)) 60%, transparent 80%)`,
          opacity: "var(--glow-opacity)" as unknown as number,
          borderRadius: "inherit",
        }}
      />
      {children}
    </div>
  );
}
