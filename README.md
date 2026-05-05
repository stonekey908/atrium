# Atrium

A native, refined desktop wrapper for [Claude Code](https://claude.com/claude-code) — and a visual SDLC cockpit for the loop around it.

The PTY is a drawer, not a surface.

## What this is

Atrium spawns the real `claude` CLI as a Tauri sidecar (stream-json protocol) and renders its output as a refined conversation surface — diff cards instead of raw text, permission/question cards instead of TTY prompts, full Linear and git visibility on every canvas, drag-to-reorder ticket queues, screenshot-driven UAT.

Wraps, never replaces. The CLI binary stays the source of truth; Atrium is editorial chrome.

## Status

Pre-alpha. Wave 0 (foundations) in flight. See [`CLAUDE.md`](./CLAUDE.md) for the project handoff, locked decisions, current phase, and ticket pipeline.

## Stack

- **Tauri 2.x** (Rust core)
- **React 19** + **Vite 7** + **TypeScript 5.8**
- **Tailwind v3** with project design tokens (Wave 0 / T-002)
- **Bun** as package manager and JS runtime
- **Linear MCP** for ticket sync
- **SQLite (Wave 7)** as the local mirror for search

## Getting started

See [`SETUP.md`](./SETUP.md) — covers Bun, Rust, platform build tools, and how to get a dev window running.

Short version, if your toolchain is already installed:

```bash
bun install
bun tauri dev
```

## Visual contract

The current visual contract is [`files/atrium-v5.html`](./files/atrium-v5.html). Open it in a browser to see the full surface — Tier-1 project pipeline, Tier-2 active-work canvases, conversation strip, Wave & ticket rail (toggle Waves ↔ Files), screenshot UAT flow, and ⌘K palette.

When in doubt about visual fidelity, the v5 mockup wins. When in doubt about behaviour, [`files/atrium-spec.md`](./files/atrium-spec.md) wins (Decisions §1–6).

## Project documents

| File | What it is |
|---|---|
| [`CLAUDE.md`](./CLAUDE.md) | Project handoff, locked decisions, current phase, last session |
| [`SETUP.md`](./SETUP.md) | One-time install + each-time-you-pull steps |
| [`.env.example`](./.env.example) | Environment variables (currently none required) |
| [`files/atrium-v5.html`](./files/atrium-v5.html) | Current visual contract |
| [`files/atrium-spec.md`](./files/atrium-spec.md) | Build spec (Decisions + technical architecture) |

## Out of scope (v0.x)

Code signing/notarisation, telemetry, multi-user, sharing, plan-mode UI. Personal/fun project — moat is taste, not capability.

## License

Private repo, no public license yet.
