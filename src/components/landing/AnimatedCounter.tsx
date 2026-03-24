"use client";

import { useEffect, useRef, useState } from "react";

interface AnimatedCounterProps {
  value: string;
  className?: string;
}

function parseValue(v: string): {
  prefix: string;
  num: number;
  suffix: string;
} {
  const match = v.match(/^([^0-9]*)([0-9,.]+)([^0-9]*)$/);
  if (!match) return { prefix: "", num: 0, suffix: v };
  const num = parseFloat(match[2].replace(/,/g, ""));
  return { prefix: match[1], num: isNaN(num) ? 0 : num, suffix: match[3] };
}

export function AnimatedCounter({
  value,
  className = "",
}: AnimatedCounterProps) {
  const { prefix, num, suffix } = parseValue(value);
  const [displayed, setDisplayed] = useState(0);
  const hasAnimated = useRef(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!ref.current || hasAnimated.current || num === 0) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || hasAnimated.current) return;
        hasAnimated.current = true;
        observer.disconnect();

        const duration = 1400;
        const start = performance.now();

        function step(now: number) {
          const progress = Math.min((now - start) / duration, 1);
          // Ease out cubic
          const eased = 1 - Math.pow(1 - progress, 3);
          setDisplayed(Math.floor(eased * num));
          if (progress < 1) requestAnimationFrame(step);
          else setDisplayed(num);
        }

        requestAnimationFrame(step);
      },
      { threshold: 0.5 },
    );

    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [num]);

  // If value can't be parsed as a number, render static
  if (num === 0 && suffix === value) {
    return <span className={className}>{value}</span>;
  }

  const formatted =
    num >= 1000 ? displayed.toLocaleString("en-US") : displayed.toString();

  return (
    <span ref={ref} className={className}>
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
}
