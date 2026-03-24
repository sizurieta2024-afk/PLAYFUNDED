"use client";

// Animated film grain overlay — the single biggest visual differentiator
// between "sterile SaaS app" and "premium financial platform".
// Uses an inline SVG turbulence filter as a background pattern,
// animated at steps(1) so it snaps frame-to-frame like real film grain.
interface GrainOverlayProps {
  opacity?: number;
  className?: string;
}

export function GrainOverlay({
  opacity = 0.032,
  className = "",
}: GrainOverlayProps) {
  // SVG turbulence filter inline as data URI — no network request, no file needed
  const grainSvg = `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`;

  return (
    <div
      className={`pointer-events-none absolute inset-0 overflow-hidden animate-grain ${className}`}
      aria-hidden="true"
      style={{
        opacity,
        backgroundImage: grainSvg,
        backgroundRepeat: "repeat",
        backgroundSize: "256px 256px",
        // Slightly larger than container so translation doesn't reveal edges
        width: "calc(100% + 8px)",
        height: "calc(100% + 8px)",
        top: "-4px",
        left: "-4px",
      }}
    />
  );
}
