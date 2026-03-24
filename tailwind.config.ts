import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-manrope)", "system-ui", "sans-serif"],
        serif: ["var(--font-dm-serif)", "Georgia", "serif"],
        display: ["var(--font-syne)", "system-ui", "sans-serif"],
        mono: [
          "var(--font-dm-mono)",
          "var(--font-geist-mono)",
          "Fira Code",
          "monospace",
        ],
      },
      colors: {
        // shadcn/ui CSS variable tokens (auto-switch with .dark class)
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        chart: {
          "1": "hsl(var(--chart-1))",
          "2": "hsl(var(--chart-2))",
          "3": "hsl(var(--chart-3))",
          "4": "hsl(var(--chart-4))",
          "5": "hsl(var(--chart-5))",
        },
        // PlayFunded brand tokens
        pf: {
          // Gold — brand accent, profit, success, funded states, checkmarks
          brand: "#c9a84c",
          "brand-dark": "#b8962e",
          gold: "#c9a84c",
          "gold-light": "#e8d5a0",
          "gold-dark": "#b8962e",
          // Pink — all primary action CTAs (buy, submit, place pick, approve)
          pink: "#ff2d78",
          "pink-dark": "#e8185a",
          // Legacy gold (warm orange) kept for backward-compat if referenced
          "gold-warm": "#f4a261",
          "gold-warm-dark": "#e8894a",
          // Danger
          danger: "#ef4444",
          "danger-dark": "#dc2626",
          // Dark mode surfaces — pure black family
          dark: "#000000",
          "dark-surface": "#080808",
          "dark-card": "#0f0f0f",
          "dark-elevated": "#1a1a1a",
          "dark-border": "#1f1f1f",
          // Light mode surfaces — warm off-white family
          light: "#fafaf8",
          "light-surface": "#ffffff",
          "light-elevated": "#f5f4f0",
          "light-border": "#e5e3dc",
        },
      },
      backgroundImage: {
        // Challenge tier card tints
        "tier-starter":
          "linear-gradient(135deg, rgba(201,168,76,0.10) 0%, transparent 100%)",
        "tier-pro":
          "linear-gradient(135deg, rgba(59,130,246,0.10) 0%, transparent 100%)",
        "tier-elite":
          "linear-gradient(135deg, rgba(255,45,120,0.10) 0%, transparent 100%)",
        "tier-champion":
          "linear-gradient(135deg, rgba(201,168,76,0.18) 0%, transparent 100%)",
        "tier-legend":
          "linear-gradient(135deg, rgba(255,45,120,0.18) 0%, transparent 100%)",
      },
      boxShadow: {
        "pf-sm": "0 1px 3px 0 rgba(0,0,0,0.4), 0 1px 2px -1px rgba(0,0,0,0.4)",
        "pf-md": "0 4px 12px 0 rgba(0,0,0,0.35)",
        "pf-lg": "0 8px 24px 0 rgba(0,0,0,0.4)",
        // Gold glows
        "pf-brand": "0 0 0 3px rgba(201,168,76,0.35)",
        "pf-glow-sm": "0 0 20px rgba(201,168,76,0.25)",
        "pf-glow": "0 0 35px rgba(201,168,76,0.35)",
        "pf-glow-lg": "0 0 60px rgba(201,168,76,0.45)",
        // Pink glows
        "pf-pink-glow-sm": "0 0 20px rgba(255,45,120,0.30)",
        "pf-pink-glow": "0 0 35px rgba(255,45,120,0.40)",
        "pf-pink-glow-lg": "0 0 60px rgba(255,45,120,0.50)",
        // Tier-specific
        "tier-elite": "0 0 40px rgba(255,45,120,0.20)",
        "tier-master": "0 0 40px rgba(249,115,22,0.25)",
        "tier-legend": "0 0 40px rgba(201,168,76,0.25)",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      transitionTimingFunction: {
        "expo-out": "cubic-bezier(0.16, 1, 0.3, 1)",
        "expo-in-out": "cubic-bezier(0.87, 0, 0.13, 1)",
      },
    },
  },
  plugins: [tailwindcssAnimate],
};

export default config;
