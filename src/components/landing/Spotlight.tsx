"use client";

// Theatrical stage-light spotlight behind the hero headline.
// Large radial gradient centered top — fades in on page load.
export function Spotlight({ className = "" }: { className?: string }) {
  return (
    <div
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
      aria-hidden="true"
    >
      {/* Primary gold spotlight — centered top */}
      <div
        className="absolute left-1/2 -translate-x-1/2 animate-fade-in"
        style={{
          top: "-5%",
          width: "900px",
          height: "700px",
          background:
            "radial-gradient(ellipse 55% 50% at 50% 0%, rgba(201,168,76,0.15) 0%, rgba(201,168,76,0.06) 45%, transparent 75%)",
        }}
      />
      {/* Tight bright core */}
      <div
        className="absolute left-1/2 -translate-x-1/2 animate-fade-in"
        style={{
          top: "-2%",
          width: "320px",
          height: "200px",
          background:
            "radial-gradient(ellipse 70% 60% at 50% 0%, rgba(201,168,76,0.22) 0%, transparent 70%)",
          filter: "blur(24px)",
        }}
      />
    </div>
  );
}
