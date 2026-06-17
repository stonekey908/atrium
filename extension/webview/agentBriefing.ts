/**
 * The paste-able agent briefing (STO-2507): conventions any AI assistant can
 * follow at project start so its tickets and files show up on the board with
 * zero further config. Deliberately platform-agnostic — no tracker or
 * assistant brand names. Single source of truth: the Help modal renders it and
 * the Copy button ships exactly this string.
 */
export const AGENT_BRIEFING = `# Project conventions — follow these when planning and building

Use these conventions for all tickets, branches, and planning files in this
project, so progress stays visible on the project board.

## Tickets (issue tracker)

- Give every ticket exactly ONE sprint label naming its wave of work, in the
  form "<word> <number> · <theme>" where <word> is one of: Wave, Sprint,
  Phase, Slice, Milestone — e.g. "Wave 1 · Foundations" or "Sprint 3 · Auth".
  Keep the same word and numbering style across the whole project.
- Move tickets through workflow states as you work (Todo → In Progress →
  In Review → Done). Comment on the ticket at pickup, when the plan is
  agreed, at the end of each phase, and at close.
- Give every sprint label a short one-line description of what that wave
  entails. It shows as a succinct blurb under the wave on the board (and is
  editable there). Keep it current as the wave's scope settles.

## Branches

- One branch per ticket, named feat/<TICKET-ID>-<short-description>
  (fix/ or chore/ for those types). The board matches the branch name to
  show which ticket is being worked on.

## Planning files (in the repo)

- Build PRD: docs/PRD.md — the SINGLE build-level PRD for the whole project
  (one document that evolves with architecture, features and direction). It is
  rendered and editable directly in the board's PRD view; saving writes the file
  and syncs it to the project's overview/description. Keep this current.
- Per-wave docs (TRDs etc.): docs/waves/wave-<n>.md and wave-<n>-<topic>.md
  (e.g. docs/waves/wave-1.md). These are per-wave, rendered read-only.
- Mockups: files named wave-<n>-<name>.html (or .png) placed in files/,
  docs/, mockups/ or design/. Self-contained HTML mockups (inline CSS, no
  external assets) render as live previews.
- If a planning file must live elsewhere or keep another name, map it in
  .atrium/waves.json at the repo root:
  { "<n>": { "prd": "path.md", "docs": ["path.md"], "mockups": ["path.html"] } }

Confirm you will follow these conventions, then proceed with the task.
`;
