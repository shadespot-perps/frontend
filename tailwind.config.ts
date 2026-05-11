import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        shade: {
          teal: "hsl(var(--shade-teal))",
          "teal-dim": "hsl(var(--shade-teal-dim))",
          green: "hsl(var(--shade-green))",
          red: "hsl(var(--shade-red))",
          amber: "hsl(var(--shade-amber))",
          blue: "hsl(var(--shade-blue))",
          "bg-primary": "hsl(var(--shade-bg-primary))",
          "bg-secondary": "hsl(var(--shade-bg-secondary))",
          "bg-tertiary": "hsl(var(--shade-bg-tertiary))",
          "bg-elevated": "hsl(var(--shade-bg-elevated))",
          "bg-high": "hsl(var(--shade-bg-high))",
          "text-primary": "hsl(var(--shade-text-primary))",
          "text-secondary": "hsl(var(--shade-text-secondary))",
          "text-muted": "hsl(var(--shade-text-muted))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "pulse-teal": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.5" },
        },
        "landing-fade-up": {
          "0%": { opacity: "0", transform: "translateY(22px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "landing-float": {
          "0%, 100%": { transform: "translate(0, 0) scale(1)" },
          "33%": { transform: "translate(18px, -28px) scale(1.05)" },
          "66%": { transform: "translate(-22px, 16px) scale(0.96)" },
        },
        "landing-float-alt": {
          "0%, 100%": { transform: "translate(0, 0) scale(1)" },
          "50%": { transform: "translate(-32px, -20px) scale(1.07)" },
        },
        "landing-grid-drift": {
          "0%": { transform: "translate(0, 0)" },
          "100%": { transform: "translate(40px, 40px)" },
        },
        "landing-shimmer": {
          "0%": { transform: "translateX(-120%) skewX(-12deg)", opacity: "0" },
          "20%": { opacity: "0.12" },
          "100%": { transform: "translateX(220%) skewX(-12deg)", opacity: "0" },
        },
        "landing-gradient-text": {
          "0%, 100%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
        },
        "landing-orb-pulse": {
          "0%, 100%": { opacity: "0.35", transform: "scale(1)" },
          "50%": { opacity: "0.65", transform: "scale(1.08)" },
        },
        "landing-bar": {
          "0%, 100%": { transform: "scaleY(0.82)", opacity: "0.35" },
          "50%": { transform: "scaleY(1)", opacity: "0.85" },
        },
        "landing-sparkle": {
          "0%, 100%": { transform: "translateY(0) rotate(-6deg)" },
          "50%": { transform: "translateY(-5px) rotate(6deg)" },
        },
        "landing-cta-glow": {
          "0%, 100%": { opacity: "0.35", transform: "scale(1)" },
          "50%": { opacity: "0.75", transform: "scale(1.12)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.4s ease-out",
        "pulse-teal": "pulse-teal 2s ease-in-out infinite",
        "landing-fade-up": "landing-fade-up 0.75s cubic-bezier(0.22, 1, 0.36, 1) both",
        "landing-float": "landing-float 22s ease-in-out infinite",
        "landing-float-alt": "landing-float-alt 28s ease-in-out infinite",
        "landing-grid-drift": "landing-grid-drift 55s linear infinite",
        "landing-shimmer": "landing-shimmer 4.5s ease-in-out infinite",
        "landing-gradient-text": "landing-gradient-text 8s ease-in-out infinite",
        "landing-orb-pulse": "landing-orb-pulse 6s ease-in-out infinite",
        "landing-bar": "landing-bar 2.4s ease-in-out infinite",
        "landing-sparkle": "landing-sparkle 3.5s ease-in-out infinite",
        "landing-cta-glow": "landing-cta-glow 5s ease-in-out infinite",
      },
    },
  },
  plugins: [tailwindcssAnimate],
} satisfies Config;
