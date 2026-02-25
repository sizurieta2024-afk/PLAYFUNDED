import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-plus-jakarta)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-geist-mono)', 'Fira Code', 'monospace'],
      },
      colors: {
        // shadcn/ui CSS variable tokens (auto-switch with .dark class)
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        chart: {
          '1': 'hsl(var(--chart-1))',
          '2': 'hsl(var(--chart-2))',
          '3': 'hsl(var(--chart-3))',
          '4': 'hsl(var(--chart-4))',
          '5': 'hsl(var(--chart-5))',
        },
        // PlayFunded brand tokens (use these directly in components)
        pf: {
          brand: '#10b981',        // emerald-500 — success, funded, gains
          'brand-dark': '#059669', // emerald-600 — hover states
          gold: '#f59e0b',         // amber-400 — champion tier, streak bonus
          'gold-dark': '#d97706',  // amber-500 — gold hover
          danger: '#ef4444',       // red-500 — losses, failed, errors
          'danger-dark': '#dc2626',// red-600 — danger hover
          // Dark mode surfaces
          dark: '#0c0f1a',
          'dark-surface': '#121826',
          'dark-elevated': '#1e2535',
          'dark-border': '#2a3347',
          // Light mode surfaces
          light: '#f1f5f9',
          'light-surface': '#ffffff',
          'light-elevated': '#f8fafc',
          'light-border': '#e2e8f0',
        },
      },
      backgroundImage: {
        // Challenge tier gradients (FTMO-inspired)
        'tier-starter': 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
        'tier-pro': 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
        'tier-elite': 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
        'tier-champion': 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
      },
      boxShadow: {
        'pf-sm': '0 1px 3px 0 rgba(0,0,0,0.3), 0 1px 2px -1px rgba(0,0,0,0.3)',
        'pf-md': '0 4px 12px 0 rgba(0,0,0,0.25)',
        'pf-lg': '0 8px 24px 0 rgba(0,0,0,0.3)',
        'pf-brand': '0 0 0 3px rgba(16,185,129,0.3)',
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}

export default config
