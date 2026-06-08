# Atrium Cockpit — live mock-up extension (POC)

Proves the **VS Code extension** path for Atrium: keep the full editor, git,
terminal, extension ecosystem (incl. the Claude Code extension) and multi-root
folders that VS Code already ships, and add the Atrium **Linear / PRD / sprint
cockpit** on top as a React webview.

This is a throwaway proof-of-concept, not the real cockpit — stub data, two
message types. It exists to make the F5 inner loop tangible.

## What it shows

- An **Atrium** icon in the Activity Bar → a **Cockpit** view (sprint pipeline,
  wave cards with progress, ticket rows).
- The same cockpit as a full editor tab: Command Palette → **Atrium: Open Dashboard**.
- A real **webview ⇄ host** round-trip: clicking a ticket (or its ▶ Run button)
  posts a message to the Node host, which replies with a VS Code notification.
  The header shows your **real** open workspace folders (multi-root proof).

## Run it (the F5 loop)

```bash
cd extension
bun install
```

Then **open the `extension/` folder in VS Code** (File → Open Folder…) and press
**F5**. A second VS Code window — the *Extension Development Host* — launches with
Atrium loaded. Click the Atrium icon in its Activity Bar.

The `build` task (Vite for the webview + `tsc` for the host) runs automatically
before launch. To iterate on the cockpit UI without restarting, run
`bun run watch:webview` in a terminal and use **Developer: Reload Window** in the
host.

## Layout

```
extension/
  src/extension.ts      host: registers the view + command, brokers messages, serves stub data
  webview/              React cockpit (built by Vite → dist/webview)
    App.tsx             owns the host message channel
    Cockpit.tsx         the cockpit UI (pipeline, waves, ticket rows)
  media/atrium.svg      Activity Bar icon
```

## Where this goes

- **Wave 0.5** — replace `STUB_WAVES` in `extension.ts` with live Linear data
  (via the Linear MCP, called host-side) and make ticket rows inline-expand to
  Spec / Tests / Activity.
- **Wave 1** — wire ▶ Run to the `claude` stream-json bridge.
- **Stage 2 (if Atrium becomes a product)** — lift this same React cockpit into
  an Eclipse Theia shell to own the chrome. See `files/atrium-chat-architecture.md`.

## Package a shareable build

```bash
bunx @vscode/vsce package
```

Produces a `.vsix` anyone can install via Extensions → … → *Install from VSIX*.
