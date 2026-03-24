"use client";

// A beam of light that continuously travels around the border of its parent.
// Parent must have: position:relative, overflow:hidden, border-radius set.
interface BorderBeamProps {
  duration?: number; // seconds per full orbit
  colorFrom?: string;
  colorTo?: string;
  delay?: number;
}

export function BorderBeam({
  duration = 4,
  colorFrom = "rgba(255,45,120,0)",
  colorTo = "#ff2d78",
  delay = 0,
}: BorderBeamProps) {
  return (
    <div
      className="pointer-events-none absolute inset-0 rounded-[inherit]"
      aria-hidden="true"
    >
      <div
        className="absolute inset-0 rounded-[inherit]"
        style={{
          background: `conic-gradient(from 0deg, transparent 0%, ${colorFrom} 10%, ${colorTo} 20%, transparent 30%)`,
          animation: `spin ${duration}s linear infinite`,
          animationDelay: `${delay}s`,
          WebkitMask:
            "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
          WebkitMaskComposite: "xor",
          maskComposite: "exclude",
          padding: "1px",
        }}
      />
    </div>
  );
}
