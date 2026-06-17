# Atrium — Build PRD

> This is the single build-level PRD for Atrium. It is editable from the cockpit's
> PRD view and synced one-way to the Linear project overview on save. The repo file
> is the source of truth — it evolves as the architecture, features, and direction
> change.

## Concept

Atrium is a **VS Code extension** (not a standalone app) that adds a visual SDLC **cockpit** on top of the Claude Code workflow. The real editor, file explorer, git, integrated terminal, Command Palette, theming, and the whole extension ecosystem are **VS Code's own** — Atrium does not rebuild them. What Atrium adds is the cockpit: a two-tier view of where a project is (Tier-1 pipeline: Plan → Design → UX → Build → UAT → Release) and what you're doing right now (Tier-2 active work: waves, tickets, conversation), driven by Linear + git + the `claude` CLI.

The cockpit is a **React webview** (an Activity-Bar view + a full editor-tab dashboard) backed by a **VS Code extension host** (Node) that brokers data to it. The Claude Code extension (on Open VSX) rides along for the conversation surface.

## Architecture pivot (Decision #11, 2026-06-07)

Atrium **was** a Tauri 2.x desktop app wrapping the `claude` CLI. It is **now** a VS Code extension. The decisive constraint: the product target expanded to the *full* VS Code feature set (real editor, git, terminal, the extension marketplace, multi-root folders) — six of those seven wants are stock VS Code already; only the cockpit is net-new to build. A native rebuild could never deliver "the same extensions." **Staged plan: Stage 1 — ship as a VS Code extension** (real MS Marketplace; redistribution = "install VS Code + the Atrium `.vsix`"). **Stage 2 — graduate to Eclipse Theia** *if/when* it becomes a distributed product (own chrome, single branded download, Open VSX). Raw VS Code fork rejected (worst redistribution + permanent rebase tax).

**Crucial:** the cockpit UI is the SAME React / Vite / Tailwind / design-token stack the Tauri prototype used, so UI-level work ports over unchanged. Only the **host** changed: Tauri Rust shell / sidecar / commands / fs-watcher → VS Code **extension host** (Node) + webview `postMessage`.

## Stack

* VS Code extension host (Node/TypeScript) + a React 19 / Vite / Tailwind webview
* Design tokens ported from the v5 visual contract (shadcn-style HSL CSS vars; webview also inherits VS Code theme variables)
* Source Serif 4 / Inter / JetBrains Mono bundled locally (no CDN)
* `claude` CLI bridged via stream-json from the extension host (bidirectional NDJSON; no PTY scraping)
* History/search persistence: SQLite (FTS5) in the extension host

## The cockpit (current surface)

* **Board** — loop-back return-strip → Working-on strip → project rollup → the current-sprint kanban (drag-to-status / reorder with optimistic Linear write-back) → the horizon wave list with audit-trail ribbons. Click a card or row to open the ticket detail modal (full description + status picker, incl. Cancel). A global sort/filter toolbar narrows and orders the wave lists; canceled/duplicate tickets are hidden by default and revealed by a filter chip.
* **PRD** — the single build PRD (this document), rendered and editable inline, synced to the Linear project overview. Per-wave further docs (TRDs) render read-only below.
* **Design** — mockup/design artifacts grouped by wave, HTML mockups rendered live in sandboxed iframes.

Waves are detected dynamically from Linear labels (`ATR Wave …`). Each wave carries a short description (its label description) shown succinctly on the board.

## Locked decisions (see CLAUDE.md for the full list)

1. Sidecar: bare CLI default (`claude -p` stream-json), Node + Agent SDK fallback
2. State SOT: stream-json drives live UI, SQLite mirrors for search, JSONL is read-only history
3. Auth: inherit existing `claude auth` session
4. Mode pill → `--permission-mode={default,acceptEdits,plan,bypassPermissions}`
5. Two-tier surface: Tier-1 Project Overview pipeline + Tier-2 Active Work canvas
6. Folder primitive: every project = a directory; Linear + git both opt-in at open time
7. Atrium is a LENS over Linear, never a replacement — lightweight writes only (drag → state / wave label / sortOrder / comments, the status picker, and now the PRD + wave-description sync)
8. Atrium is a VS Code extension, not a standalone Tauri app (Decision #11)

## Out of scope (v0.x)

Code signing/notarisation, telemetry, multi-user, sharing, Theia graduation (Stage 2, later).
