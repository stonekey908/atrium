# Atrium for Claude Code

The Atrium cockpit as a **Claude Code mod**: a live pane inside the terminal
(or the desktop Code tab) showing your Linear sprint, the ticket your branch is
on, the wave PRDs rendered as markdown, and links to the design mockups — plus
the one thing the VS Code extension could never do: the project conventions and
the current ticket are **briefed to the model automatically**, every turn.

It reads and writes Linear through the **Linear MCP connector** you already have
in Claude Code. No API key lives in the mod.

## What you get

| In the pane | How |
| --- | --- |
| **Board** — the current sprint spotlighted, tickets grouped In progress → In review → To do → Done (done collapsed), other waves summarised below | `/atrium` or hotkey `b`; `j`/`k` walk the waves |
| **Working on** — the ticket matching your git branch (or the tracker's own branch name), with a link to Linear | top strip, also pinned in the status line |
| **Ticket detail** — full description as markdown, one-press advance to the next status, the full status picker, a link out | press a ticket row |
| **PRD** — the build PRD (`docs/PRD.md`) and each wave's PRD/TRD docs rendered inline | hotkey `p` |
| **Design** — each wave's mockups as clickable `file://` links (the terminal can't render HTML or images, so they open in your browser) | hotkey `d` |
| **Empty project** — a "Plan the first wave with Claude" button that asks the model to propose Wave 1 tickets following the conventions | shown when the project has no labelled tickets |
| **Refresh** — on demand, after any Linear write the model makes, when a turn ends with a stale board, and optionally on a timer | hotkey `r`, `/atrium refresh` |

What the model gets, in its system prompt once a board has loaded for the repo
(switch off with `briefModel`):

- the **project conventions** (sprint labels, branch naming, where planning
  files live) — the same text the extension's "Copy agent briefing" button
  ships, no pasting required;
- the **live board**: current sprint progress, the ticket on your branch with
  its description, and a nudge to move it along as phases complete.

Deliberately not ported: the drag-and-drop kanban (columns of text don't drag
well), live HTML mockup previews (no iframes in a terminal), and editable PRDs
(edit the file; the pane re-reads it on open).

## Install

Panes draw in a terminal, in the desktop app's local sessions, in VS Code and
in the mobile app. A **cloud session viewed from the app has no drawing
surface**, so there `/atrium` prints the board as text in the transcript
instead (the same output as `/atrium text`).

You need Claude Code 2.1.289 or newer and the **Linear** connector connected
(the mod looks for tools named `mcp__<server>__list_issues`; any server whose
name mentions "linear" is found automatically).

Run a session with the folder as a plugin:

```bash
claude --plugin-dir /path/to/atrium/claude-mod
```

Or keep it on permanently:

```bash
export CLAUDE_CODE_PLUGIN_DIRS=/path/to/atrium/claude-mod
```

Then `/atrium` opens the pane. With no configuration it auto-detects the Linear
project whose name matches your repo folder. If none does, it asks you once
(pick an existing project, create one named after the repo, or "Not now", which
is remembered per repo); the pane always carries the same picker and a
**Create a Linear project** button, and `/atrium project <name>` pins one by
hand. Your choice is kept per repo across sessions.

A repo with no project stays quiet: nothing is briefed to the model and nothing
is written anywhere until you pick or create one.

## Commands

| Command | Does |
| --- | --- |
| `/atrium` | Open the pane (focused) |
| `/atrium board` · `prd` · `design` | Open on that view |
| `/atrium refresh` | Re-pull the board from Linear |
| `/atrium text` | Print the board as text in the transcript (also the automatic fallback where a surface seats no pane) |
| `/atrium project <name>` | Pin the Linear project for this repo |
| `/atrium project create [name]` | Create a Linear project (named after the repo folder by default) and pin it |
| `/atrium brief` | Print the agent briefing as text |

## Configuration

Set these in `/config` (they appear under the plugin's name) or in settings
under `pluginConfigs.atrium`:

| Field | Default | What it does |
| --- | --- | --- |
| `linearServer` | `Linear` | The MCP server name in tool names (`mcp__<server>__…`); auto-detected when a name contains "linear" |
| `project` | `""` (auto) | Pin a Linear project name |
| `wavePrefix` | `ATR Wave` | Sprint-label prefix(es), comma-separated; sprint-ish labels (`Wave 3`, `Sprint 12`, `Phase 2`) are detected when nothing matches |
| `pollSeconds` | `0` | Rolling auto-refresh; `0` = refresh on demand, after Linear writes, and when a turn ends with a board older than two minutes |
| `openOnStart` | `false` | Open the pane at session start (it waits for a terminal wide enough to dock it) |
| `briefModel` | `true` | Add the conventions and the current ticket to the system prompt (only for a repo with a board) |

## Make your repo cockpit-aware

Same conventions as the extension — the pane and the model briefing both rely
on them:

| Artifact | Where Atrium looks |
| --- | --- |
| Build PRD | `docs/PRD.md` |
| Wave PRD | `docs/waves/wave-<n>.md` |
| Further docs (TRDs…) | `docs/waves/wave-<n>-<topic>.md` |
| Mockups | `wave-<n>-<name>.html` / `.png` in `files/`, `docs/`, `mockups/`, `design/` |
| Anything oddly named | map it in `.atrium/waves.json` |

## Development

```bash
claude plugin validate claude-mod   # what the module hooks and calls; anything the engine would refuse
claude plugin test claude-mod       # 25 tests: the pure model, the MCP adapter, wave files, and the pane on terminal + desktop
```

Layout:

- `hooks/register.tsx` — the hooks module: session start, `/atrium`, the pane,
  the status line, the prompt sections, refresh-after-write.
- `hooks/board.ts` — the pure board model (a port of `extension/src/board.ts`).
- `hooks/linear.ts` — Linear through the MCP tools: discovery, paging, mapping, writes.
- `hooks/wave-files.ts` — wave → PRD/docs/mockups resolver over `$.fs`.
- `hooks/briefing.ts` — the conventions text and the live "working on" section.
- `types/index.d.ts` — the state contract (`$.state` keys and their types).
- `tests/` — run with `claude plugin test`.

Once the mod has loaded in a session, the engine lays its type declarations in
`.claude-plugin/types/` (gitignored); `tsc -p claude-mod` then type-checks it.
