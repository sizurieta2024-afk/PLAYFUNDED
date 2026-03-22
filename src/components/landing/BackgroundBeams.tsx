"use client";

// God-ray conic gradient wedges radiating from a single source point.
// No moving parts that create visible scratch artifacts.
// Slow breathing pulse only — opacity oscillates very subtly.
export function BackgroundBeams() {
  return (
    <div
      className="absolute inset-0 pointer-events-none overflow-hidden"
      aria-hidden="true"
    >
      {/* Primary source: top-right corner — gold rays fanning left-down */}
      <div
        className="absolute inset-0 animate-glow-pulse"
        style={{
          background: `conic-gradient(
            from 195deg at 100% -5%,
            transparent 0deg,
            rgba(201,168,76,0.055) 8deg,
            transparent 16deg,
            transparent 28deg,
            rgba(201,168,76,0.035) 36deg,
            transparent 44deg,
            transparent 58deg,
            rgba(201,168,76,0.025) 64deg,
            transparent 72deg
          )`,
          animationDuration: "6s",
        }}
      />

      {/* Secondary source: bottom-left — pink rays fanning right-up */}
      <div
        className="absolute inset-0"
        style={{
          background: `conic-gradient(
            from 15deg at 0% 110%,
            transparent 0deg,
            rgba(255,45,120,0.03) 7deg,
            transparent 14deg,
            transparent 24deg,
            rgba(255,45,120,0.02) 30deg,
            transparent 36deg
          )`,
          animation: "glow-pulse-pink 8s ease-in-out infinite",
        }}
      />

      {/* Soft radial bloom at origin points — reinforces the light-source feel */}
      <div className="absolute -top-24 -right-24 w-[480px] h-[480px] rounded-full bg-[radial-gradient(ellipse,rgba(201,168,76,0.07)_0%,transparent_65%)] blur-3xl" />
      <div className="absolute -bottom-20 -left-20 w-[360px] h-[360px] rounded-full bg-[radial-gradient(ellipse,rgba(255,45,120,0.05)_0%,transparent_65%)] blur-3xl" />
    </div>
  );
}
