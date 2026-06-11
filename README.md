# Atrium Cockpit

**A visual SDLC cockpit for your issue tracker, inside VS Code.**

Atrium turns your sprint board into a first-class VS Code surface: a live kanban
with drag-to-status write-back, your PRDs rendered next to the work, HTML
mockups previewing live as you (or your AI agent) edit them, and a one-click
view of exactly what's being worked on right now. It's a **lens over your
tracker** — it never tries to replace it.

> Built by dogfooding: Atrium's own development was planned, tracked and
> shipped through Atrium.

![The board — sprint kanban, wave list, Working-on strip](docs/screenshots/board.png)

## What you get

- **The Board** — your project grouped into sprints/waves (detected
  automatically from your labels), with the active sprint spotlighted as a
  kanban. Drag cards between columns to update ticket state, drag to reorder,
  drag between waves to promote/demote — all written back live.
- **Working on** — the ticket matching your current git branch, one click from
  its full description.
- **Ticket modal** — click any ticket for its full description rendered as
  proper markdown, with a link out to edit in your tracker.
- **PRD view** — each wave's PRD and TRD docs (plain markdown files in your
  repo) rendered inline, re-rendering live as the files change.
- **Design view** — HTML mockups grouped by the wave that owns them,
  previewing live in sandboxed iframes. Edit the file, watch it re-render.
- **Freshness without ceremony** — the board re-pulls when your window regains
  focus, plus an optional rolling auto-refresh picker right in the status strip.
- **Agent-ready** — a Help (`?`) button copies a paste-able briefing that tells
  any AI assistant how to label tickets, name branches, and place planning
  files so everything shows up here automatically.

![Ticket modal with rendered markdown](docs/screenshots/ticket-modal.png)
![PRD view rendering wave docs](docs/screenshots/prd-view.png)
![Design view with live mockup previews](docs/screenshots/design-view.png)

## Install

1. Grab the `.vsix` from the [latest release](../../releases/latest).
2. Install it:

   ```bash
   code --install-extension atrium-cockpit-<version>.vsix
   ```

   (or in VS Code: Extensions panel → `···` menu → **Install from VSIX…**)
3. Reload the window. The cockpit opens as an editor tab — or click the Atrium
   icon in the Activity Bar, the `$(rocket) Atrium` status-bar button, or press
   `⌘⌥A` / `Ctrl+Alt+A`.

With no configuration you'll see a bundled **demo board** (a fictional project)
so you can feel the surface immediately.

## Connect your own board (Linear)

1. Create a personal API key at [linear.app/settings/api](https://linear.app/settings/api).
2. VS Code Settings → search **atrium** → paste it into **Atrium › Linear: Api Key**.
3. Reload. Atrium auto-detects which Linear project matches your open folder
   (override any time with the project dropdown in the cockpit header).

Sprints/waves are detected from your labels automatically: any label starting
with your configured prefix(es), or — with zero config — anything sprint-ish
like `Sprint 3`, `Wave 0.7`, `Phase 2 · Core`, `sprint-12`. Unmatched tickets
land in a visible "Unsorted" bucket, never lost.

Full setup detail (including per-workspace pinning and the wave-file
conventions): [`extension/SETUP.md`](extension/SETUP.md).

## Make your repo cockpit-aware

Planning artifacts are plain files in your repo:

| Artifact | Where Atrium looks |
|---|---|
| Wave PRD | `docs/waves/wave-<n>.md` |
| Further docs (TRDs…) | `docs/waves/wave-<n>-<topic>.md` |
| Mockups | `wave-<n>-<name>.html` / `.png` in `files/`, `docs/`, `mockups/`, `design/` |
| Anything oddly named | map it in `.atrium/waves.json` |

Working with an AI assistant? Open the cockpit's **? Help** → **Copy agent
briefing** and paste it into your assistant at project start — it teaches the
conventions above plus ticket labelling and branch naming, with no tool-specific
jargon.

## Configuration

| Setting | Default | What it does |
| --- | --- | --- |
| `atrium.linear.apiKey` | — | Personal API key; enables the live board |
| `atrium.linear.projectName` | `""` (auto) | Pin a Linear project for this workspace |
| `atrium.linear.wavePrefix` | `ATR Wave` | Sprint-label prefix(es), comma-separated; auto-detect kicks in when nothing matches |
| `atrium.linear.pollSeconds` | `0` | Rolling auto-refresh (also adjustable from the status strip) |
| `atrium.openOnStartup` | `true` | Open the cockpit tab when VS Code starts |

## Development

The extension lives in [`extension/`](extension/) (React webview + TypeScript
host, built with Bun + Vite + esbuild):

```bash
cd extension
bun install
bun run typecheck && bun test   # 160 tests
bun run build
bunx @vscode/vsce package       # produces the .vsix
```

The `src-tauri/` + root `src/` directories are an earlier standalone-app
prototype, kept for reference; the VS Code extension is the live surface.
Provider portability (Jira etc.) is designed for: reads go through a
`BoardSource` seam and writes through a thin client — an adapter for another
tracker implements those two surfaces.

## License

[MIT](LICENSE)
