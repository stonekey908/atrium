# Atrium — Build Spec

*A native, refined wrapper for Claude Code. Single-user, custom build.*

> **Visual contract:** `atrium.html` is the design source of truth. Deviate where reality forces it; document why.

---

## Stack decisions (locked)

| Concern | Choice | Why |
|---|---|---|
| Shell | **Tauri 2.x** | Native chrome, small binary, Rust IPC, better than Electron for personal tool |
| Frontend | **React 18 + Vite + TypeScript** | Familiar, fast HMR |
| Styling | **Tailwind + tokens from HTML mockup** | Mockup uses CSS vars; port them to `tailwind.config` |
| State | **Zustand** | Lighter than Redux, fits single-user scope |
| Animation | **Framer Motion** | Drawer slides, mode pill morphs, screenshot lifts |
| Terminal | **xterm.js + node-pty (Rust side)** | Real PTY in the drawer |
| CLI bridge | **Tauri sidecar `claude`, stream-json protocol** | Spawn `claude -p --input-format=stream-json --output-format=stream-json --include-hook-events --verbose`. Bidirectional NDJSON. No TTY scraping. |
| Permission flow | **SDK `canUseTool` callback (Node sidecar) OR stream-json control messages** | Decide before Wave 1 — see "Decisions to lock". Default: bare CLI + stream-json. |
| Storage | **SQLite via tauri-plugin-sql** | Sessions, transcripts, FTS5 search |
| Markdown | **react-markdown + remark-gfm + shiki** | Rendering + syntax highlighting |
| Diff render | **diff2html or custom** | Custom is probably worth it for the look |
| Fonts | Source Serif 4 / Inter Tight / JetBrains Mono | Bundled, not CDN |

**Out of scope for v0.x:** signing/notarisation, auto-updates, telemetry, multi-user, sharing.

---

## Core architecture

```
┌─────────────────────────────────────┐
│  React frontend (Tauri webview)     │
│  - Conversation pane (markdown)     │
│  - Right rail (Files / MCP / Ctx)   │
│  - Sessions sidebar                 │
│  - Composer + ⌘K palette            │
└──────────────┬──────────────────────┘
               │ Tauri commands + events
┌──────────────▼──────────────────────┐
│  Rust core (src-tauri)              │
│  - Spawn `claude` with stream-json  │
│  - Read NDJSON from stdout          │
│  - Write user-turn JSON to stdin    │
│  - Map to typed events: `assistant`,│
│    `tool_use`, `tool_result`,       │
│    `permission_required`,           │
│    `question_asked`, `hook_event`   │
│  - Approve permissions via SDK      │
│    `canUseTool` (or stream-json     │
│    control reply)                   │
│  - SQLite for history/search        │
│  - PTY manager for terminal drawer  │
│  - File watcher for right rail      │
└─────────────────────────────────────┘
```

**Key insight:** Atrium does not reimplement Claude Code. It spawns the real binary and renders its output prettier. The CLI exposes a structured stream-json protocol on stdout/stdin — every assistant turn, tool call, tool result, hook event, and permission denial is a typed JSON line. Permission and interactive-question flows go: CLI emits a `tool_use` (or `permission_required` denial) → Rust parses → React shows the matching card → user clicks → Rust replies via `canUseTool` (for permissions) or via a `tool_result` JSON message on stdin (for `AskUserQuestion`-style turns). No TTY scraping, no `y/n` keystrokes.

### Surfaces beyond the conversation

The CLI emits structured `tool_use` events for several interaction types. Atrium maps each to a card component — all sharing the same visual family (cream surface, line-bordered, mono context strip, serif italic body where it earns its place):

| CLI event | Card type | Visual cue |
|---|---|---|
| `tool_use` Edit/Write/MultiEdit | Diff card | Green/red soft tints, double line gutters, +/− counts |
| `tool_use` Bash/Read/Grep/Glob | Tool card | Monospace command, status pill (running/ok/error) |
| `permission_required` (denial in stream) | Permission card | Amber accent, Allow once / for session / always / Deny |
| `tool_use` `AskUserQuestion` | **Question card** | Amber accent, serif italic question line, radio/multi-select options, free-text "Other" field |
| `result.permission_denials[]` | Inline denial banner | Red accent, "request approval" CTA |
| Hook events (`--include-hook-events`) | Inline timeline pill | Subtle ink-3, mono, expandable |

