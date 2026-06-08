# Atrium — IDE Architecture (VS Code extension → Theia)

**Status:** Locked 2026-06-07 (CLAUDE.md Decision #10). Direction confirmed by Nicholas.
**Runnable POC:** [`extension/`](../extension/) — F5 to launch.

## The pivot

Atrium's target expanded from "a refined Claude Code chat wrapper" to the **full
VS Code feature set + the Atrium cockpit on top**. The requested capabilities:

| Want | Source |
|---|---|
| File editor + browser | VS Code (Monaco + Explorer) — free |
| Git integration | VS Code SCM — free |
| Integrated terminal (full) | VS Code — free |
| Claude Code plugin | It's a VS Code extension — free |
| Same extension ecosystem | VS Code Marketplace / Open VSX — free |
| Multiple folders in one instance | VS Code multi-root workspaces — free |
| **Linear / PRD / sprint cockpit** | **The only net-new thing we build** |

**Decisive constraint:** VS Code extensions only run inside VS Code or a
VS-Code-compatible runtime. "The same extensions" cannot be reproduced in a
native Tauri rebuild — so the native path is retired. Six of seven wants are
stock VS Code; we build the cockpit.

## Options considered

| Path | Verdict |
|---|---|
| **Native (Tauri)** | ❌ Dead — can't host VS Code extensions; multi-root is hard. |
| **A. VS Code extension** | ✅ **Stage 1.** Everything works immediately + real MS Marketplace; cleanest redistribution ("install VS Code + the `.vsix`"); least chrome control. |
| **B. Fork VS Code** (Cursor model) | ❌ Worst redistribution (strip MS branding, Open VSX only) + permanent upstream-rebase tax. |
| **C. Eclipse Theia** | ✅ **Stage 2** (when it's a product). Own the chrome + branded single download, keep extensions/editor/terminal/multi-root, **no raw-fork rebase tax**. Open VSX. |

## Extensions & the Claude Code question

- Stock VS Code (Stage 1) → the **Microsoft Marketplace** (everything).
- Theia / any fork (Stage 2) → **Open VSX** (MS terms forbid non-MS products
  from using the MS Marketplace; this is why Open VSX exists).
- **The Claude Code extension is on Open VSX**
  (`open-vsx.org/extension/Anthropic/claude-code`) and Anthropic documents it
  installing in VS Code forks; the extension also bundles the CLI, which runs in
  any terminal as a fallback. **So Claude Code rides along on every path.**
- What you *lose* leaving stock VS Code: only Microsoft **first-party**
  extensions — Pylance, the C# debugger, Remote-SSH/Containers, Live Share.
  (Nicholas does not depend on these.)

## Why the staged plan is cheap

The cockpit is a **React webview** built with the *same* stack as the Tauri app
(React 19 + Vite 7 + Tailwind 3 + the shadcn-slate token set). It renders inside
a VS Code webview in Stage 1 and inside a Theia webview in Stage 2 — **the same
React app ports across unchanged.** Stage 1 is not throwaway.

### What carries over from the Tauri work
- ✅ React/Vite/Tailwind cockpit UI, the design tokens, the v5 canvases, Vitest.
- ✅ The Linear integration logic and the wave/sprint/PRD/UAT data model.
- ❌ The Tauri Rust shell (custom traffic lights, borderless window, the
  STO-2099 git-status command/watcher, AppShell, LeftRail-as-filetree) — VS Code
  provides the window, git, terminal, file tree, and watching.

This **reframes Decisions #7–#9** (two-tier surface, folder primitive, wave/ticket
rail): their *intent* stands, but the *host* is the VS Code workbench, not custom
Tauri chrome. The cockpit is a webview view container + an editor-area dashboard
tab living beside real editor tabs, a real terminal panel, and the Claude Code
extension's own chat.

## The POC (`extension/`)

A throwaway proof that the loop works and feels right. See
[`extension/README.md`](../extension/README.md) to run it (F5).

- **Host** (`src/extension.ts`): registers an Activity-Bar **Atrium** view
  container with a **Cockpit** webview, plus an `Atrium: Open Dashboard` command
  that opens the same cockpit as a full editor tab. Brokers webview⇄host
  messages and serves stub data (real workspace folders + stub waves).
- **Webview** (`webview/`): the React cockpit — sprint pipeline, wave cards with
  progress, ticket rows. Clicking a ticket / its ▶ Run button round-trips a
  message to the host (→ VS Code notification).
- **Verified:** Vite (webview) + `tsc` (host) build green; `bun run typecheck`
  clean. Brand token utilities resolve in the built CSS.
- **Gotcha recorded:** the extension package is CommonJS (host must be, for the
  VS Code entry point), so Vite's config is named `vite.config.mts` to force ESM
  loading — same Vite/Node ESM friction noted in the root project.

## Wave 1 — the in-extension conversation surface

The cockpit doesn't rebuild Claude's chat — the **Claude Code extension** provides
it. Atrium's own conversational hooks (e.g. ▶ Run a ticket) drive `claude` via
the stream-json bridge host-side. The event → UI mapping (carried from the
earlier native-chat exploration, still valid) for any Atrium-rendered stream:

| stream-json event | Rendered as |
|---|---|
| `assistant` deltas | streaming text |
| `tool_use` Read/Grep | collapsible tool card + result |
| `tool_use` Edit/Write | inline diff |
| `tool_use` ExitPlanMode | plan card (approve / keep planning) |
| `permission_denials` / `canUseTool` | inline allow / always / deny |
| `result.usage` | context indicator |

Gated by spike **T-110 / STO-2146** (mid-session permission-mode change → respawn?).

## Next steps

1. **Wave 0.5 in the extension** — replace `STUB_WAVES` with live Linear data
   (Linear MCP, called host-side); ticket rows inline-expand to Spec/Tests/Activity.
2. **Wire ▶ Run** to the `claude` stream-json bridge (Wave 1, after T-110).
3. **Stage 2 (deferred)** — lift the cockpit webview into a Theia shell when/if
   Atrium becomes a distributed product.
