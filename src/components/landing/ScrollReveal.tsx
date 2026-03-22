"use client";

import { useEffect, useRef, ReactNode } from "react";

interface ScrollRevealProps {
  children: ReactNode;
  className?: string;
  delay?: number; // ms stagger delay
  scale?: boolean; // whether to scale from 0.96
}

// Wraps children in an IntersectionObserver that adds a visible class
// when the element enters the viewport. Transitions: opacity + translateY + optional scale.
// Uses expo-out easing (cubic-bezier(0.16,1,0.3,1)) for snappy premium feel.
export function ScrollReveal({
  children,
  className = "",
  delay = 0,
  scale = true,
}: ScrollRevealProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.style.transitionDelay = `${delay}ms`;
          el.classList.add("sr-visible");
          observer.unobserve(el);
        }
      },
      { threshold: 0.12 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [delay]);

  return (
    <div
      ref={ref}
      className={`sr-root${scale ? " sr-scale" : ""} ${className}`}
    >
      {children}
    </div>
  );
}