This means Claude can hold a contextualised interview *inside the same surface* — no separate modal, no tab switch. Claude asks → user picks an option → Claude continues. Same chrome, same scroll, same memory.

### Session spawn (one-touch)

A new session is born from three entry points: the workspace sidebar's `+`, the cover screen's "Open my first session", or `⌘N` from anywhere.

The spawn dialog asks two questions:
1. **Where?** — recent folders + native picker. Default is the active workspace's root.
2. **How?** — three radio options:
   - *Plain* — current directory, current branch, no tmux
   - *Worktree* — `git worktree add` on a fresh `feat/<name>` branch (passes `--worktree <name>` to the CLI)
   - *Worktree + tmux* — same as Worktree, plus opens a tmux session the terminal drawer attaches to (passes `--worktree <name> --tmux`)

On confirm, Atrium:
- Spawns the CLI sidecar with the chosen flags + a fresh `--session-id <uuid>`
- Detects git state (`git rev-parse`, `git status --porcelain`, `git rev-list --left-right --count @{u}...HEAD`) and populates the title-bar crumb (workspace · branch chip · ahead/behind/dirty indicator · session title)
- Persists the session row in SQLite
- Routes the user into the conversation pane

The title-bar crumb refreshes on file-watcher events (debounced 500ms) so dirty/clean state and branch stay live without polling.

---

## Wave plan

### Wave 0 — Shell (1–2 evenings)
**Goal:** Tauri window opens, fonts load, three-column layout matches mockup, no logic.

- T-001: Tauri scaffold, Vite + React + Tailwind
- T-002: Port design tokens from `atrium.html` into `tailwind.config.ts`
- T-003: Bundle Source Serif 4, Inter Tight, JetBrains Mono locally
- T-004: Three-column layout (sidebar 220 / main 1fr / right rail 320)
- T-005: Title bar with traffic lights, breadcrumb, model pill (static)
- T-006: Cover/launch screen as default route
- T-007: Session spawn dialog — folder picker (recent + native), git detection on selected path, mode radio (Plain / Worktree / Worktree + tmux), session-name field. Triggered from sidebar `+`, cover CTA, or `⌘N`
- T-008: Title-bar git status — branch chip, ahead/behind/dirty indicator, refreshes on file-watcher events (debounced 500ms)

**Done when:** screenshots match mockup hero shot at static-state fidelity, and clicking `+` opens a working spawn dialog that lands the user in an empty conversation pane with the right git crumb.

---

### Wave 1 — CLI bridge + transcript rendering (1 weekend)
**Goal:** Type a message, see Claude's reply rendered as proper markdown.

- T-101: Rust: spawn `claude --print --input-format=stream-json --output-format=stream-json --include-hook-events --verbose --session-id <uuid>` as sidecar; set `cwd` to workspace path; capture stdin/stdout handles
- T-102: Rust: read newline-delimited JSON from CLI stdout; write user-turn JSON messages to stdin; emit typed `cli-event` to frontend per line
- T-103: TypeScript: stream-json event types (`system/init`, `assistant`, `user/tool_result`, `tool_use`, `result`, `rate_limit_event`, `system/hook_started`, `system/hook_response`)
- T-104: Conversation pane: render turns with role badge, timestamp, body
- T-105: Markdown rendering with `react-markdown` + GFM + shiki for code blocks
- T-106: Composer: textarea, autosize, Cmd+Enter to send, pipe to Rust
- T-107: Auto-scroll to bottom on new turn, with "scroll to bottom" affordance

**Done when:** you can hold a real conversation with Claude through Atrium.

---

### Wave 2 — Tool calls + diff cards + permissions (1 weekend)
**Goal:** Tool calls render as cards, diffs look like the mockup, permission modals work.

