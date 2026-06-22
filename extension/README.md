# Atrium Cockpit

A visual SDLC cockpit for your issue tracker, inside VS Code: a live sprint
kanban with drag write-back, your PRDs and HTML mockups rendered next to the
work, and a one-click view of what's being worked on right now. A **lens over
your tracker** — never a replacement for it.

## Quick start

1. Open the cockpit: the Atrium icon in the Activity Bar, the
   `$(rocket) Atrium` status-bar button, or `⌘⌥A` / `Ctrl+Alt+A`. With no
   config you get a bundled demo board (a fictional project) to feel the
   surface.
2. Go live: Settings → **Atrium › Linear: Api Key** → paste a personal key from
   [linear.app/settings/api](https://linear.app/settings/api) → reload. Atrium
   auto-detects the project matching your open folder (header dropdown to
   override, pinned per workspace).
3. Sprints/waves are detected from your labels — configured prefix(es) first
   (`atrium.linear.wavePrefix`, comma-separated), and a zero-config sprint-ish
   fallback (`Sprint 3`, `Wave 0.7`, `sprint-12`…) when nothing matches.
   Unmatched tickets stay visibly Unsorted.

## The views

- **Board** — spotlighted sprint kanban (drag to change state / reorder /
  promote–demote between sprints, written back live), the wave list, and the
  clickable "Working on" strip matched from your git branch. Click any ticket
  for its full description rendered as markdown.
- **PRD** — each wave's `docs/waves/wave-<n>.md` (+ `wave-<n>-*.md` TRDs)
  rendered inline, live-updating as the files change.
- **Design** — `wave-<n>-*.html` mockups grouped by wave, previewing live in
  sandboxed iframes.

Working with an AI assistant? **? Help → Copy agent briefing** gives it the
labelling, branching and file conventions so its work shows up here
automatically. Full setup detail: [SETUP.md](SETUP.md).

## Development

```bash
cd extension
bun install
bun run typecheck && bun run test   # host + webview, 197 tests
bun run build                       # Vite (webview) + esbuild (host)
bunx @vscode/vsce package           # produces the .vsix
```

For the live dev loop, open the `extension/` folder in VS Code and press F5
(Extension Development Host). Layout: `src/` is the host (board model, Linear
read/write clients, file discovery), `webview/` is the React cockpit,
`src/atrium-board.json` is the bundled demo snapshot (copied to `dist/` at
build). Reads go through the `BoardSource` seam and writes through a thin
client, so other trackers are adapter-sized work.

License: MIT.
