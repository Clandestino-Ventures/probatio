/**
 * SPECTRA — Tailwind CSS Configuration
 *
 * Defines all brand tokens: colors, typography, spacing, border radius,
 * and animation timings derived from brand/tokens.json.
 *
 * Tailwind CSS v4 uses CSS-first configuration via @theme directives.
 * This JS config is loaded via `@config` in globals.css for cases that
 * need programmatic access (e.g. plugins, content paths).
 *
 * The primary theme definition lives in src/app/globals.css using
 * @theme inline blocks. This file serves as the canonical reference
 * for all design tokens and can be consumed by tooling.
 */

import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/**/*.{ts,tsx,js,jsx,mdx}",
    "./app/**/*.{ts,tsx,js,jsx,mdx}",
  ],
  theme: {
    extend: {
      // ── Colors ──────────────────────────────────────────────────────
      colors: {
        // Primary palette
        obsidian: "#0A0A0B",
        bone: "#F5F0EB",
        "signal-red": "#E63926",
        "forensic-blue": "#2E6CE6",
        "evidence-gold": "#C4992E",

        // Extended palette
        carbon: "#161618",
        graphite: "#1E1E21",
        ash: "#8A8A8E",
        slate: "#3A3A3F",
        ivory: "#FAF8F5",

        // Risk levels
        risk: {
          low: "#22C55E",
          moderate: "#F59E0B",
          high: "#F97316",
          critical: "#E63926",
        },

        // Semantic aliases
        background: "var(--color-background)",
        foreground: "var(--color-foreground)",
        muted: {
          DEFAULT: "#3A3A3F",
          foreground: "#8A8A8E",
        },
        accent: {
          DEFAULT: "#2E6CE6",
          foreground: "#F5F0EB",
        },
        destructive: {
          DEFAULT: "#E63926",
          foreground: "#F5F0EB",
        },
        border: "#3A3A3F",
        input: "#3A3A3F",
        ring: "#2E6CE6",
      },

      // ── Typography ─────────────────────────────────────────────────
      fontFamily: {
        display: [
          "Instrument Serif",
          "Playfair Display",
          "Georgia",
          "serif",
        ],
        sans: [
          "Geist",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
        mono: [
          "Geist Mono",
          "JetBrains Mono",
          "Fira Code",
          "monospace",
        ],
      },

      fontSize: {
        xs: ["0.75rem", { lineHeight: "1rem" }],
        sm: ["0.875rem", { lineHeight: "1.25rem" }],
        base: ["1rem", { lineHeight: "1.5rem" }],
        lg: ["1.25rem", { lineHeight: "1.75rem" }],
        xl: ["1.5rem", { lineHeight: "2rem" }],
        "2xl": ["2rem", { lineHeight: "2.25rem" }],
        "3xl": ["2.5rem", { lineHeight: "2.75rem" }],
        "4xl": ["3.5rem", { lineHeight: "3.75rem" }],
        "5xl": ["4.5rem", { lineHeight: "1.1" }],
      },

      lineHeight: {
        tight: "1.1",
        snug: "1.25",
        normal: "1.5",
        relaxed: "1.625",
      },

      letterSpacing: {
        tight: "-0.02em",
        normal: "0",
        wide: "0.02em",
        wider: "0.05em",
        widest: "0.1em",
      },

      // ── Spacing ────────────────────────────────────────────────────
      spacing: {
        "component-xs": "12px",
        "component-sm": "16px",
        "component-md": "20px",
        "component-lg": "24px",
        "section-sm": "48px",
        "section-md": "64px",
        "section-lg": "96px",
        "section-xl": "128px",
      },

      maxWidth: {
        dashboard: "1280px",
        prose: "960px",
      },

      // ── Border Radius ──────────────────────────────────────────────
      borderRadius: {
        sm: "4px",
        md: "8px",
        lg: "12px",
        full: "9999px",
      },

      // ── Animations & Transitions ───────────────────────────────────
      transitionDuration: {
        micro: "200ms",
        reveal: "400ms",
        page: "600ms",
      },

      transitionTimingFunction: {
        "ease-out-spectra": "cubic-bezier(0.16, 1, 0.3, 1)",
      },

      keyframes: {
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "fade-up": {
          from: { opacity: "0", transform: "translateY(16px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "fade-down": {
          from: { opacity: "0", transform: "translateY(-16px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "slide-in-right": {
          from: { opacity: "0", transform: "translateX(24px)" },
          to: { opacity: "1", transform: "translateX(0)" },
        },
        "slide-in-left": {
          from: { opacity: "0", transform: "translateX(-24px)" },
          to: { opacity: "1", transform: "translateX(0)" },
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.95)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        "pulse-risk": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.6" },
        },
        "progress-bar": {
          from: { width: "0%" },
          to: { width: "var(--progress-width, 100%)" },
        },
        "spin-slow": {
          from: { transform: "rotate(0deg)" },
          to: { transform: "rotate(360deg)" },
        },
      },

      animation: {
        "fade-in": "fade-in 400ms ease-out",
        "fade-up": "fade-up 400ms ease-out",
        "fade-down": "fade-down 400ms ease-out",
        "slide-in-right": "slide-in-right 400ms ease-out",
        "slide-in-left": "slide-in-left 400ms ease-out",
        "scale-in": "scale-in 200ms ease-out",
        "pulse-risk": "pulse-risk 2s ease-in-out infinite",
        "progress-bar": "progress-bar 600ms ease-out forwards",
        "spin-slow": "spin-slow 3s linear infinite",
      },

      // ── Shadows ────────────────────────────────────────────────────
      boxShadow: {
        "card": "0 1px 3px rgba(0, 0, 0, 0.3), 0 1px 2px rgba(0, 0, 0, 0.2)",
        "card-hover": "0 4px 12px rgba(0, 0, 0, 0.4), 0 2px 4px rgba(0, 0, 0, 0.3)",
        "elevated": "0 8px 24px rgba(0, 0, 0, 0.5), 0 4px 8px rgba(0, 0, 0, 0.3)",
        "glow-blue": "0 0 20px rgba(46, 108, 230, 0.3)",
        "glow-red": "0 0 20px rgba(230, 57, 38, 0.3)",
        "glow-gold": "0 0 20px rgba(196, 153, 46, 0.3)",
      },
    },
  },
  plugins: [],
};

export default config;