- T-201: Tool call card component (collapsed by default, expandable, status indicator)
- T-202: Diff card component — file header, double line gutters (old/new), syntax-highlighted body, +/− counts
- T-203: Special-case `Edit`, `MultiEdit`, `Write` tools to render as diff cards
- T-204: Permission card — match mockup exactly (file path, command, Allow once / Allow for session / Always allow / Deny / Edit command)
- T-205: Wire approval to the SDK `canUseTool` callback (or stream-json control reply, depending on Decisions §1) — triggered by `permission_required` events parsed from the stream
- T-206: **Question card (`AskUserQuestion`)** — render the question text in serif italic, options as radios (or checkboxes for multi-select), an optional free-text "Other" field, and a Submit action. On submit, emit a `user/tool_result` JSON message keyed to the same `tool_use_id` back to the CLI's stdin. Same visual family as permission cards, amber accent, question-mark icon.
- T-207: Tool result rendering (collapsed text, expandable)
- T-208: Inline denial banner for `result.permission_denials[]` — red accent, "request approval" CTA that re-runs the tool with permission

**Done when:** a refactor session looks like the mockup at section 02, *and* an interview-style multi-question turn renders as inline cards (no modal).

---

### Wave 3 — Composer extras (1 evening)
**Goal:** Screenshot paste, mode pill, slash commands.

- T-301: Cmd+V on image → upload to CLI as image input
- T-302: Drag-drop file/image onto composer
- T-303: Mode pill (Ask / Edit / Plan / Auto) — persists per session
- T-304: `/` triggers slash command menu inline (not ⌘K)

---

### Wave 4 — ⌘K palette + right rail (1 weekend)
**Goal:** ⌘K opens palette, right rail tabs work.

- T-401: ⌘K command palette (cmdk library) — sections: commands, files, MCP toggles, model switch
- T-402: File mention via `@` in composer
- T-403: Right rail: Files tab — list of files touched in session, click to expand inline
- T-404: Right rail: MCP tab — connected servers, tool inventory, toggle per session
- T-405: Right rail: Context tab — token count, system prompt preview, skills loaded

---

### Wave 5 — Settings (1 weekend)
**Goal:** First-class settings for everything in `~/.claude/`.

- T-501: Settings shell — left nav (Model & Prompt, Permissions, MCP, Skills, Hooks, Workspaces, Appearance, About)
- T-502: Read/write `~/.claude/settings.json` and project `CLAUDE.md`
- T-503: Model & Prompt tab — model selector, system prompt editor, env vars
- T-504: Permissions tab — allow/deny patterns, dangerous tool list
- T-505: MCP tab — installed servers (read from settings), toggle, configure
- T-506: Appearance — light/dark/auto, font size

**Out of scope for v0.x:** the MCP marketplace UI from mockup section 06. Use a stub that lists installed servers only.

---

### Wave 6 — Terminal drawer (1 evening)
**Goal:** ⌘⇧T opens xterm.js drawer at the bottom.

- T-601: Drawer component, slide-up animation (Framer Motion, 240ms ease-out)
- T-602: xterm.js + node-pty via Rust. If the session was spawned with `--tmux`, attach to the named tmux session (`tmux attach -t <session-name>`); otherwise spawn a plain zsh in the workspace cwd
- T-603: Resize handle, double-click to maximise, ESC to close
- T-604: Multiple shell tabs (deferred — start with one). When tmux is in use, tabs map to tmux windows.

---

### Wave 7 — History + search (1 evening)
**Goal:** Past sessions browsable and searchable.

- T-700: On startup, scan `~/.claude/projects/<workspace-id>/*.jsonl` and import historical sessions into SQLite (idempotent; re-read on session resume)
- T-701: SQLite schema: `sessions`, `turns`, `turns_fts` (FTS5)
- T-702: Index turns into FTS5 as they arrive
- T-703: History view — workspace filter sidebar, session list grouped by day
- T-704: ⌘K integration — search transcripts as a section
- T-705: Star/archive sessions

---

