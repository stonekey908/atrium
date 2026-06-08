import type { Config } from "tailwindcss";

/**
 * Theme mapped to VS Code's own theme variables so the cockpit is *identical in
 * look and feel* to the Claude Code panel — it adopts the user's editor theme
 * (dark by default), font, and accent colours. Fallback values keep it legible
 * outside VS Code (e.g. in jsdom tests). These are full colour values, not HSL
 * triples, so no `<alpha-value>` wrapper.
 */
export default {
  content: ["./webview/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "var(--vscode-editor-background, #1e1e1e)",
        "side-bg": "var(--vscode-sideBar-background, #181818)",
        fg: "var(--vscode-foreground, #cccccc)",
        "fg-muted": "var(--vscode-descriptionForeground, #8b8b8b)",
        border: "var(--vscode-panel-border, #2b2b2b)",
        hover: "var(--vscode-list-hoverBackground, #2a2d2e)",
        active: "var(--vscode-list-activeSelectionBackground, #04395e)",
        "active-fg": "var(--vscode-list-activeSelectionForeground, #ffffff)",
        link: "var(--vscode-textLink-foreground, #4daafc)",
        focus: "var(--vscode-focusBorder, #007fd4)",
        badge: "var(--vscode-badge-background, #4d4d4d)",
        "badge-fg": "var(--vscode-badge-foreground, #ffffff)",
        input: "var(--vscode-input-background, #313131)",
        "input-border": "var(--vscode-input-border, #3c3c3c)",
        green: "var(--vscode-charts-green, #89d185)",
        red: "var(--vscode-charts-red, #f14c4c)",
        blue: "var(--vscode-charts-blue, #3794ff)",
        yellow: "var(--vscode-charts-yellow, #cca700)",
        orange: "var(--vscode-charts-orange, #d18616)",
        purple: "var(--vscode-charts-purple, #b180d7)",
      },
      fontFamily: {
        sans: ["var(--vscode-font-family, -apple-system, system-ui, sans-serif)"],
        mono: ["var(--vscode-editor-font-family, ui-monospace, Menlo, monospace)"],
      },
    },
  },
  plugins: [],
} satisfies Config;
