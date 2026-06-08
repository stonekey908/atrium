# Atrium — Native Chat Surface Architecture

> **⚠️ SUPERSEDED (2026-06-07, same day) by CLAUDE.md Decision #11 / `files/atrium-ide-architecture.md`.**
> Requirements expanded beyond "the chat feel" to the full VS Code feature set
> (editor + git + terminal + extension ecosystem + the Claude Code extension +
> multi-root) plus the cockpit — which retires the native-Tauri path. Atrium is
> now a **VS Code extension** (Stage 1) → **Eclipse Theia** if it becomes a product
> (Stage 2); runnable POC in `extension/`. **What still applies from this doc:**
> the stream-json **event → UI mapping** below is the contract for any
> Atrium-rendered conversation surface (Wave 1). The "why not extension/fork"
> argument here is reversed — see Decision #11.

**Status:** ~~Decided 2026-06-07. Direction confirmed by Nicholas: stay native (Tauri).~~ Superseded — see banner.
**Visual contract:** `files/atrium-chat.html`
**Implements toward:** Wave 1 (CLI bridge), gated by spike T-110 / STO-2146.

## The decision in one line

Atrium's chat is a **native renderer over the `claude` stream-json protocol**, built to *match the feel* of the Claude Code VS Code panel — **not** a VS Code extension, and **not** a VS Code fork.

## Why not fork VS Code, why not ship as an extension

The thing that makes the Claude Code VS Code chat feel good is not VS Code. The
extension **bundles the same `claude` binary** and renders a **webview** panel
that speaks to it; VS Code contributes a sidebar slot to host the webview and a
hidden local MCP server (`ide`) for native diffs, selection-as-@-mention, and
cell execution. The chat surface is therefore **a web UI rendering NDJSON from a
CLI** — exactly the bridge Atrium already scoped in Wave 1.

| Option | Verdict |
|---|---|
| **Fork VS Code** (Cursor/Windsurf model) | Rejected. Justified only when the *editor itself* is the product. Atrium is a cockpit, not an editor — forking means inheriting a multi-MLOC editor then hiding it, and re-merging upstream forever for depth we don't use. |
| **Ship as a VS Code extension** | Rejected. Closest to "identical" chat, but the cockpit becomes a panel inside someone else's frame — no borderless window, no custom rail-as-surface, taste-moat gone. Fights Decision #7/#8. |
| **Native renderer over stream-json (this doc)** | **Chosen.** Keeps the custom chrome and two-tier cockpit; the chat panel *is* the conversation strip (STO-2164) elevated to a surface. ~90% of the extension's feel reproduced in our own frame. |

The chat panel being "just a webview over the CLI" is the good news that makes
the native path cheap: we render the *same events*, we just own the frame.

## What we give up (named honestly)

- **Never byte-identical**, and we chase a moving target as the extension evolves
  (the 2026 upgrades — session list, plan view, compaction cards — are features we
  re-implement, but arguably do better on a real canvas than in a 300px sidebar).
- **No free editor.** @-mentions / open-diff that VS Code gives the extension for
  free, we wire to our own LeftRail file tree (STO-2163) and diff renderer.

## Architecture — the renderer is the whole game

```
 claude -p  ──stdout NDJSON──▶  EventReducer (TS)  ──▶  React chat surface
   (sidecar)                     typed events            (atrium-chat.html)
       ▲                                                       │
       └────────── stdin: user turns + permission decisions ◀──┘
```

Spawn (per Locked Decision #1):

```
claude -p --input-format=stream-json --output-format=stream-json \
       --include-hook-events --verbose
```

### Event → UI mapping (the contract)

| stream-json event | Rendered as |
|---|---|
| `assistant` message deltas | streaming prose + blinking caret |
| `thinking` / reasoning | collapsible muted reasoning block |
| `tool_use` Read / Grep / Glob | collapsible tool card; `tool_result` folds in under it |
| `tool_use` Edit / Write | **inline diff, our own renderer** (no VS Code diff viewer) |
| `tool_use` Bash | terminal-styled output pane |
| `tool_use` ExitPlanMode | plan card with Approve / Keep-planning / Edit |
| `permission_denials[]` / `canUseTool` callback | inline Allow / Allow-always / Deny chips |
| `result.usage` | context pill in the title bar |
| `compact_boundary` | compaction divider |

### State (per Locked Decision #2)
- **stream-json** drives the live UI (source of truth for the conversation).
- **SQLite** mirrors for search/history.
- **JSONL** is read-only history.

### Permissions (per Known Gotchas)
`claude -p` default mode **auto-denies** permissioned tools. The only working
path is to answer the permission decision back over stdin (or the SDK
`canUseTool` callback). The inline Allow/Deny chips in the mockup *are* that
decision surface.

## First implementation slice

1. **Run spike T-110 / STO-2146** — does a mid-session permission-mode change need
   a respawn? Gates the mode-pill behaviour. (~30 min.)
2. **EventReducer** — spawn the sidecar, parse NDJSON into typed events, unit-test
   the reducer against captured fixtures (no UI needed).
3. **Render slice** — assistant text + tool-call cards. *This single slice is the
   recognizable chat experience.*
4. Layer in diff rendering → plan card → permission chips → thinking/compaction.

## Open questions

- **Markdown renderer** — pick one that streams safely (incremental, no FOUC on
  partial fenced code blocks).
- **Diff library vs. hand-rolled** — `tool_result` for Edit gives us old/new; a
  small hand-rolled line-differ may beat a dependency for our look.
- **Branch rename** — `claude/vs-plugin-architecture-FyCiv` is now a misnomer;
  the work is native. Rename or fold into a Wave 1 feature branch.
