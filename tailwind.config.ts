import type { Config } from "tailwindcss";

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
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "Fira Code", "monospace"],
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
        // PlayFunded brand tokens — exact spec values (#0a0a0f / #1a1a2e / #2d6a4f / #f4a261)
        pf: {
          brand: "#2d6a4f",        // spec green — primary CTA, funded, gains
          "brand-dark": "#235a40", // darker green — hover states
          gold: "#f4a261",         // spec gold — champion tier, streak bonus
          "gold-dark": "#e8894a",  // darker gold — hover
          danger: "#ef4444",       // losses, failed, errors
          "danger-dark": "#dc2626",
          // Dark mode surfaces — exact spec values
          dark: "#0a0a0f",
          "dark-surface": "#1a1a2e",
          "dark-elevated": "#252540",
          "dark-border": "#1e2040",
          // Light mode surfaces
          light: "#f1f5f9",
          "light-surface": "#ffffff",
          "light-elevated": "#f8fafc",
          "light-border": "#e2e8f0",
        },
      },
      backgroundImage: {
        // Challenge tier gradients (FTMO-inspired, updated to spec green)
        "tier-starter": "linear-gradient(135deg, #2d6a4f 0%, #235a40 100%)",
        "tier-pro": "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
        "tier-elite": "linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)",
        "tier-champion": "linear-gradient(135deg, #f4a261 0%, #e8894a 100%)",
      },
      boxShadow: {
        "pf-sm": "0 1px 3px 0 rgba(0,0,0,0.4), 0 1px 2px -1px rgba(0,0,0,0.4)",
        "pf-md": "0 4px 12px 0 rgba(0,0,0,0.35)",
        "pf-lg": "0 8px 24px 0 rgba(0,0,0,0.4)",
        "pf-brand": "0 0 0 3px rgba(45,106,79,0.35)",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
