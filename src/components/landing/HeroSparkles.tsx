"use client";

import { useEffect, useState } from "react";

interface Dot {
  x: number;
  y: number;
  r: number;
  delay: number;
  duration: number;
}

interface HeroSparklesProps {
  count?: number;
  className?: string;
}

// Subtle gold twinkling particle field for the hero section.
// Particles are generated client-side to avoid SSR hydration mismatch.
export function HeroSparkles({
  count = 38,
  className = "",
}: HeroSparklesProps) {
  const [dots, setDots] = useState<Dot[]>([]);

  useEffect(() => {
    setDots(
      Array.from({ length: count }, () => ({
        x: Math.random() * 100,
        y: Math.random() * 100,
        r: Math.random() * 1.2 + 0.4,
        delay: Math.random() * 6,
        duration: Math.random() * 2.5 + 1.5,
      })),
    );
  }, [count]);

  if (!dots.length) return null;

  return (
    <div
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
      aria-hidden="true"
    >
      <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
        {dots.map((d, i) => (
          <circle
            key={i}
            cx={`${d.x}%`}
            cy={`${d.y}%`}
            r={d.r}
            fill="#c9a84c"
            style={{
              animation: `twinkle ${d.duration}s ease-in-out infinite ${d.delay}s`,
              opacity: 0.05,
            }}
          />
        ))}
      </svg>
    </div>
  );
}
