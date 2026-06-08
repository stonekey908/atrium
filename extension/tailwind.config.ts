import type { Config } from "tailwindcss";

/**
 * Atrium design tokens — same shadcn-slate palette as the Tauri app
 * (src/index.css / files/atrium-v5.html). Consumed via
 * `hsl(var(--name) / <alpha-value>)` so opacity utilities work.
 * Content scope is the webview only.
 */
export default {
  content: ["./webview/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background) / <alpha-value>)",
        foreground: "hsl(var(--foreground) / <alpha-value>)",
        muted: {
          DEFAULT: "hsl(var(--muted) / <alpha-value>)",
          foreground: "hsl(var(--muted-foreground) / <alpha-value>)",
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
        accent: {
          DEFAULT: "hsl(var(--accent) / <alpha-value>)",
          foreground: "hsl(var(--accent-foreground) / <alpha-value>)",
        },
        ring: "hsl(var(--ring) / <alpha-value>)",
        subtle: "hsl(var(--subtle) / <alpha-value>)",
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
      },
      fontFamily: {
        sans: ['"Inter Variable"', '"Inter"', "ui-sans-serif", "system-ui", "-apple-system", "sans-serif"],
        mono: ['"JetBrains Mono Variable"', '"JetBrains Mono"', "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      fontSize: {
        "2xs": ["10px", { lineHeight: "1.4" }],
      },
      borderRadius: {
        sm: "4px",
        DEFAULT: "6px",
        md: "8px",
        lg: "10px",
      },
    },
  },
  plugins: [],
} satisfies Config;
