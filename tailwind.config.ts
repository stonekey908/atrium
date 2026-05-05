import type { Config } from "tailwindcss";

/**
 * Atrium design tokens — ported from `files/atrium-v5.html` :root block.
 * Pattern: shadcn-style CSS variables in src/index.css → consumed here via
 * `hsl(var(--name) / <alpha-value>)` so opacity utilities work.
 *
 * Three layers of tokens:
 *   1. Surface (background, foreground, muted, accent, border, ring, primary)
 *   2. Stage accents (emerald, amber, rose, indigo, violet, orange) +
 *      semantic stage aliases (stage-plan / build / uat / design / ux)
 *   3. Typography, radius, motion
 */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Surface — shadcn slate, light variant
        background: "hsl(var(--background) / <alpha-value>)",
        foreground: "hsl(var(--foreground) / <alpha-value>)",
        muted: {
          DEFAULT: "hsl(var(--muted) / <alpha-value>)",
          foreground: "hsl(var(--muted-foreground) / <alpha-value>)",
        },
        popover: {
          DEFAULT: "hsl(var(--popover) / <alpha-value>)",
          foreground: "hsl(var(--popover-foreground) / <alpha-value>)",
        },
        card: {
          DEFAULT: "hsl(var(--card) / <alpha-value>)",
          foreground: "hsl(var(--card-foreground) / <alpha-value>)",
        },
        border: "hsl(var(--border) / <alpha-value>)",
        input: "hsl(var(--input) / <alpha-value>)",
        primary: {
          DEFAULT: "hsl(var(--primary) / <alpha-value>)",
          foreground: "hsl(var(--primary-foreground) / <alpha-value>)",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary) / <alpha-value>)",
          foreground: "hsl(var(--secondary-foreground) / <alpha-value>)",
        },
        accent: {
          DEFAULT: "hsl(var(--accent) / <alpha-value>)",
          foreground: "hsl(var(--accent-foreground) / <alpha-value>)",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive) / <alpha-value>)",
          foreground: "hsl(var(--destructive-foreground) / <alpha-value>)",
        },
        ring: "hsl(var(--ring) / <alpha-value>)",
        subtle: "hsl(var(--subtle) / <alpha-value>)",

        // Stage accents — productive, slightly desaturated
        emerald: {
          DEFAULT: "hsl(var(--emerald) / <alpha-value>)",
          soft: "hsl(var(--emerald-soft) / <alpha-value>)",
          border: "hsl(var(--emerald-border) / <alpha-value>)",
        },
        amber: {
          DEFAULT: "hsl(var(--amber) / <alpha-value>)",
          soft: "hsl(var(--amber-soft) / <alpha-value>)",
          border: "hsl(var(--amber-border) / <alpha-value>)",
        },
        rose: {
          DEFAULT: "hsl(var(--rose) / <alpha-value>)",
          soft: "hsl(var(--rose-soft) / <alpha-value>)",
          border: "hsl(var(--rose-border) / <alpha-value>)",
        },
        indigo: {
          DEFAULT: "hsl(var(--indigo) / <alpha-value>)",
          soft: "hsl(var(--indigo-soft) / <alpha-value>)",
          border: "hsl(var(--indigo-border) / <alpha-value>)",
        },
        violet: {
          DEFAULT: "hsl(var(--violet) / <alpha-value>)",
          soft: "hsl(var(--violet-soft) / <alpha-value>)",
          border: "hsl(var(--violet-border) / <alpha-value>)",
        },
        orange: {
          DEFAULT: "hsl(var(--orange) / <alpha-value>)",
          soft: "hsl(var(--orange-soft) / <alpha-value>)",
        },

        // Stage semantic aliases — use these in code, not the raw colour name
        "stage-plan": "hsl(var(--violet) / <alpha-value>)",
        "stage-plan-bg": "hsl(var(--violet-soft) / <alpha-value>)",
        "stage-design": "hsl(var(--orange) / <alpha-value>)",
        "stage-design-bg": "hsl(var(--orange-soft) / <alpha-value>)",
        "stage-ux": "hsl(var(--indigo) / <alpha-value>)",
        "stage-build": "hsl(var(--emerald) / <alpha-value>)",
        "stage-build-bg": "hsl(var(--emerald-soft) / <alpha-value>)",
        "stage-uat": "hsl(var(--amber) / <alpha-value>)",
        "stage-uat-bg": "hsl(var(--amber-soft) / <alpha-value>)",
      },
      fontFamily: {
        // Variable woff2 packages name their @font-face with the "Variable"
        // suffix (e.g. "Source Serif 4 Variable") to disambiguate from the
        // static-weight @fontsource releases. Lead with the suffixed name so
        // the local woff2 wins; bare names + ui-serif/sans/monospace are the
        // fallback chain if @fontsource fails to load.
        serif: [
          '"Source Serif 4 Variable"',
          '"Source Serif 4"',
          "ui-serif",
          "Georgia",
          "Cambria",
          "Times New Roman",
          "Times",
          "serif",
        ],
        sans: [
          '"Inter Variable"',
          '"Inter"',
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "sans-serif",
        ],
        mono: [
          '"JetBrains Mono Variable"',
          '"JetBrains Mono"',
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Consolas",
          "monospace",
        ],
      },
      fontSize: {
        // Project-specific micro sizes used in the v5 mockup.
        "2xs": ["10px", { lineHeight: "1.4" }],
      },
      borderRadius: {
        sm: "4px",
        DEFAULT: "6px",
        md: "8px",
        lg: "10px",
      },
      transitionTimingFunction: {
        ease: "cubic-bezier(0.4, 0, 0.2, 1)",
        "ease-emph": "cubic-bezier(0.16, 1, 0.3, 1)",
      },
      transitionDuration: {
        // Motion tokens — 120ms hover, 180ms toggle, 240ms drawer (per spec).
        hover: "120ms",
        toggle: "180ms",
        drawer: "240ms",
      },
      spacing: {
        // Project-wide horizontal canvas padding (matches --pad-x in the mockup).
        "pad-x": "56px",
      },
    },
  },
  plugins: [],
} satisfies Config;