### Wave 8 — Polish (ongoing)
- T-801: Dark theme (mockup section 08 has the spec)
- T-802: Onboarding flow (mockup section 09)
- T-803: Plan mode UI (mockup section 05) — only after Anthropic exposes plan-mode JSONL events
- T-804: Empty states everywhere
- T-805: Error states (CLI crashed, file not found, etc.)
- T-806: Keyboard shortcut reference sheet (`?` to open)

---

## Decisions to lock before Wave 0

1. **SDK vs bare CLI as sidecar.**
   - **(a) Bare CLI** (default): Spawn `claude -p --input-format=stream-json --output-format=stream-json` from Rust. One process, smaller binary. Permission approval flows through stream-json control replies.
   - **(b) Node sidecar + Claude Agent SDK**: Wrap the CLI behind a Node process that uses the SDK with a `canUseTool` callback. Typed events, simpler permission API, two processes (Rust + Node).
   - **Default: (a).** Switch to (b) only if stream-json's permission/question reply path proves limiting in the Wave 1 spike.
2. **State source of truth.** Stream-json drives the live UI. SQLite mirrors for search/history. JSONL files in `~/.claude/projects/` are the CLI's own concern — read them on startup for history import (T-700); never write to them.
3. **Auth.** Atrium does *not* implement OAuth. It inherits the CLI's existing session — run `claude auth login` once outside Atrium. The onboarding flow's "Use existing Claude session" path is the only path for v0.1.
4. **Permission modes ↔ mode pill.** The composer's `Ask · Edit · Plan · Auto` pill maps directly to `--permission-mode={default,acceptEdits,plan,bypassPermissions}` on session spawn. Switching mid-session may require a session restart — verify in Wave 1.
5. **CLI version pinning.** Pin the bundled `claude` binary to a tested version per Atrium release. On startup, parse `claude --version` and warn if the user's installed CLI is outside the tested range.
6. **tmux mode default.** Spawn dialog's *Worktree + tmux* option uses `--tmux` (iTerm2 native panes when available; classic tmux otherwise). Override per session in the dialog. Drawer attaches via `tmux attach -t <name>` from xterm.js. *Plain* mode skips tmux entirely.

---

## Risks & open questions

| Risk | Mitigation |
|---|---|
| Stream-json schema drift between CLI versions | Pin CLI version (Decisions §5); add startup version check; fall back to raw text view if an unknown event type appears |
| Image input via stream-json — base64 vs file-ref shape unverified | **Spike before Wave 3.** Fallback: write paste to a temp file and reference by path. |
| `AskUserQuestion` reply schema not yet documented | **Spike during Wave 2.** Mirror the `tool_result` shape used elsewhere; verify by sending a minimal reply and observing the next assistant turn. |
| MCP server discovery requires running the CLI's own commands | Read settings.json directly; don't try to introspect runtime |
| Diff rendering edge cases (binary files, huge diffs, renames) | Fall back to raw text view; don't block Wave 2 on perfection |
| Mode-pill change mid-session may not take effect without a respawn | Either restart the sidecar on mode change, or expose mode change as a stream-json control message if the CLI supports it (verify) |

**Spikes resolved:** PTY wrapping is *not* needed — the CLI exposes a structured stream-json protocol on stdout/stdin, and permission denials surface as typed events with `permission_denials[]` in the `result` payload. Architecture stands.

---

## What this spec deliberately does not include

- A storefront, signing, or distribution plan — this is for you, on your machine
- Telemetry, error reporting, or analytics
- Multi-user support, account systems, or sharing
- Mobile companion (Lookout already covers that)
- Deep IDE features (file editor, find/replace across project) — Atrium is a chat surface, not a code editor

---

## Definition of done (v0.1)

You can use Atrium instead of `claude` in the terminal for a full work session, and you prefer it. Specifically:

- Hold a multi-turn conversation in a workspace
- See diffs render properly
- Approve/deny permissions via modal
- See structured questions from Claude (`AskUserQuestion`) render as inline cards in the conversation, not modals or terminal prompts
- Switch sessions without losing state
- Open ⌘K and find a past session by content
- Drop into the terminal drawer when needed
- See per-turn cost and token usage (from `result.usage` / `total_cost_usd`) in the right rail Context tab

Everything else is gravy.
