"use client";

import { Link } from "@/i18n/navigation";
import type { ReactNode } from "react";

interface MovingBorderButtonProps {
  href: string;
  children: ReactNode;
  className?: string;
}

// Primary CTA button with a rotating pink gradient border.
// The inner fill is near-black so the border is clearly visible.
export function MovingBorderButton({
  href,
  children,
  className = "",
}: MovingBorderButtonProps) {
  return (
    <div className="relative inline-flex">
      {/* Clip layer — keeps the rotating gradient within the border zone */}
      <div className="absolute inset-0 rounded-xl overflow-hidden">
        <div
          className="absolute inset-[-200%]"
          style={{
            background:
              "conic-gradient(from 0deg, transparent 0%, transparent 55%, #ff2d78 70%, #e8185a 82%, #ff2d78 90%, transparent 100%)",
            animation: "spin 3s linear infinite",
          }}
        />
      </div>
      {/* Inner button */}
      <Link
        href={href}
        className={`relative z-10 inline-flex items-center justify-center gap-2.5 px-10 py-4 rounded-xl bg-[#0a0a0a] hover:bg-[#111111] text-white font-bold text-base transition-colors duration-200 ${className}`}
      >
        {children}
      </Link>
    </div>
  );
}
